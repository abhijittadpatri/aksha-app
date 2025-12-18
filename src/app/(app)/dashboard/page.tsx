"use client";

import { useEffect, useMemo, useState } from "react";

function money(n: any) {
  const x = Number(n || 0);
  return x.toFixed(2);
}

type MeUser = {
  id: string;
  role: string;
  tenant?: { name?: string };
  stores?: { id: string; name: string; city?: string | null }[];
};

export default function DashboardPage() {
  const [me, setMe] = useState<MeUser | null>(null);
  const [storeId, setStoreId] = useState<string>("");
  const [metrics, setMetrics] = useState<any>(null);
  const [storeLabel, setStoreLabel] = useState<string>("Store");
  const [err, setErr] = useState<string | null>(null);

  // Safe date label (fixes start not defined)
  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
  }, []);

  async function safeJson(res: Response) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  async function loadMe() {
    const res = await fetch("/api/me", { credentials: "include" });
    const data = await safeJson(res);
    setMe(data.user ?? null);

    // choose storeId for dashboard (supports ALL)
    const saved =
      typeof window !== "undefined" ? localStorage.getItem("dashboardStoreId") : null;

    const stores = (data.user?.stores ?? []) as any[];
    const canAll = stores.length > 1;

    if (saved) {
      setStoreId(saved);
      return;
    }

    if (canAll) {
      setStoreId("ALL");
      if (typeof window !== "undefined") localStorage.setItem("dashboardStoreId", "ALL");
    } else if (stores[0]?.id) {
      setStoreId(stores[0].id);
      if (typeof window !== "undefined") localStorage.setItem("dashboardStoreId", stores[0].id);
    } else {
      setStoreId("");
    }
  }

  async function loadMetrics(id: string) {
    setErr(null);
    setMetrics(null);

    const qs = id ? `?storeId=${encodeURIComponent(id)}` : "";
    const res = await fetch(`/api/dashboard/metrics${qs}`, { credentials: "include" });
    const data = await safeJson(res);

    if (!res.ok) {
      setErr(data.error ?? "Failed to load dashboard metrics");
      return;
    }

    setStoreLabel(data.store?.name ?? "Store");
    setMetrics(data.metrics ?? null);
  }

  useEffect(() => {
    loadMe().catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (!storeId) return;
    loadMetrics(storeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const storeOptions = me?.stores ?? [];
  const showAll = storeOptions.length > 1;

  return (
    <main className="p-4 md:p-6">
      <div className="page space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-[240px]">
            <h1 className="h1">Dashboard</h1>
            <p className="subtle">
              {storeLabel} • {todayLabel}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {me && (
              <span className="badge">
                {me.tenant?.name ?? "Tenant"} • {me.role}
              </span>
            )}

            {me && (showAll || storeOptions.length === 1) && (
              <select
                className="border rounded-lg px-3 py-2 text-sm bg-white"
                value={storeId}
                onChange={(e) => {
                  const v = e.target.value;
                  setStoreId(v);
                  if (typeof window !== "undefined") localStorage.setItem("dashboardStoreId", v);
                }}
                title="Select store for dashboard"
              >
                {showAll && <option value="ALL">All Stores</option>}
                {storeOptions.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.city ? `(${s.city})` : ""}
                  </option>
                ))}
              </select>
            )}

            <span className="badge">Live</span>
          </div>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        {!metrics && !err && <div className="subtle">Loading metrics…</div>}

        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="card card-pad">
              <div className="subtle">Today Gross Sales</div>
              <div className="kpi">₹{money(metrics.todaySalesGross)}</div>
              <div className="text-xs text-gray-500 mt-1">All invoices created today (IST)</div>
            </div>

            <div className="card card-pad">
              <div className="subtle">Paid Sales</div>
              <div className="kpi">₹{money(metrics.todaySalesPaid)}</div>
              <div className="text-xs text-gray-500 mt-1">paymentStatus = Paid</div>
            </div>

            <div className="card card-pad">
              <div className="subtle">Unpaid Sales</div>
              <div className="kpi">₹{money(metrics.todaySalesUnpaid)}</div>
              <div className="text-xs text-gray-500 mt-1">Gross − Paid</div>
            </div>

            <div className="card card-pad md:col-span-1">
              <div className="subtle">Invoices (Today)</div>
              <div className="kpi">{metrics.invoicesToday ?? 0}</div>
            </div>

            <div className="card card-pad md:col-span-1">
              <div className="subtle">Unpaid Invoices (Today)</div>
              <div className="kpi">{metrics.unpaidInvoicesToday ?? 0}</div>
            </div>

            <div className="card card-pad md:col-span-1">
              <div className="subtle">Next</div>
              <div className="text-sm mt-1">
                Week 2: All-stores view, unpaid list, and store-wise drilldown.
              </div>
            </div>
          </div>
        )}

        <div className="card card-pad">
          <div className="h2">Chain Owner View</div>
          <div className="subtle mt-1">
            You can switch to <b>All Stores</b> to see chain-wide daily totals. This is the Week 2 base for rollout.
          </div>
        </div>
      </div>
    </main>
  );
}
