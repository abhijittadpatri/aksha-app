"use client";

import Link from "next/link";
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

type InsightsOverviewResponse = {
  scope?: { id?: string; name?: string };
  tenant?: { today?: AggBlock; month?: AggBlock };
};

type Me = {
  role: "ADMIN" | "SHOP_OWNER" | "DOCTOR" | "BILLING";
  tenant?: { name?: string | null } | null;
};

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
      // ✅ Use the stable endpoint you already have working
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
      // if query would change, refresh
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

  const deltaPill = (delta: number, deltaPctVal: number) => {
    const up = delta >= 0;
    return (
      <span
        className={cls(
          "text-[11px] px-2 py-1 rounded-full whitespace-nowrap",
          up ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
        )}
      >
        {signedMoney(delta)} ({pct(deltaPctVal)})
      </span>
    );
  };

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
              className="btn btn-ghost border"
              onClick={load}
              disabled={loading}
              title="Refresh"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        {!data && !err && (
          <div className="subtle">{loading ? "Loading…" : "No data yet."}</div>
        )}

        {data && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="card card-pad">
                <div className="subtle">Today • Gross</div>
                <div className="kpi">₹{money(tenantToday?.grossRevenue?.value ?? 0)}</div>
                <div className="mt-2">
                  {deltaPill(
                    tenantToday?.grossRevenue?.delta ?? 0,
                    tenantToday?.grossRevenue?.deltaPct ?? 0
                  )}
                </div>
              </div>

              <div className="card card-pad">
                <div className="subtle">Today • Paid</div>
                <div className="kpi">₹{money(tenantToday?.paidRevenue?.value ?? 0)}</div>
                <div className="mt-2">
                  {deltaPill(
                    tenantToday?.paidRevenue?.delta ?? 0,
                    tenantToday?.paidRevenue?.deltaPct ?? 0
                  )}
                </div>
              </div>

              <div className="card card-pad">
                <div className="subtle">Today • Invoices</div>
                <div className="kpi">{tenantToday?.invoiceCount?.value ?? 0}</div>
                <div className="mt-2">
                  <span className="text-xs text-gray-500">
                    Unpaid: {tenantToday?.unpaidCount?.value ?? 0}
                  </span>
                </div>
              </div>

              <div className="card card-pad">
                <div className="subtle">This Month • Gross</div>
                <div className="kpi">₹{money(tenantMonth?.grossRevenue?.value ?? 0)}</div>
                <div className="mt-2">
                  {deltaPill(
                    tenantMonth?.grossRevenue?.delta ?? 0,
                    tenantMonth?.grossRevenue?.deltaPct ?? 0
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card card-pad">
              <div className="h2">Quick actions</div>
              <div className="subtle mt-1">
                Jump to the most-used pages.
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {canSeePatients && (
                  <Link className="btn btn-primary" href="/patients">
                    Patients
                  </Link>
                )}
                {canSeeInvoices && (
                  <Link className="btn btn-ghost border" href="/invoices">
                    Invoices
                  </Link>
                )}
                {canSeeInsights && (
                  <Link className="btn btn-ghost border" href="/insights">
                    Insights
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
