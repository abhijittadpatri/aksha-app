import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

type AuthedUser = {
  id: string;
  tenantId: string;
  role: "ADMIN" | "DOCTOR" | "BILLING" | "SHOP_OWNER" | string;
  allowedStoreIds: string[];
};

function getUserId(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normPaymentStatus(v: any) {
  return String(v ?? "").trim().toLowerCase(); // "paid" | "unpaid" | "partial" | ...
}

function isPaidStatus(v: any) {
  const ps = normPaymentStatus(v);
  return ps === "paid";
}

function isUnpaidStatus(v: any) {
  const ps = normPaymentStatus(v);
  return ps === "unpaid";
}

async function requireUser(req: NextRequest): Promise<AuthedUser> {
  const userId = getUserId(req);
  if (!userId) throw new Error("Not logged in");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { stores: true },
  });

  if (!user) throw new Error("User not found");

  // For SHOP_OWNER: allow all stores in tenant (chain owner)
  if (String(user.role) === "SHOP_OWNER") {
    const allStores = await prisma.store.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true },
      orderBy: { name: "asc" },
    });
    return {
      id: user.id,
      tenantId: user.tenantId,
      role: String(user.role),
      allowedStoreIds: allStores.map((s) => s.id),
    };
  }

  // For others: only assigned stores
  const allowedStoreIds = (user.stores ?? []).map((s) => s.storeId);
  return {
    id: user.id,
    tenantId: user.tenantId,
    role: String(user.role),
    allowedStoreIds,
  };
}

function istDayRangeUtc(offsetDaysFromToday: number) {
  // Asia/Kolkata offset is +05:30 = 330 minutes
  const offsetMs = 330 * 60 * 1000;
  const now = new Date();

  // Convert to IST “clock”
  const istNow = new Date(now.getTime() + offsetMs);
  const istStart = new Date(istNow);
  istStart.setHours(0, 0, 0, 0);
  istStart.setDate(istStart.getDate() + offsetDaysFromToday);

  const istEnd = new Date(istStart);
  istEnd.setDate(istEnd.getDate() + 1);

  // Convert back to UTC Date objects
  const startUtc = new Date(istStart.getTime() - offsetMs);
  const endUtc = new Date(istEnd.getTime() - offsetMs);

  return { startUtc, endUtc };
}

function istMonthRangeUtc(year: number, monthIndex0: number) {
  // monthIndex0: 0=Jan..11=Dec
  const offsetMs = 330 * 60 * 1000;

  // Build "IST midnight" for start of month, then convert to UTC
  const istStart = new Date(Date.UTC(year, monthIndex0, 1, 0, 0, 0, 0));
  // The above is UTC midnight; we want IST midnight -> subtract offset to get UTC
  const startUtc = new Date(istStart.getTime() - offsetMs);

  const istNext = new Date(Date.UTC(year, monthIndex0 + 1, 1, 0, 0, 0, 0));
  const endUtc = new Date(istNext.getTime() - offsetMs);

  return { startUtc, endUtc };
}

function currentMonthRangeISTUtc() {
  const now = new Date();
  // Convert now to IST date parts
  const offsetMs = 330 * 60 * 1000;
  const istNow = new Date(now.getTime() + offsetMs);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  return istMonthRangeUtc(y, m);
}

function lastMonthRangeISTUtc() {
  const now = new Date();
  const offsetMs = 330 * 60 * 1000;
  const istNow = new Date(now.getTime() + offsetMs);
  let y = istNow.getUTCFullYear();
  let m = istNow.getUTCMonth() - 1;
  if (m < 0) {
    m = 11;
    y -= 1;
  }
  return istMonthRangeUtc(y, m);
}

type Agg = {
  invoiceCount: number;
  unpaidCount: number;
  grossRevenue: number;
  paidRevenue: number;
  avgInvoiceValue: number;
};

async function computeAgg(params: {
  tenantId: string;
  storeIds: string[];
  startUtc: Date;
  endUtc: Date;
}): Promise<Agg> {
  const { tenantId, storeIds, startUtc, endUtc } = params;

  if (!storeIds.length) {
    return {
      invoiceCount: 0,
      unpaidCount: 0,
      grossRevenue: 0,
      paidRevenue: 0,
      avgInvoiceValue: 0,
    };
  }

  // Pull the rows and aggregate in JS (works with totalsJson Json field)
  const rows = await prisma.invoice.findMany({
    where: {
      tenantId,
      storeId: { in: storeIds },
      createdAt: { gte: startUtc, lt: endUtc },
    },
    select: {
      storeId: true,
      paymentStatus: true,
      totalsJson: true,
    },
  });

  let invoiceCount = 0;
  let unpaidCount = 0;
  let grossRevenue = 0;
  let paidRevenue = 0;

  for (const r of rows) {
    invoiceCount += 1;

    const tj: any = r.totalsJson ?? {};
    const total = safeNumber(tj.total);

    grossRevenue += total;

    if (isPaidStatus(r.paymentStatus)) {
      paidRevenue += total;
    } else if (isUnpaidStatus(r.paymentStatus)) {
      unpaidCount += 1;
    }
  }

  const avgInvoiceValue = invoiceCount ? grossRevenue / invoiceCount : 0;

  return {
    invoiceCount,
    unpaidCount,
    grossRevenue,
    paidRevenue,
    avgInvoiceValue,
  };
}

function withDelta(current: number, previous: number) {
  const delta = current - previous;
  const deltaPct = previous === 0 ? (current === 0 ? 0 : 100) : (delta / previous) * 100;
  return { value: current, delta, deltaPct };
}

function decorateAgg(curr: Agg, prev: Agg) {
  return {
    invoiceCount: withDelta(curr.invoiceCount, prev.invoiceCount),
    unpaidCount: withDelta(curr.unpaidCount, prev.unpaidCount),
    grossRevenue: withDelta(curr.grossRevenue, prev.grossRevenue),
    paidRevenue: withDelta(curr.paidRevenue, prev.paidRevenue),
    avgInvoiceValue: withDelta(curr.avgInvoiceValue, prev.avgInvoiceValue),
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);

    // Only allow admin/billing/owner to view insights (adjust if you want doctor too)
    const role = String(user.role);
    if (!(role === "ADMIN" || role === "BILLING" || role === "SHOP_OWNER")) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    if (!user.allowedStoreIds.length) {
      return NextResponse.json({ error: "No store access" }, { status: 403 });
    }

    const url = new URL(req.url);
    const storeIdParam = url.searchParams.get("storeId"); // store id or "all"
    const wantAll = storeIdParam === "all" && role === "SHOP_OWNER";

    // Determine store scope
    let scopedStoreIds: string[] = [];
    if (wantAll) {
      scopedStoreIds = user.allowedStoreIds;
    } else if (storeIdParam) {
      if (!user.allowedStoreIds.includes(storeIdParam)) {
        return NextResponse.json({ error: "No store access" }, { status: 403 });
      }
      scopedStoreIds = [storeIdParam];
    } else {
      scopedStoreIds = [user.allowedStoreIds[0]];
    }

    // Ranges
    const today = istDayRangeUtc(0);
    const yesterday = istDayRangeUtc(-1);

    const thisMonth = currentMonthRangeISTUtc();
    const lastMonth = lastMonthRangeISTUtc();

    // Load store names for breakdown (only for stores in scope)
    const stores = await prisma.store.findMany({
      where: { tenantId: user.tenantId, id: { in: scopedStoreIds } },
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    });

    // Tenant-wide for scope (all stores in scope)
    const [todayAgg, ydayAgg, monthAgg, lastMonthAgg] = await Promise.all([
      computeAgg({ tenantId: user.tenantId, storeIds: scopedStoreIds, startUtc: today.startUtc, endUtc: today.endUtc }),
      computeAgg({ tenantId: user.tenantId, storeIds: scopedStoreIds, startUtc: yesterday.startUtc, endUtc: yesterday.endUtc }),
      computeAgg({ tenantId: user.tenantId, storeIds: scopedStoreIds, startUtc: thisMonth.startUtc, endUtc: thisMonth.endUtc }),
      computeAgg({ tenantId: user.tenantId, storeIds: scopedStoreIds, startUtc: lastMonth.startUtc, endUtc: lastMonth.endUtc }),
    ]);

    const tenant = {
      today: decorateAgg(todayAgg, ydayAgg), // today vs yesterday
      month: decorateAgg(monthAgg, lastMonthAgg), // this month vs last month
    };

    // Per-store breakdown
    const perStore = await Promise.all(
      stores.map(async (s) => {
        const [tAgg, yAgg, mAgg, lmAgg] = await Promise.all([
          computeAgg({ tenantId: user.tenantId, storeIds: [s.id], startUtc: today.startUtc, endUtc: today.endUtc }),
          computeAgg({ tenantId: user.tenantId, storeIds: [s.id], startUtc: yesterday.startUtc, endUtc: yesterday.endUtc }),
          computeAgg({ tenantId: user.tenantId, storeIds: [s.id], startUtc: thisMonth.startUtc, endUtc: thisMonth.endUtc }),
          computeAgg({ tenantId: user.tenantId, storeIds: [s.id], startUtc: lastMonth.startUtc, endUtc: lastMonth.endUtc }),
        ]);

        return {
          id: s.id,
          name: s.name,
          city: s.city ?? null,
          today: decorateAgg(tAgg, yAgg),
          month: decorateAgg(mAgg, lmAgg),
          // handy for sorting
          _sort: {
            todayGross: tAgg.grossRevenue,
            monthGross: mAgg.grossRevenue,
          },
        };
      })
    );

    // Sort stores by month gross desc (usually most useful)
    perStore.sort((a, b) => (b._sort.monthGross ?? 0) - (a._sort.monthGross ?? 0));

    const scopeStoreLabel =
      wantAll
        ? { id: "all", name: "All Stores" }
        : (() => {
            const sid = scopedStoreIds[0];
            const s = stores.find((x) => x.id === sid);
            return s ? { id: s.id, name: s.name } : { id: sid, name: "Store" };
          })();

    return NextResponse.json({
      scope: scopeStoreLabel,
      ranges: {
        today: { startUtc: today.startUtc.toISOString(), endUtc: today.endUtc.toISOString() },
        yesterday: { startUtc: yesterday.startUtc.toISOString(), endUtc: yesterday.endUtc.toISOString() },
        thisMonth: { startUtc: thisMonth.startUtc.toISOString(), endUtc: thisMonth.endUtc.toISOString() },
        lastMonth: { startUtc: lastMonth.startUtc.toISOString(), endUtc: lastMonth.endUtc.toISOString() },
      },
      tenant,
      stores: perStore.map(({ _sort, ...rest }) => rest),
    });
  } catch (e: any) {
    const msg = e?.message ?? "Insights error";
    const status = msg === "Not logged in" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
