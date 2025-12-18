"use client";

import { useEffect, useMemo, useState } from "react";

function money(n: any) {
  const x = Number(n || 0);
  return x.toFixed(2);
}

function pickNumber(obj: any, keys: string[], fallback = 0) {
  for (const k of keys) {
    const v = obj?.[k];
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [store, setStore] = useState<{ id: string; name: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString();
  }, []);

  function getActiveStoreId() {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("activeStoreId") || "";
  }

  async function load() {
    setErr(null);
    setLoading(true);

    try {
      const activeStoreId = getActiveStoreId();
      const qs = activeStoreId ? `?storeId=${encodeURIComponent(activeStoreId)}` : "";
      const res = await fetch(`/api/dashboard/metrics${qs}`, { credentials: "include" });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!res.ok) {
        setErr(data.error ?? "Failed to load dashboard metrics");
        setMetrics(null);
        setStore(null);
        setLoading(false);
        return;
      }

      setStore(data.store ?? null);
      setMetrics(data.metrics ?? data);
      setLoading(false);
    } catch (e: any) {
      setErr(e?.message ?? "Dashboard load error");
      setMetrics(null);
      setStore(null);
      setLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reload when store changes in localStorage (header select)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "activeStoreId") load();
    }
    window.addEventListener("storage", onStorage);

    // same-tab change: header sets localStorage but doesn't trigger "storage" in same tab
    // so we poll lightly (MVP safe)
    const t = setInterval(() => {
      // if store changes, reload
      const active = getActiveStoreId();
      const current = store?.id || "";
      if (active && active !== current) load();
    }, 1200);

    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  // Support both your metrics key variants (so we never break on API edits)
  const todaySalesGross = pickNumber(metrics, ["todaySalesGross", "todaySales", "salesToday"], 0);
  const todaySalesPaid = pickNumber(metrics, ["todaySalesPaid"], 0);
  const invoicesToday = pickNumber(metrics, ["invoicesToday", "todayInvoiceCount"], 0);
  const unpaidInvoicesToday = pickNumber(metrics, ["unpaidInvoicesToday"], 0);
  const ordersToday = pickNumber(metrics, ["todayOrderCount", "ordersToday"], 0);

  return (
    <main className="p-4 md:p-6">
      <div className="page space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="h1">Dashboard</h1>
            <p className="subtle">
              {store?.name ? (
                <>
                  {store.name} • <span className="opacity-80">{startLabel}</span>
                </>
              ) : (
                <>Store metrics for: {startLabel}</>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="badge">{loading ? "Updating…" : "Live"}</span>
            <button
              className="btn btn-ghost"
              onClick={load}
              disabled={loading}
              title="Refresh"
            >
              Refresh
            </button>
          </div>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        {!metrics && !err && (
          <div className="subtle">{loading ? "Loading metrics…" : "Loading…"}</div>
        )}

        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="card card-pad">
              <div className="subtle">Today Sales (Gross)</div>
              <div className="kpi">₹{money(todaySalesGross)}</div>
              <div className="text-xs text-gray-500 mt-1">
                Total billed today
              </div>
            </div>

            <div className="card card-pad">
              <div className="subtle">Today Sales (Paid)</div>
              <div className="kpi">₹{money(todaySalesPaid)}</div>
              <div className="text-xs text-gray-500 mt-1">
                Collected today
              </div>
            </div>

            <div className="card card-pad">
              <div className="subtle">Invoices (Today)</div>
              <div className="kpi">{invoicesToday}</div>
              <div className="text-xs text-gray-500 mt-1">
                Unpaid: {unpaidInvoicesToday}
              </div>
            </div>

            <div className="card card-pad">
              <div className="subtle">Orders (Today)</div>
              <div className="kpi">{ordersToday}</div>
              <div className="text-xs text-gray-500 mt-1">
                Next: order pipeline
              </div>
            </div>
          </div>
        )}

        <div className="card card-pad">
          <div className="h2">This week</div>
          <div className="subtle mt-1">
            Next: payment split (Cash/UPI/Card), unpaid aging, and staff productivity.
          </div>
        </div>
      </div>
    </main>
  );
}
