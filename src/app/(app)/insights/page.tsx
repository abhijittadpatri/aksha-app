"use client";

import { useEffect, useMemo, useState } from "react";

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(n: any) {
  return safeNumber(n).toFixed(2);
}

function pct(v: any) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function signedMoney(n: any) {
  const x = safeNumber(n);
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

function DeltaPill({ delta, deltaPctVal }: { delta: number; deltaPctVal: number }) {
  const up = safeNumber(delta) >= 0;
  return (
    <span className={cls("badge", up ? "badge-ok" : "badge-danger")}>
      {signedMoney(delta)} ({pct(deltaPctVal)})
    </span>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  delta,
  deltaPctVal,
  tone = "brand",
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  delta?: number;
  deltaPctVal?: number;
  tone?: "brand" | "info" | "success" | "warning";
  icon?: string;
}) {
  const toneVar =
    tone === "info"
      ? "var(--info)"
      : tone === "success"
      ? "var(--success)"
      : tone === "warning"
      ? "var(--warning)"
      : "var(--brand)";

  return (
    <div
      className="panel p-4"
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          `radial-gradient(820px 260px at 18% 0%, rgba(${toneVar},0.10), transparent 62%), ` +
          "rgba(var(--panel),0.78)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label">{title}</div>
          <div className="kpi mt-2 leading-tight break-words">{value}</div>
        </div>

        {icon ? (
          <div
            className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: `rgba(${toneVar},0.14)`,
              border: `1px solid rgba(${toneVar},0.22)`,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              color: "rgb(var(--fg))",
            }}
            aria-hidden="true"
          >
            <span className="text-base">{icon}</span>
          </div>
        ) : null}
      </div>

      {delta !== undefined && deltaPctVal !== undefined ? (
        <div className="mt-2">
          <DeltaPill delta={delta} deltaPctVal={deltaPctVal} />
        </div>
      ) : null}

      {subtitle ? <div className="mt-2 text-xs muted">{subtitle}</div> : null}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <div className="h2">{title}</div>
        {subtitle ? <div className="subtle mt-1">{subtitle}</div> : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

function MetricRow({
  label,
  value,
  pill,
}: {
  label: string;
  value: string;
  pill?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-sm muted">{label}</div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-sm font-semibold">{value}</div>
        {pill ? pill : null}
      </div>
    </div>
  );
}

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
      const res = await fetch(`/api/insights/overview${qs}`, { credentials: "include" });
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
    (data?.scope?.id === "all" ? "All Stores" : data?.scope?.name) ??
    (activeStoreId === "all" ? "All Stores" : "Store");

  // ---------- Leaderboards / Movers (All Stores only) ----------
  const computed = useMemo(() => {
    const s = [...stores];

    const todayGross = (x: StoreBlock) => safeNumber(x?.today?.grossRevenue?.value ?? 0);
    const monthGross = (x: StoreBlock) => safeNumber(x?.month?.grossRevenue?.value ?? 0);
    const todayPct = (x: StoreBlock) => safeNumber(x?.today?.grossRevenue?.deltaPct ?? 0);
    const monthPct = (x: StoreBlock) => safeNumber(x?.month?.grossRevenue?.deltaPct ?? 0);
    const unpaidToday = (x: StoreBlock) => safeNumber(x?.today?.unpaidCount?.value ?? 0);

    const topTodayGross = s.slice().sort((a, b) => todayGross(b) - todayGross(a))[0] ?? null;
    const topMonthGross = s.slice().sort((a, b) => monthGross(b) - monthGross(a))[0] ?? null;

    const fastestToday = s.slice().sort((a, b) => todayPct(b) - todayPct(a))[0] ?? null;
    const fastestMonth = s.slice().sort((a, b) => monthPct(b) - monthPct(a))[0] ?? null;

    const mostUnpaid = s.slice().sort((a, b) => unpaidToday(b) - unpaidToday(a))[0] ?? null;

    const moversToday = s.slice().sort((a, b) => todayPct(b) - todayPct(a)).slice(0, 8);

    const sortedStoresByMonthGross = s
      .slice()
      .sort((a, b) => monthGross(b) - monthGross(a));

    return {
      topTodayGross,
      topMonthGross,
      fastestToday,
      fastestMonth,
      mostUnpaid,
      moversToday,
      sortedStoresByMonthGross,
    };
  }, [stores]);

  function StoreStatCard({
    title,
    store,
    primary,
    secondary,
    pill,
    tone = "brand",
  }: {
    title: string;
    store: StoreBlock | null;
    primary: string;
    secondary?: string;
    pill?: React.ReactNode;
    tone?: "brand" | "info" | "success" | "warning";
  }) {
    const city = store?.city ? ` • ${store.city}` : "";
    return (
      <div className="panel p-4">
        <div className="label">{title}</div>

        <div className="mt-2 min-w-0">
          <div className="text-sm font-semibold truncate">
            {store ? store.name : "—"}
            <span className="muted">{city}</span>
          </div>
        </div>

        <div className="mt-2 text-2xl font-semibold">{primary}</div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-xs muted min-w-0 truncate">{secondary ?? ""}</div>
          {pill ? <div className="shrink-0">{pill}</div> : null}
        </div>

        {/* subtle tint bar */}
        <div
          className="mt-3 h-[2px] rounded-full"
          style={{
            background:
              tone === "info"
                ? "rgba(var(--info),0.55)"
                : tone === "success"
                ? "rgba(var(--success),0.55)"
                : tone === "warning"
                ? "rgba(var(--warning),0.55)"
                : "rgba(var(--brand),0.55)",
            opacity: 0.6,
          }}
        />
      </div>
    );
  }

  return (
    <main
      className="p-4 md:p-6"
      style={{
        background:
          "radial-gradient(1100px 520px at 10% 0%, rgba(var(--brand),0.10), transparent 60%)," +
          "radial-gradient(900px 520px at 90% 0%, rgba(var(--info),0.08), transparent 60%)," +
          "radial-gradient(900px 520px at 60% 110%, rgba(var(--success),0.06), transparent 60%)",
      }}
    >
      <div className="page space-y-4">
        {/* Header */}
        <div className="card card-pad">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="h1">Insights</h1>
              <p className="subtle truncate">Scope: {scopeLabel}</p>
            </div>

            <button className="btn btn-secondary w-full sm:w-auto" onClick={load} disabled={loading} type="button">
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {err ? (
            <div
              className="mt-3 rounded-xl px-3 py-2 text-sm"
              style={{
                background: "rgba(var(--danger),0.16)",
                border: "1px solid rgba(var(--danger),0.24)",
              }}
            >
              {err}
            </div>
          ) : null}
        </div>

        {!data && !err && (
          <div className="panel p-5">
            <div className="h2">{loading ? "Loading…" : "No data yet"}</div>
            <div className="subtle mt-1">
              {activeStoreId ? "If this looks wrong, try Refresh." : "Select a store in the sidebar."}
            </div>
          </div>
        )}

        {data ? (
          <>
            {/* TODAY + MONTH summary (layout simplification) */}
            <div className="card card-pad space-y-4">
              <SectionHeader
                title="At a glance"
                subtitle="Today and month-to-date, with the same visual language as Dashboard."
                right={
                  <div className="flex items-center gap-2">
                    <span className="badge badge-info">Today</span>
                    <span className="badge">Month</span>
                  </div>
                }
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Today column */}
                <div className="panel p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Today</div>
                    <span className="badge badge-info">Scope: {scopeLabel}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <KpiCard
                      title="Gross revenue"
                      value={`₹${money(tenantToday?.grossRevenue?.value ?? 0)}`}
                      delta={tenantToday?.grossRevenue?.delta ?? 0}
                      deltaPctVal={tenantToday?.grossRevenue?.deltaPct ?? 0}
                      subtitle={`Paid: ₹${money(tenantToday?.paidRevenue?.value ?? 0)} • Unpaid invoices: ${tenantToday?.unpaidCount?.value ?? 0}`}
                      tone="brand"
                      icon="₹"
                    />
                    <KpiCard
                      title="Invoices"
                      value={`${tenantToday?.invoiceCount?.value ?? 0}`}
                      delta={tenantToday?.invoiceCount?.delta ?? 0}
                      deltaPctVal={tenantToday?.invoiceCount?.deltaPct ?? 0}
                      subtitle={`Avg invoice: ₹${money(tenantToday?.avgInvoiceValue?.value ?? 0)}`}
                      tone="info"
                      icon="🧾"
                    />
                  </div>

                  <div className="surface-muted p-3">
                    <MetricRow
                      label="Paid revenue"
                      value={`₹${money(tenantToday?.paidRevenue?.value ?? 0)}`}
                      pill={<DeltaPill delta={tenantToday?.paidRevenue?.delta ?? 0} deltaPctVal={tenantToday?.paidRevenue?.deltaPct ?? 0} />}
                    />
                    <div className="mt-2" />
                    <MetricRow
                      label="Unpaid invoices"
                      value={`${tenantToday?.unpaidCount?.value ?? 0}`}
                      pill={<DeltaPill delta={tenantToday?.unpaidCount?.delta ?? 0} deltaPctVal={tenantToday?.unpaidCount?.deltaPct ?? 0} />}
                    />
                  </div>
                </div>

                {/* Month column */}
                <div className="panel p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Month to date</div>
                    <span className="badge">This Month</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <KpiCard
                      title="Gross revenue"
                      value={`₹${money(tenantMonth?.grossRevenue?.value ?? 0)}`}
                      delta={tenantMonth?.grossRevenue?.delta ?? 0}
                      deltaPctVal={tenantMonth?.grossRevenue?.deltaPct ?? 0}
                      subtitle="Billed revenue month-to-date."
                      tone="brand"
                      icon="₹"
                    />
                    <KpiCard
                      title="Avg invoice"
                      value={`₹${money(tenantMonth?.avgInvoiceValue?.value ?? 0)}`}
                      delta={tenantMonth?.avgInvoiceValue?.delta ?? 0}
                      deltaPctVal={tenantMonth?.avgInvoiceValue?.deltaPct ?? 0}
                      subtitle={`Invoices: ${tenantMonth?.invoiceCount?.value ?? 0}`}
                      tone="warning"
                      icon="∅"
                    />
                  </div>

                  <div className="surface-muted p-3 space-y-2">
                    <MetricRow
                      label="Paid revenue"
                      value={`₹${money(tenantMonth?.paidRevenue?.value ?? 0)}`}
                      pill={<DeltaPill delta={tenantMonth?.paidRevenue?.delta ?? 0} deltaPctVal={tenantMonth?.paidRevenue?.deltaPct ?? 0} />}
                    />
                    <MetricRow
                      label="Invoices"
                      value={`${tenantMonth?.invoiceCount?.value ?? 0}`}
                      pill={<DeltaPill delta={tenantMonth?.invoiceCount?.delta ?? 0} deltaPctVal={tenantMonth?.invoiceCount?.deltaPct ?? 0} />}
                    />
                    <MetricRow
                      label="Unpaid invoices"
                      value={`${tenantMonth?.unpaidCount?.value ?? 0}`}
                      pill={<DeltaPill delta={tenantMonth?.unpaidCount?.delta ?? 0} deltaPctVal={tenantMonth?.unpaidCount?.deltaPct ?? 0} />}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* All Stores: Leaderboards + Movers + Per-store */}
            {activeStoreId === "all" ? (
              <>
                {/* Leaderboards */}
                <div className="card card-pad space-y-3">
                  <SectionHeader
                    title="Leaderboards"
                    subtitle="Fast “what’s happening” across the chain."
                    right={<span className="badge badge-info">{stores.length} stores</span>}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <StoreStatCard
                      title="Top gross • Today"
                      store={computed.topTodayGross}
                      primary={`₹${money(computed.topTodayGross?.today?.grossRevenue?.value ?? 0)}`}
                      secondary={`Invoices: ${computed.topTodayGross?.today?.invoiceCount?.value ?? 0}`}
                      pill={
                        <DeltaPill
                          delta={computed.topTodayGross?.today?.grossRevenue?.delta ?? 0}
                          deltaPctVal={computed.topTodayGross?.today?.grossRevenue?.deltaPct ?? 0}
                        />
                      }
                      tone="brand"
                    />

                    <StoreStatCard
                      title="Top gross • Month"
                      store={computed.topMonthGross}
                      primary={`₹${money(computed.topMonthGross?.month?.grossRevenue?.value ?? 0)}`}
                      secondary={`Invoices: ${computed.topMonthGross?.month?.invoiceCount?.value ?? 0}`}
                      pill={
                        <DeltaPill
                          delta={computed.topMonthGross?.month?.grossRevenue?.delta ?? 0}
                          deltaPctVal={computed.topMonthGross?.month?.grossRevenue?.deltaPct ?? 0}
                        />
                      }
                      tone="brand"
                    />

                    <StoreStatCard
                      title="Most unpaid • Today"
                      store={computed.mostUnpaid}
                      primary={`${computed.mostUnpaid?.today?.unpaidCount?.value ?? 0}`}
                      secondary={`Invoices: ${computed.mostUnpaid?.today?.invoiceCount?.value ?? 0}`}
                      pill={
                        <DeltaPill
                          delta={computed.mostUnpaid?.today?.unpaidCount?.delta ?? 0}
                          deltaPctVal={computed.mostUnpaid?.today?.unpaidCount?.deltaPct ?? 0}
                        />
                      }
                      tone="warning"
                    />
                  </div>
                </div>

                {/* Movers */}
                <div className="card card-pad space-y-3">
                  <SectionHeader
                    title="Top movers today"
                    subtitle="Sorted by Today gross Δ% (highest first) — quick follow-ups."
                  />

                  {/* Mobile cards */}
                  <div className="space-y-2 md:hidden">
                    {computed.moversToday.map((s) => {
                      const td = s.today?.grossRevenue;
                      const unpaid = s.today?.unpaidCount;
                      return (
                        <div key={s.id} className="panel p-4 space-y-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{s.name}</div>
                            <div className="text-xs muted truncate">{s.city ?? "—"}</div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="surface-muted p-3">
                              <div className="text-[11px] muted">Today Gross</div>
                              <div className="text-sm font-semibold">₹{money(td?.value ?? 0)}</div>
                            </div>
                            <div className="surface-muted p-3">
                              <div className="text-[11px] muted">Unpaid</div>
                              <div className="text-sm font-semibold">{unpaid?.value ?? 0}</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <DeltaPill delta={td?.delta ?? 0} deltaPctVal={td?.deltaPct ?? 0} />
                            <span className="badge badge-info">Δ% {pct(td?.deltaPct ?? null)}</span>
                          </div>
                        </div>
                      );
                    })}

                    {computed.moversToday.length === 0 ? (
                      <div className="panel p-4 text-sm muted">No store data yet.</div>
                    ) : null}
                  </div>

                  {/* Desktop dark table */}
                  <div className="hidden md:block">
                    <div className="table">
                      <div className="table-head grid-cols-12 px-4 py-3">
                        <div className="col-span-4">Store</div>
                        <div className="col-span-2 text-right">Today Gross</div>
                        <div className="col-span-2 text-right">Δ Gross</div>
                        <div className="col-span-2 text-right">Δ %</div>
                        <div className="col-span-2 text-right">Unpaid</div>
                      </div>

                      {computed.moversToday.map((s) => {
                        const td = s.today?.grossRevenue;
                        const unpaid = s.today?.unpaidCount;

                        return (
                          <div key={s.id} className="table-row grid-cols-12 px-4 py-3">
                            <div className="col-span-4 min-w-0">
                              <div className="text-sm font-medium truncate">{s.name}</div>
                              <div className="text-xs muted truncate">{s.city ?? "—"}</div>
                            </div>

                            <div className="col-span-2 text-right text-sm font-semibold">
                              ₹{money(td?.value ?? 0)}
                            </div>

                            <div className="col-span-2 text-right">
                              <DeltaPill delta={td?.delta ?? 0} deltaPctVal={td?.deltaPct ?? 0} />
                            </div>

                            <div className="col-span-2 text-right text-sm">
                              {pct(td?.deltaPct ?? null)}
                            </div>

                            <div className="col-span-2 text-right">
                              <span className="badge">{unpaid?.value ?? 0}</span>
                            </div>
                          </div>
                        );
                      })}

                      {computed.moversToday.length === 0 ? (
                        <div className="px-4 py-4 text-sm muted">No store data yet.</div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Per-store breakdown */}
                <div className="card card-pad space-y-3">
                  <SectionHeader
                    title="Per-store breakdown"
                    subtitle="Sorted by month gross revenue (top performers first)."
                  />

                  {/* Mobile cards */}
                  <div className="space-y-2 md:hidden">
                    {computed.sortedStoresByMonthGross.map((s) => {
                      const td = s.today?.grossRevenue;
                      const mo = s.month?.grossRevenue;

                      return (
                        <div key={s.id} className="panel p-4 space-y-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{s.name}</div>
                            <div className="text-xs muted truncate">{s.city ?? "—"}</div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="surface-muted p-3">
                              <div className="text-[11px] muted">Today Gross</div>
                              <div className="text-sm font-semibold">₹{money(td?.value ?? 0)}</div>
                              <div className="mt-2">
                                <DeltaPill delta={td?.delta ?? 0} deltaPctVal={td?.deltaPct ?? 0} />
                              </div>
                            </div>
                            <div className="surface-muted p-3">
                              <div className="text-[11px] muted">Month Gross</div>
                              <div className="text-sm font-semibold">₹{money(mo?.value ?? 0)}</div>
                              <div className="mt-2">
                                <DeltaPill delta={mo?.delta ?? 0} deltaPctVal={mo?.deltaPct ?? 0} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {computed.sortedStoresByMonthGross.length === 0 ? (
                      <div className="panel p-4 text-sm muted">No store data yet.</div>
                    ) : null}
                  </div>

                  {/* Desktop dark table */}
                  <div className="hidden md:block">
                    <div className="table">
                      <div className="table-head grid-cols-12 px-4 py-3">
                        <div className="col-span-4">Store</div>
                        <div className="col-span-2 text-right">Today Gross</div>
                        <div className="col-span-2 text-right">Δ vs prev</div>
                        <div className="col-span-2 text-right">Month Gross</div>
                        <div className="col-span-2 text-right">Δ vs last</div>
                      </div>

                      {computed.sortedStoresByMonthGross.map((s) => {
                        const td = s.today?.grossRevenue;
                        const mo = s.month?.grossRevenue;

                        return (
                          <div key={s.id} className="table-row grid-cols-12 px-4 py-3">
                            <div className="col-span-4 min-w-0">
                              <div className="text-sm font-medium truncate">{s.name}</div>
                              <div className="text-xs muted truncate">{s.city ?? "—"}</div>
                            </div>

                            <div className="col-span-2 text-right text-sm font-semibold">
                              ₹{money(td?.value ?? 0)}
                            </div>

                            <div className="col-span-2 text-right">
                              <DeltaPill delta={td?.delta ?? 0} deltaPctVal={td?.deltaPct ?? 0} />
                            </div>

                            <div className="col-span-2 text-right text-sm font-semibold">
                              ₹{money(mo?.value ?? 0)}
                            </div>

                            <div className="col-span-2 text-right">
                              <DeltaPill delta={mo?.delta ?? 0} deltaPctVal={mo?.deltaPct ?? 0} />
                            </div>
                          </div>
                        );
                      })}

                      {computed.sortedStoresByMonthGross.length === 0 ? (
                        <div className="px-4 py-4 text-sm muted">No store data yet.</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {/* Debug */}
            <details className="card card-pad">
              <summary className="text-sm cursor-pointer select-none">Debug JSON</summary>
              <pre
                className="mt-3 text-xs rounded-lg p-3 overflow-auto"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </>
        ) : null}
      </div>
    </main>
  );
}
