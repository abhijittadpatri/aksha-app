"use client";

import Link from "next/link";
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

type InsightsOverviewResponse = {
  scope?: { id?: string; name?: string };
  tenant?: { today?: AggBlock; month?: AggBlock };
};

type Me = {
  role: "ADMIN" | "SHOP_OWNER" | "DOCTOR" | "BILLING";
  tenant?: { name?: string | null } | null;
};

function DeltaPill({ delta, deltaPctVal }: { delta: number; deltaPctVal: number }) {
  const up = safeNumber(delta) >= 0;
  return (
    <span className={cls("badge", up ? "badge-ok" : "badge-danger")}>
      {signedMoney(delta)} ({pct(deltaPctVal)})
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
  delta,
  deltaPctVal,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  deltaPctVal?: number;
}) {
  return (
    <div className="panel p-4">
      <div className="label">{label}</div>

      {/* Big number should never truncate */}
      <div className="kpi mt-2 leading-tight break-words">{value}</div>

      {/* Delta goes UNDER the number (prevents squish/truncation) */}
      {delta !== undefined && deltaPctVal !== undefined ? (
        <div className="mt-2">
          <DeltaPill delta={delta} deltaPctVal={deltaPctVal} />
        </div>
      ) : null}

      {hint ? <div className="mt-2 text-xs muted">{hint}</div> : null}
    </div>
  );
}


export default function DashboardPage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [data, setData] = useState<InsightsOverviewResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activeStoreId =
    typeof window !== "undefined" ? localStorage.getItem("activeStoreId") : "";

  const qs = useMemo(() => {
    if (!activeStoreId) return "";
    return `?storeId=${encodeURIComponent(activeStoreId)}`;
  }, [activeStoreId]);

  async function loadMe() {
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      setMe((json.user as Me) ?? null);
    } catch {
      setMe(null);
    }
  }

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
        setErr(json.error ?? "Failed to load dashboard");
        setData(null);
        setLoading(false);
        return;
      }

      setData(json);
      setLoading(false);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load dashboard");
      setData(null);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    if (me === undefined) return;
    if (me === null) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.role, qs]);

  // Reload when store changes in other tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "activeStoreId") load();
    }
    window.addEventListener("storage", onStorage);

    // Same-tab changes: lightweight poll (keeps MVP simple)
    const t = setInterval(() => {
      const current = localStorage.getItem("activeStoreId") || "";
      if (current !== (activeStoreId || "")) load();
    }, 1400);

    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStoreId]);

  // Redirect guards
  if (me === null) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }

  const tenantToday = data?.tenant?.today;
  const tenantMonth = data?.tenant?.month;

  const scopeLabel =
    (data?.scope?.id === "all" ? "All Stores" : data?.scope?.name) ??
    (activeStoreId === "all" ? "All Stores" : "Store");

  const canSeeInsights = me?.role === "ADMIN" || me?.role === "SHOP_OWNER";
  const canSeePatients =
    me?.role === "ADMIN" ||
    me?.role === "SHOP_OWNER" ||
    me?.role === "DOCTOR" ||
    me?.role === "BILLING";
  const canSeeInvoices =
    me?.role === "ADMIN" || me?.role === "SHOP_OWNER" || me?.role === "BILLING";

  return (
    <main className="p-4 md:p-6">
      <div className="page space-y-4">
        {/* Header */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="h1">Dashboard</h1>
            <p className="subtle truncate">
              Scope: {scopeLabel}
              {me?.tenant?.name ? ` • ${me.tenant.name}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn btn-secondary"
              onClick={load}
              disabled={loading}
              title="Refresh"
              type="button"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {err && <div className="text-sm text-red-400">{err}</div>}

        {!data && !err && (
          <div className="panel p-4">
            <div className="h2">{loading ? "Loading…" : "No data yet."}</div>
            <div className="subtle mt-1">
              {activeStoreId ? "If this looks wrong, try Refresh." : "Select a store in the sidebar."}
            </div>
          </div>
        )}

        {data && (
          <>
            {/* KPI grid */}
            <div className="card card-pad">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="h2">Overview</div>
                  <div className="subtle mt-1">
                    Today and month-to-date performance for the selected scope.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="badge">Today</span>
                  <span className="badge">This Month</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <StatCard
                  label="Today • Gross"
                  value={`₹${money(tenantToday?.grossRevenue?.value ?? 0)}`}
                  delta={tenantToday?.grossRevenue?.delta ?? 0}
                  deltaPctVal={tenantToday?.grossRevenue?.deltaPct ?? 0}
                  hint="Total billed (before payment status)."
                />

                <StatCard
                  label="Today • Paid"
                  value={`₹${money(tenantToday?.paidRevenue?.value ?? 0)}`}
                  delta={tenantToday?.paidRevenue?.delta ?? 0}
                  deltaPctVal={tenantToday?.paidRevenue?.deltaPct ?? 0}
                  hint="Collected amount for today."
                />

                <StatCard
                  label="Today • Invoices"
                  value={`${tenantToday?.invoiceCount?.value ?? 0}`}
                  hint={`Unpaid: ${tenantToday?.unpaidCount?.value ?? 0}`}
                />

                <StatCard
                  label="This Month • Gross"
                  value={`₹${money(tenantMonth?.grossRevenue?.value ?? 0)}`}
                  delta={tenantMonth?.grossRevenue?.delta ?? 0}
                  deltaPctVal={tenantMonth?.grossRevenue?.deltaPct ?? 0}
                  hint="Month-to-date billed revenue."
                />
              </div>

              {/* Secondary stats */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="surface-muted p-4">
                  <div className="label">This Month • Paid Revenue</div>
                  <div className="mt-1 text-xl font-semibold">
                    ₹{money(tenantMonth?.paidRevenue?.value ?? 0)}
                  </div>
                  <div className="mt-2">
                    <DeltaPill
                      delta={tenantMonth?.paidRevenue?.delta ?? 0}
                      deltaPctVal={tenantMonth?.paidRevenue?.deltaPct ?? 0}
                    />
                  </div>
                </div>

                <div className="surface-muted p-4">
                  <div className="label">This Month • Avg Invoice</div>
                  <div className="mt-1 text-xl font-semibold">
                    ₹{money(tenantMonth?.avgInvoiceValue?.value ?? 0)}
                  </div>
                  <div className="mt-2">
                    <DeltaPill
                      delta={tenantMonth?.avgInvoiceValue?.delta ?? 0}
                      deltaPctVal={tenantMonth?.avgInvoiceValue?.deltaPct ?? 0}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card card-pad">
              <div className="h2">Quick actions</div>
              <div className="subtle mt-1">Jump to the most-used pages.</div>

              <div className="mt-3 flex flex-wrap gap-2">
                {canSeePatients && (
                  <Link className="btn btn-primary" href="/patients">
                    Patients
                  </Link>
                )}

                {canSeeInvoices && (
                  <Link className="btn btn-secondary" href="/invoices">
                    Invoices
                  </Link>
                )}

                {canSeeInsights && (
                  <Link className="btn btn-outline" href="/insights">
                    Insights
                  </Link>
                )}
              </div>

              {!activeStoreId ? (
                <div className="mt-3 text-xs muted">
                  Tip: Select an active store from the sidebar to see accurate totals.
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
