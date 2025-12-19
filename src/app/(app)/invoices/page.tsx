"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function money(n: any) {
  const x = Number(n || 0);
  return x.toFixed(2);
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const activeStoreId =
    typeof window !== "undefined" ? localStorage.getItem("activeStoreId") : "";

  const qs = useMemo(() => {
    if (!activeStoreId) return "";
    return `?storeId=${encodeURIComponent(activeStoreId)}`;
  }, [activeStoreId]);

  async function load() {
    setErr(null);
    try {
      const res = await fetch(`/api/invoices${qs}`, { credentials: "include" });
      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!res.ok) {
        setErr(data.error ?? "Failed to load invoices");
        setInvoices([]);
        return;
      }

      setInvoices(data.invoices ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load invoices");
      setInvoices([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  return (
    <main className="p-4 md:p-6">
      <div className="page space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="h1">Invoices</h1>
            <p className="subtle">
              Latest invoices {activeStoreId === "all" ? "(All Stores)" : ""}
            </p>
          </div>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        <div className="card card-pad">
          <div className="border rounded-xl overflow-hidden bg-white">
            <div className="grid grid-cols-5 bg-gray-50 text-sm font-medium p-3">
              <div>Invoice</div>
              <div>Patient</div>
              <div>Status</div>
              <div className="text-right">Total</div>
              <div className="text-right">Open</div>
            </div>

            {invoices.map((inv) => (
              <div key={inv.id} className="grid grid-cols-5 p-3 text-sm border-t">
                <div className="min-w-0">
                  <div className="font-medium truncate">{inv.invoiceNo ?? "Invoice"}</div>
                  <div className="text-xs text-gray-500">
                    {inv.createdAt ? new Date(inv.createdAt).toLocaleString() : ""}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="truncate">{inv.patient?.name ?? "-"}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {inv.store?.name ? `Store: ${inv.store.name}` : ""}
                  </div>
                </div>

                <div>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
                    {inv.paymentStatus ?? "Unpaid"}
                  </span>
                </div>

                <div className="text-right font-medium">
                  ₹{money(inv.totalsJson?.total ?? inv.total ?? 0)}
                </div>

                <div className="text-right">
                  <Link className="underline" href={`/invoices/${inv.id}`}>
                    View
                  </Link>
                </div>
              </div>
            ))}

            {invoices.length === 0 && !err && (
              <div className="p-4 text-sm text-gray-500">No invoices yet.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
