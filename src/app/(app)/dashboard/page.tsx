"use client";

import { useEffect, useMemo, useState } from "react";

function money(n: any) {
  const x = Number(n || 0);
  return x.toFixed(2);
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  // ✅ define start safely (fixes "start is not defined")
  const startLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString();
  }, []);

  async function load() {
    setErr(null);
    try {
      const activeStoreId =
        typeof window !== "undefined"
          ? localStorage.getItem("activeStoreId")
          : "";

      const qs = activeStoreId ? `?storeId=${encodeURIComponent(activeStoreId)}` : "";
      const res = await fetch(`/api/dashboard/metrics${qs}`, { credentials: "include" });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok) {
        setErr(data.error ?? "Failed to load dashboard metrics");
        setMetrics(null);
        return;
      }

      setMetrics(data.metrics ?? data);
    } catch (e: any) {
      setErr(e?.message ?? "Dashboard load error");
      setMetrics(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

return (
  <main className="p-4 md:p-6">
    <div className="page space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="h1">Dashboard</h1>
          <p className="subtle">Store metrics for: {startLabel}</p>
        </div>
        <span className="badge">Live</span>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      {!metrics && !err && (
        <div className="subtle">Loading metrics…</div>
      )}

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="card card-pad">
            <div className="subtle">Today Sales</div>
            <div className="kpi">₹{money(metrics.todaySales)}</div>
          </div>

          <div className="card card-pad">
            <div className="subtle">Invoices (Today)</div>
            <div className="kpi">{metrics.todayInvoiceCount ?? 0}</div>
          </div>

          <div className="card card-pad">
            <div className="subtle">Orders (Today)</div>
            <div className="kpi">{metrics.todayOrderCount ?? 0}</div>
          </div>
        </div>
      )}

      {/* Placeholder for next week */}
      <div className="card card-pad">
        <div className="h2">This week</div>
        <div className="subtle mt-1">
          Next: store-wise trends, payment split, and doctor productivity.
        </div>
      </div>
    </div>
  </main>
  );
}
