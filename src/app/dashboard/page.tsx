"use client";

import { useEffect, useState } from "react";

type MetricsResp = {
  store?: { id: string; name: string };
  metrics?: {
    invoicesToday: number;
    todaySalesGross: number;
    todaySalesPaid: number;
    unpaidInvoicesToday: number;
  };
  error?: string;
};

const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function DashboardPage() {
  const [data, setData] = useState<MetricsResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/metrics", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setData({ error: String(e) });
        setLoading(false);
      });
  }, []);

  return (
    <main className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-600">
          Today’s overview for your store
        </p>
      </div>

      {/* Store name */}
      <div>
        <div className="text-xs text-gray-500">Store</div>
        <div className="text-lg font-medium">
          {data?.store?.name ?? "—"}
        </div>
      </div>

      {/* Error */}
      {data?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {data.error}
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Invoices Today"
          value={
            loading ? "—" : String(data?.metrics?.invoicesToday ?? 0)
          }
        />

        <MetricCard
          title="Paid Sales Today"
          value={
            loading
              ? "—"
              : formatINR(data?.metrics?.todaySalesPaid ?? 0)
          }
        />

        <MetricCard
          title="Gross Sales Today"
          value={
            loading
              ? "—"
              : formatINR(data?.metrics?.todaySalesGross ?? 0)
          }
        />

        <MetricCard
          title="Unpaid Invoices"
          value={
            loading ? "—" : String(data?.metrics?.unpaidInvoicesToday ?? 0)
          }
        />
      </div>
    </main>
  );
}

/* ---------- Small reusable card ---------- */

function MetricCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
