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
    const storeId = storeIdParam && allowedStoreIds.includes(storeIdParam)
      ? storeIdParam
      : allowedStoreIds[0];

    const { startUtc, endUtc } = todayRangeIST();

    // Count invoices today
    const countAgg = await prisma.invoice.aggregate({
      where: {
        tenantId: user.tenantId,
        storeId,
        createdAt: { gte: startUtc, lt: endUtc },
      },
      _count: { _all: true },
    });

    // Sum totals today (gross)
    const sumAgg = await prisma.invoice.aggregate({
      _sum: { total: true },
      where: {
        tenantId: user.tenantId,
        storeId,
        createdAt: { gte: start, lt: end },
      },
    });

const todaySales = Number(sumAgg._sum.total || 0);


    // Sum totals today (paid only)
    const paidAgg = await prisma.invoice.aggregate({
      where: {
        tenantId: user.tenantId,
        storeId,
        createdAt: { gte: startUtc, lt: endUtc },
        paid: true,
      },
      _sum: { total: true },
    });

    // Unpaid count today
    const unpaidCount = await prisma.invoice.count({
      where: {
        tenantId: user.tenantId,
        storeId,
        createdAt: { gte: startUtc, lt: endUtc },
        paid: false,
      },
    });

    const store = user.stores.find((s) => s.storeId === storeId)?.store;

    return NextResponse.json({
      store: store ? { id: store.id, name: store.name } : { id: storeId, name: "Store" },
      range: { startUtc: startUtc.toISOString(), endUtc: endUtc.toISOString() },
      metrics: {
        invoicesToday: countAgg._count._all ?? 0,
        todaySalesGross: Number(sumAgg._sum.total ?? 0),
        todaySalesPaid: Number(paidAgg._sum.total ?? 0),
        unpaidInvoicesToday: unpaidCount,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Metrics error" },
      { status: 500 }
    );
  }
}
