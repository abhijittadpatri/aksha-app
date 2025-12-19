import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

function getUserId(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

function todayRangeIST() {
  // Compute start/end of today in Asia/Kolkata, but return as UTC Date objects
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

    const allowedStoreIds = (user.stores ?? []).map((s) => s.storeId);
    if (allowedStoreIds.length === 0) {
      return NextResponse.json({ error: "No store access" }, { status: 403 });
    }

    const url = new URL(req.url);
    const storeIdParam = url.searchParams.get("storeId");

    // ✅ Your schema role is SHOP_OWNER (not OWNER)
    const isOwner = user.role === "SHOP_OWNER";
    const isAllStores = isOwner && storeIdParam === "all";

    // If not ALL, enforce storeId within allowed stores
    const storeId =
      storeIdParam && allowedStoreIds.includes(storeIdParam)
        ? storeIdParam
        : allowedStoreIds[0];

    const { startUtc, endUtc } = todayRangeIST();

    // Build where clause (all stores vs single store)
    const baseWhere: any = {
      tenantId: user.tenantId,
      createdAt: { gte: startUtc, lt: endUtc },
      ...(isAllStores ? { storeId: { in: allowedStoreIds } } : { storeId }),
    };

    const invoicesToday = await prisma.invoice.count({ where: baseWhere });

    // Count unpaid invoices today (normalize to schema default "Unpaid")
    const unpaidInvoicesToday = await prisma.invoice.count({
      where: {
        ...baseWhere,
        // Prisma string enum not enforced here, so we filter in DB broadly:
        paymentStatus: { in: ["Unpaid", "UNPAID", "unpaid", "UNPAID "] },
      },
    });

    // Pull today's invoices and sum totals from totalsJson (TS-safe, no Prisma _sum typing issues)
    const todayInvoices = await prisma.invoice.findMany({
      where: baseWhere,
      select: {
        paymentStatus: true,
        totalsJson: true,
      },
    });

    let todaySalesGross = 0;
    let todaySalesPaid = 0;

    for (const inv of todayInvoices) {
      const tj: any = inv.totalsJson ?? {};
      const total = safeNumber(tj.total);

      todaySalesGross += total;

      if (isPaidStatus(inv.paymentStatus)) {
        todaySalesPaid += total;
      }
    }

    // Response store label
    const store =
      !isAllStores ? user.stores.find((s) => s.storeId === storeId)?.store : null;

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
