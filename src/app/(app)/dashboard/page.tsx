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

function safeJson(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [store, setStore] = useState<{ id: string; name: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startLabel = useMemo(() => new Date().toLocaleDateString(), []);

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
      const data = safeJson(text);

      if (!res.ok) {
        setErr(data.error ?? "Failed to load dashboard metrics");
        setMetrics(null);
        setStore(null);
        return;
      }

      setStore(data.store ?? null);
      setMetrics(data.metrics ?? data);
    } catch (e: any) {
      setErr(e?.message ?? "Dashboard load error");
      setMetrics(null);
      setStore(null);
    } finally {
      setLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reload when store changes:
  // 1) other-tab localStorage changes -> "storage" event
  // 2) same-tab: we listen to a custom event we can dispatch anywhere
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "activeStoreId") load();
    }

    function onActiveStoreChanged() {
      load();
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener("activeStoreIdChanged", onActiveStoreChanged as any);

    // safety fallback: if something changes localStorage without dispatching event,
    // we do a very light check (no interval spam)
    let last = getActiveStoreId();
    const t = setInterval(() => {
      const now = getActiveStoreId();
      if (now !== last) {
        last = now;
        load();
      }
    }, 2500);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("activeStoreIdChanged", onActiveStoreChanged as any);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // metrics (support old/new keys)
  const todaySalesGross = pickNumber(metrics, ["todaySalesGross", "todaySales", "salesToday"], 0);
  const todaySalesPaid = pickNumber(metrics, ["todaySalesPaid"], 0);
  const invoicesToday = pickNumber(metrics, ["invoicesToday", "todayInvoiceCount"], 0);
  const unpaidInvoicesToday = pickNumber(metrics, ["unpaidInvoicesToday"], 0);
  const ordersToday = pickNumber(metrics, ["todayOrderCount", "ordersToday"], 0);

  const scopeText = store?.name
    ? store.name
    : getActiveStoreId() === "all"
    ? "All Stores"
    : "Store";

  return (
    <main className="p-4 md:p-6">
      <div className="page space-y-4">
        {/* Header: mobile stack, desktop row */}
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h1 className="h1">Dashboard</h1>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                {scopeText}
              </span>
              <span className="text-xs text-gray-500">{startLabel}</span>
              {loading ? (
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                  Updating…
                </span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                  Live
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className={cls(
                "border rounded-lg px-3 py-2 text-sm",
                loading && "opacity-60"
              )}
              onClick={load}
              disabled={loading}
              title="Refresh"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        {!metrics && !err && (
          <div className="subtle">{loading ? "Loading metrics…" : "Loading…"}</div>
        )}

        {metrics && (
          <>
            {/* KPIs: 2 columns on mobile, 4 on desktop */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="card card-pad">
                <div className="subtle">Today Gross</div>
                <div className="text-xl md:text-2xl font-semibold mt-1">
                  ₹{money(todaySalesGross)}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Total billed today
                </div>
              </div>

              <div className="card card-pad">
                <div className="subtle">Today Paid</div>
                <div className="text-xl md:text-2xl font-semibold mt-1">
                  ₹{money(todaySalesPaid)}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Collected today
                </div>
              </div>

              <div className="card card-pad">
                <div className="subtle">Invoices</div>
                <div className="text-xl md:text-2xl font-semibold mt-1">
                  {invoicesToday}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Unpaid: {unpaidInvoicesToday}
                </div>
              </div>

              <div className="card card-pad">
                <div className="subtle">Orders</div>
                <div className="text-xl md:text-2xl font-semibold mt-1">
                  {ordersToday}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Next: order pipeline
                </div>
              </div>
            </div>

            {/* Placeholder section: keep it compact on mobile */}
            <div className="card card-pad">
              <div className="h2">This week</div>
              <div className="subtle mt-1">
                Next: payment split (Cash/UPI/Card), unpaid aging, and staff productivity.
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
