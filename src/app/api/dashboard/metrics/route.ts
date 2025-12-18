import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

function getUserId(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

function todayRangeIST() {
  // Compute start/end of today in Asia/Kolkata, returned as UTC Date objects
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
  // Your schema default: "Unpaid" (case varies), and you may use "Paid"
  const s = String(paymentStatus ?? "").trim().toLowerCase();
  return s === "paid";
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        stores: { include: { store: true } },
      },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

    const allowedStoreIds = (user.stores ?? []).map((s) => s.storeId);
    if (allowedStoreIds.length === 0) {
      return NextResponse.json({ error: "No store access" }, { status: 403 });
    }

    const url = new URL(req.url);
    const storeIdParam = url.searchParams.get("storeId");

    // storeId supports:
    // - specific storeId (must be in allowedStoreIds)
    // - "ALL" to aggregate across allowedStoreIds
    const wantsAll = storeIdParam === "ALL";
    const storeId =
      storeIdParam && allowedStoreIds.includes(storeIdParam) ? storeIdParam : allowedStoreIds[0];

    const { startUtc, endUtc } = todayRangeIST();

    const baseWhere: any = {
      tenantId: user.tenantId,
      createdAt: { gte: startUtc, lt: endUtc },
      ...(wantsAll ? { storeId: { in: allowedStoreIds } } : { storeId }),
    };

    // Count invoices today
    const invoicesToday = await prisma.invoice.count({ where: baseWhere });

    // Unpaid count today (anything NOT "Paid" (insensitive))
    const unpaidInvoicesToday = await prisma.invoice.count({
      where: {
        ...baseWhere,
        NOT: {
          paymentStatus: { equals: "Paid", mode: "insensitive" },
        },
      },
    });

    // Sum totals by reading totalsJson.total (TS-safe, schema-safe)
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

    const todaySalesUnpaid = Math.max(0, todaySalesGross - todaySalesPaid);

    const store =
      wantsAll
        ? null
        : user.stores.find((s) => s.storeId === storeId)?.store;

    return NextResponse.json({
      store: wantsAll
        ? { id: "ALL", name: "All Stores" }
        : store
          ? { id: store.id, name: store.name }
          : { id: storeId, name: "Store" },
      range: { startUtc: startUtc.toISOString(), endUtc: endUtc.toISOString() },
      metrics: {
        invoicesToday,
        unpaidInvoicesToday,
        todaySalesGross,
        todaySalesPaid,
        todaySalesUnpaid,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Metrics error" }, { status: 500 });
  }
}
