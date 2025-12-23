"use client";

import { useEffect, useMemo, useState } from "react";

function money(n: any) {
  const x = Number(n || 0);
  return x.toFixed(2);
}

function pct(v: any) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function signedMoney(n: any) {
  const x = Number(n || 0);
  const sign = x >= 0 ? "+" : "-";
  return `${sign}₹${money(Math.abs(x))}`;
}

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type MetricDelta = { value: number; delta: number; deltaPct: number };
type AggBlock = {
  invoiceCount: MetricDelta;
  unpaidCount: MetricDelta;
  grossRevenue: MetricDelta;
  paidRevenue: MetricDelta;
  avgInvoiceValue: MetricDelta;
};

type StoreBlock = {
  id: string;
  name: string;
  city?: string | null;
  today: AggBlock;
  month: AggBlock;
};

type InsightsOverviewResponse = {
  scope?: { id?: string; name?: string };
  ranges?: any;
  tenant?: { today?: AggBlock; month?: AggBlock };
  stores?: StoreBlock[];
};

export default function InsightsPage() {
  const [data, setData] = useState<InsightsOverviewResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activeStoreId =
    typeof window !== "undefined" ? localStorage.getItem("activeStoreId") : "";

  const qs = useMemo(() => {
    if (!activeStoreId) return "";
    return `?storeId=${encodeURIComponent(activeStoreId)}`;
  }, [activeStoreId]);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/insights/overview${qs}`, {
        credentials: "include",
      });
      const text = await res.text();

      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok) {
        setErr(json.error ?? "Failed to load insights");
        setData(null);
        setLoading(false);
        return;
      }

      setData(json);
      setLoading(false);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load insights");
      setData(null);
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const tenantToday = data?.tenant?.today;
  const tenantMonth = data?.tenant?.month;
  const stores = data?.stores ?? [];

  const scopeLabel =
    (data?.scope?.id === "all" ? "All Stores" : data?.scope?.name) ?? "Store";

  const deltaPill = (delta: number, deltaPctVal: number) => {
    const up = delta >= 0;
    return (
      <span
        className={cls(
          "text-xs px-2 py-1 rounded-full whitespace-nowrap",
          up ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
        )}
      >
        {signedMoney(delta)} ({pct(deltaPctVal)})
      </span>
    );
  };

  // ---------- Leaderboards / Movers (All Stores only) ----------
  const withStoreComputed = useMemo(() => {
    const s = [...stores];

    const todayGross = (x: StoreBlock) => Number(x?.today?.grossRevenue?.value ?? 0);
    const monthGross = (x: StoreBlock) => Number(x?.month?.grossRevenue?.value ?? 0);
    const todayPct = (x: StoreBlock) => Number(x?.today?.grossRevenue?.deltaPct ?? 0);
    const monthPct = (x: StoreBlock) => Number(x?.month?.grossRevenue?.deltaPct ?? 0);
    const unpaidToday = (x: StoreBlock) => Number(x?.today?.unpaidCount?.value ?? 0);

    const topTodayGross = s.slice().sort((a, b) => todayGross(b) - todayGross(a))[0] ?? null;
    const topMonthGross = s.slice().sort((a, b) => monthGross(b) - monthGross(a))[0] ?? null;

    const fastestToday = s.slice().sort((a, b) => todayPct(b) - todayPct(a))[0] ?? null;
    const fastestMonth = s.slice().sort((a, b) => monthPct(b) - monthPct(a))[0] ?? null;

    const mostUnpaid = s.slice().sort((a, b) => unpaidToday(b) - unpaidToday(a))[0] ?? null;

    const moversToday = s
      .slice()
      .sort((a, b) => todayPct(b) - todayPct(a))
      .slice(0, 8);

    return {
      topTodayGross,
      topMonthGross,
      fastestToday,
      fastestMonth,
      mostUnpaid,
      moversToday,
    };
  }, [stores]);

  const sortedStoresByMonthGross = useMemo(() => {
    const copy = [...stores];
    copy.sort(
      (a, b) =>
        Number(b?.month?.grossRevenue?.value ?? 0) -
        Number(a?.month?.grossRevenue?.value ?? 0)
    );
    return copy;
  }, [stores]);

  const StatCard = ({
    title,
    store,
    primary,
    secondary,
    pill,
  }: {
    title: string;
    store: StoreBlock | null;
    primary: string;
    secondary?: string;
    pill?: React.ReactNode;
  }) => {
    return (
      <div className="card card-pad min-w-0">
        <div className="subtle">{title}</div>
        <div className="mt-1 font-semibold min-w-0">
          <div className="truncate">
            {store ? store.name : "—"}
            {store?.city ? <span className="text-gray-400"> • {store.city}</span> : null}
          </div>
        </div>

        <div className="mt-2 text-2xl font-semibold whitespace-nowrap">{primary}</div>

        <div className="mt-2 flex items-start justify-between gap-2">
          <div className="text-xs text-gray-500 min-w-0 truncate">{secondary ?? ""}</div>
          {pill ? <div className="shrink-0">{pill}</div> : null}
        </div>
      </div>
    );
  };

  const StoreMini = ({
    labelLeft,
    valueLeft,
    labelRight,
    valueRight,
  }: {
    labelLeft: string;
    valueLeft: React.ReactNode;
    labelRight: string;
    valueRight: React.ReactNode;
  }) => (
    <div className="grid grid-cols-2 gap-2">
      <div className="border rounded-xl p-3 min-w-0">
        <div className="subtle">{labelLeft}</div>
        <div className="mt-1 font-semibold whitespace-nowrap">{valueLeft}</div>
      </div>
      <div className="border rounded-xl p-3 min-w-0">
        <div className="subtle">{labelRight}</div>
        <div className="mt-1 font-semibold whitespace-nowrap">{valueRight}</div>
      </div>
    </div>
  );

  return (
    <main className="p-4 md:p-6">
      <div className="page space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="h1">Insights</h1>
            <p className="subtle truncate">Scope: {scopeLabel}</p>
          </div>

          <button
            className="border px-3 py-2 rounded-lg text-sm"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}
        {!data && !err && (
          <div className="subtle">{loading ? "Loading…" : "No data yet."}</div>
        )}

        {data && (
          <>
            {/* Today */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="card card-pad min-w-0">
                <div className="subtle">Today • Gross Revenue</div>
                <div className="kpi whitespace-nowrap">₹{money(tenantToday?.grossRevenue?.value ?? 0)}</div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {deltaPill(
                    tenantToday?.grossRevenue?.delta ?? 0,
                    tenantToday?.grossRevenue?.deltaPct ?? 0
                  )}
                </div>

                <div className="text-xs text-gray-500 mt-2">
                  Paid: ₹{money(tenantToday?.paidRevenue?.value ?? 0)} • Unpaid invoices:{" "}
                  {tenantToday?.unpaidCount?.value ?? 0}
                </div>
              </div>

              <div className="card card-pad min-w-0">
                <div className="subtle">Today • Invoices</div>
                <div className="kpi">{tenantToday?.invoiceCount?.value ?? 0}</div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {deltaPill(
                    tenantToday?.invoiceCount?.delta ?? 0,
                    tenantToday?.invoiceCount?.deltaPct ?? 0
                  )}
                </div>

                <div className="text-xs text-gray-500 mt-2">
                  Unpaid: {tenantToday?.unpaidCount?.value ?? 0}{" "}
                  <span className="text-gray-400">•</span> Avg invoice: ₹
                  {money(tenantToday?.avgInvoiceValue?.value ?? 0)}
                </div>
              </div>

              <div className="card card-pad min-w-0">
                <div className="subtle">Today • Paid Revenue</div>
                <div className="kpi whitespace-nowrap">₹{money(tenantToday?.paidRevenue?.value ?? 0)}</div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {deltaPill(
                    tenantToday?.paidRevenue?.delta ?? 0,
                    tenantToday?.paidRevenue?.deltaPct ?? 0
                  )}
                </div>

                <div className="text-xs text-gray-500 mt-2">
                  Avg invoice: ₹{money(tenantToday?.avgInvoiceValue?.value ?? 0)}
                </div>
              </div>
            </div>

            {/* All Stores: Leaderboards + Movers */}
            {activeStoreId === "all" && (
              <>
                <div className="card card-pad">
                  <div className="h2">Leaderboards</div>
                  <div className="subtle mt-1">Quick “what’s happening” across the chain.</div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <StatCard
                      title="Top Gross • Today"
                      store={withStoreComputed.topTodayGross}
                      primary={`₹${money(withStoreComputed.topTodayGross?.today?.grossRevenue?.value ?? 0)}`}
                      secondary={`Invoices: ${withStoreComputed.topTodayGross?.today?.invoiceCount?.value ?? 0}`}
                      pill={deltaPill(
                        withStoreComputed.topTodayGross?.today?.grossRevenue?.delta ?? 0,
                        withStoreComputed.topTodayGross?.today?.grossRevenue?.deltaPct ?? 0
                      )}
                    />

                    <StatCard
                      title="Top Gross • This Month"
                      store={withStoreComputed.topMonthGross}
                      primary={`₹${money(withStoreComputed.topMonthGross?.month?.grossRevenue?.value ?? 0)}`}
                      secondary={`Invoices: ${withStoreComputed.topMonthGross?.month?.invoiceCount?.value ?? 0}`}
                      pill={deltaPill(
                        withStoreComputed.topMonthGross?.month?.grossRevenue?.delta ?? 0,
                        withStoreComputed.topMonthGross?.month?.grossRevenue?.deltaPct ?? 0
                      )}
                    />

                    <StatCard
                      title="Fastest Growth • Today"
                      store={withStoreComputed.fastestToday}
                      primary={pct(withStoreComputed.fastestToday?.today?.grossRevenue?.deltaPct ?? null)}
                      secondary={`Gross: ₹${money(withStoreComputed.fastestToday?.today?.grossRevenue?.value ?? 0)}`}
                      pill={deltaPill(
                        withStoreComputed.fastestToday?.today?.grossRevenue?.delta ?? 0,
                        withStoreComputed.fastestToday?.today?.grossRevenue?.deltaPct ?? 0
                      )}
                    />

                    <StatCard
                      title="Fastest Growth • This Month"
                      store={withStoreComputed.fastestMonth}
                      primary={pct(withStoreComputed.fastestMonth?.month?.grossRevenue?.deltaPct ?? null)}
                      secondary={`Gross: ₹${money(withStoreComputed.fastestMonth?.month?.grossRevenue?.value ?? 0)}`}
                      pill={deltaPill(
                        withStoreComputed.fastestMonth?.month?.grossRevenue?.delta ?? 0,
                        withStoreComputed.fastestMonth?.month?.grossRevenue?.deltaPct ?? 0
                      )}
                    />

                    <StatCard
                      title="Most Unpaid • Today"
                      store={withStoreComputed.mostUnpaid}
                      primary={`${withStoreComputed.mostUnpaid?.today?.unpaidCount?.value ?? 0}`}
                      secondary={`Invoices: ${withStoreComputed.mostUnpaid?.today?.invoiceCount?.value ?? 0}`}
                      pill={deltaPill(
                        withStoreComputed.mostUnpaid?.today?.unpaidCount?.delta ?? 0,
                        withStoreComputed.mostUnpaid?.today?.unpaidCount?.deltaPct ?? 0
                      )}
                    />
                  </div>
                </div>

                {/* Movers: MOBILE cards + DESKTOP table */}
                <div className="card card-pad">
                  <div className="h2">Top movers today</div>
                  <div className="subtle mt-1">
                    Sorted by Today gross Δ% (highest first). Great for quick follow-ups.
                  </div>

                  {/* Mobile */}
                  <div className="mt-3 space-y-3 md:hidden">
                    {withStoreComputed.moversToday.map((s) => {
                      const td = s.today?.grossRevenue;
                      const unpaid = s.today?.unpaidCount;
                      const up = (td?.delta ?? 0) >= 0;

                      return (
                        <div key={s.id} className="border rounded-2xl bg-white p-3 space-y-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{s.name}</div>
                            <div className="text-xs text-gray-500 truncate">{s.city ?? ""}</div>
                          </div>

                          <StoreMini
                            labelLeft="Today Gross"
                            valueLeft={`₹${money(td?.value ?? 0)}`}
                            labelRight="Unpaid"
                            valueRight={
                              <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
                                {unpaid?.value ?? 0}
                              </span>
                            }
                          />

                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span
                              className={cls(
                                "text-xs px-2 py-1 rounded-full whitespace-nowrap",
                                up ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
                              )}
                            >
                              Δ Gross: {signedMoney(td?.delta ?? 0)}
                            </span>

                            <span className="text-xs text-gray-600 whitespace-nowrap">
                              Δ %: {pct(td?.deltaPct ?? null)}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {withStoreComputed.moversToday.length === 0 && (
                      <div className="p-4 text-sm text-gray-500">No store data yet.</div>
                    )}
                  </div>

                  {/* Desktop */}
                  <div className="mt-3 border rounded-xl overflow-hidden bg-white hidden md:block">
                    <div className="grid grid-cols-12 bg-gray-50 text-xs font-medium p-3">
                      <div className="col-span-4">Store</div>
                      <div className="col-span-2 text-right">Today Gross</div>
                      <div className="col-span-2 text-right">Δ Gross</div>
                      <div className="col-span-2 text-right">Δ %</div>
                      <div className="col-span-2 text-right">Unpaid</div>
                    </div>

                    {withStoreComputed.moversToday.map((s) => {
                      const td = s.today?.grossRevenue;
                      const unpaid = s.today?.unpaidCount;

                      return (
                        <div key={s.id} className="grid grid-cols-12 p-3 text-sm border-t">
                          <div className="col-span-4 min-w-0">
                            <div className="font-medium truncate">{s.name}</div>
                            <div className="text-xs text-gray-500 truncate">{s.city ?? ""}</div>
                          </div>

                          <div className="col-span-2 text-right font-medium">
                            ₹{money(td?.value ?? 0)}
                          </div>

                          <div className="col-span-2 text-right">
                            <span
                              className={cls(
                                "text-xs px-2 py-1 rounded-full whitespace-nowrap",
                                (td?.delta ?? 0) >= 0
                                  ? "bg-green-50 text-green-800"
                                  : "bg-red-50 text-red-800"
                              )}
                            >
                              {signedMoney(td?.delta ?? 0)}
                            </span>
                          </div>

                          <div className="col-span-2 text-right">{pct(td?.deltaPct ?? null)}</div>

                          <div className="col-span-2 text-right">
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 whitespace-nowrap">
                              {unpaid?.value ?? 0}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {withStoreComputed.moversToday.length === 0 && (
                      <div className="p-4 text-sm text-gray-500">No store data yet.</div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Month overview */}
            <div className="card card-pad">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="h2">Month overview</div>
                  <div className="subtle mt-1">This month vs last month.</div>
                </div>

                <div className="shrink-0">
                  {deltaPill(
                    tenantMonth?.grossRevenue?.delta ?? 0,
                    tenantMonth?.grossRevenue?.deltaPct ?? 0
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="border rounded-xl p-3">
                  <div className="subtle">This Month • Gross</div>
                  <div className="text-lg font-semibold whitespace-nowrap">
                    ₹{money(tenantMonth?.grossRevenue?.value ?? 0)}
                  </div>
                </div>

                <div className="border rounded-xl p-3">
                  <div className="subtle">This Month • Paid</div>
                  <div className="text-lg font-semibold whitespace-nowrap">
                    ₹{money(tenantMonth?.paidRevenue?.value ?? 0)}
                  </div>
                </div>

                <div className="border rounded-xl p-3">
                  <div className="subtle">This Month • Invoices</div>
                  <div className="text-lg font-semibold">
                    {tenantMonth?.invoiceCount?.value ?? 0}
                  </div>
                </div>

                <div className="border rounded-xl p-3">
                  <div className="subtle">This Month • Avg Invoice</div>
                  <div className="text-lg font-semibold whitespace-nowrap">
                    ₹{money(tenantMonth?.avgInvoiceValue?.value ?? 0)}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                Δ Gross: {signedMoney(tenantMonth?.grossRevenue?.delta ?? 0)} (
                {pct(tenantMonth?.grossRevenue?.deltaPct ?? 0)}){" "}
                <span className="text-gray-400">•</span> Δ Invoices:{" "}
                {(tenantMonth?.invoiceCount?.delta ?? 0) >= 0 ? "+" : ""}
                {tenantMonth?.invoiceCount?.delta ?? 0} (
                {pct(tenantMonth?.invoiceCount?.deltaPct ?? 0)})
              </div>
            </div>

            {/* Per-store breakdown: MOBILE cards + DESKTOP table */}
            {activeStoreId === "all" && (
              <div className="card card-pad">
                <div className="h2">Per-store breakdown</div>
                <div className="subtle mt-1">
                  Sorted by this month gross revenue (top performers first).
                </div>

                {/* Mobile */}
                <div className="mt-3 space-y-3 md:hidden">
                  {sortedStoresByMonthGross.map((s) => {
                    const td = s.today?.grossRevenue;
                    const mo = s.month?.grossRevenue;

                    return (
                      <div key={s.id} className="border rounded-2xl bg-white p-3 space-y-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{s.name}</div>
                          <div className="text-xs text-gray-500 truncate">{s.city ?? ""}</div>
                        </div>

                        <StoreMini
                          labelLeft="Today Gross"
                          valueLeft={`₹${money(td?.value ?? 0)}`}
                          labelRight="Month Gross"
                          valueRight={`₹${money(mo?.value ?? 0)}`}
                        />

                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            Today Δ: {signedMoney(td?.delta ?? 0)} ({pct(td?.deltaPct ?? null)})
                          </span>

                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            Month Δ: {signedMoney(mo?.delta ?? 0)} ({pct(mo?.deltaPct ?? null)})
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {sortedStoresByMonthGross.length === 0 && (
                    <div className="p-4 text-sm text-gray-500">No store data yet.</div>
                  )}
                </div>

                {/* Desktop */}
                <div className="mt-3 border rounded-xl overflow-hidden bg-white hidden md:block">
                  <div className="grid grid-cols-12 bg-gray-50 text-xs font-medium p-3">
                    <div className="col-span-4">Store</div>
                    <div className="col-span-2 text-right">Today Gross</div>
                    <div className="col-span-2 text-right">Δ vs Yday</div>
                    <div className="col-span-2 text-right">Month Gross</div>
                    <div className="col-span-2 text-right">Δ vs L.M.</div>
                  </div>

                  {sortedStoresByMonthGross.map((s) => {
                    const td = s.today?.grossRevenue;
                    const mo = s.month?.grossRevenue;

                    return (
                      <div key={s.id} className="grid grid-cols-12 p-3 text-sm border-t">
                        <div className="col-span-4 min-w-0">
                          <div className="font-medium truncate">{s.name}</div>
                          <div className="text-xs text-gray-500 truncate">{s.city ?? ""}</div>
                        </div>

                        <div className="col-span-2 text-right font-medium">
                          ₹{money(td?.value ?? 0)}
                        </div>

                        <div className="col-span-2 text-right">
                          {deltaPill(td?.delta ?? 0, td?.deltaPct ?? 0)}
                        </div>

                        <div className="col-span-2 text-right font-medium">
                          ₹{money(mo?.value ?? 0)}
                        </div>

                        <div className="col-span-2 text-right">
                          {deltaPill(mo?.delta ?? 0, mo?.deltaPct ?? 0)}
                        </div>
                      </div>
                    );
                  })}

                  {sortedStoresByMonthGross.length === 0 && (
                    <div className="p-4 text-sm text-gray-500">No store data yet.</div>
                  )}
                </div>
              </div>
            )}

            {/* Debug */}
            <details className="card card-pad">
              <summary className="text-sm cursor-pointer select-none">Debug JSON</summary>
              <pre className="mt-3 text-xs bg-gray-50 border rounded-lg p-3 overflow-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </>
        )}
      </div>
    </main>
  );
}
