import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

function getUserId(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

function todayRangeIST() {
  const offsetMs = 330 * 60 * 1000; // +05:30
  const now = new Date();

  const istNow = new Date(now.getTime() + offsetMs);
  const istStart = new Date(istNow);
  istStart.setHours(0, 0, 0, 0);

  const istEnd = new Date(istStart);
  istEnd.setDate(istEnd.getDate() + 1);

  const startUtc = new Date(istStart.getTime() - offsetMs);
  const endUtc = new Date(istEnd.getTime() - offsetMs);

  return { startUtc, endUtc };
}

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isPaidStatus(paymentStatus: any) {
  const ps = String(paymentStatus ?? "").trim().toLowerCase();
  return ps === "paid";
}

function isUnpaidStatus(paymentStatus: any) {
  const ps = String(paymentStatus ?? "").trim().toLowerCase();
  return ps === "unpaid";
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        stores: { include: { store: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const isOwner = user.role === "SHOP_OWNER";

    // ✅ allowed store ids from mapping
    let allowedStoreIds = (user.stores ?? []).map((s) => s.storeId);

    // ✅ IMPORTANT FIX:
    // SHOP_OWNER should have access tenant-wide even if not explicitly mapped
    if (isOwner && allowedStoreIds.length === 0) {
      const allStores = await prisma.store.findMany({
        where: { tenantId: user.tenantId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      allowedStoreIds = allStores.map((s) => s.id);
    }

    if (allowedStoreIds.length === 0) {
      return NextResponse.json({ error: "No store access" }, { status: 403 });
    }

    const url = new URL(req.url);
    const storeIdParam = url.searchParams.get("storeId");

    const isAllStores = isOwner && storeIdParam === "all";

    // Pick store scope
    let storeId = allowedStoreIds[0];
    if (!isAllStores && storeIdParam && allowedStoreIds.includes(storeIdParam)) {
      storeId = storeIdParam;
    }

    const { startUtc, endUtc } = todayRangeIST();

    const baseWhere: any = {
      tenantId: user.tenantId,
      createdAt: { gte: startUtc, lt: endUtc },
      ...(isAllStores ? { storeId: { in: allowedStoreIds } } : { storeId }),
    };

    const invoicesToday = await prisma.invoice.count({ where: baseWhere });

    // Instead of brittle IN list, pull status + totals and compute properly
    const todayInvoices = await prisma.invoice.findMany({
      where: baseWhere,
      select: { paymentStatus: true, totalsJson: true },
    });

    let todaySalesGross = 0;
    let todaySalesPaid = 0;
    let unpaidInvoicesToday = 0;

    for (const inv of todayInvoices) {
      const tj: any = inv.totalsJson ?? {};
      const total = safeNumber(tj.total);

      todaySalesGross += total;

      if (isPaidStatus(inv.paymentStatus)) todaySalesPaid += total;
      if (isUnpaidStatus(inv.paymentStatus)) unpaidInvoicesToday += 1;
    }

    // Response store label
    const store =
      !isAllStores
        ? user.stores.find((s) => s.storeId === storeId)?.store
        : null;

    return NextResponse.json({
      store: isAllStores
        ? { id: "all", name: "All Stores" }
        : store
          ? { id: store.id, name: store.name }
          : { id: storeId, name: "Store" },
      range: { startUtc: startUtc.toISOString(), endUtc: endUtc.toISOString() },
      metrics: {
        invoicesToday,
        todaySalesGross,
        todaySalesPaid,
        unpaidInvoicesToday,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Metrics error" },
      { status: 500 }
    );
  }
}
