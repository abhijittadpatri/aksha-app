"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(n: any) {
  return safeNumber(n).toFixed(2);
}

function safeDate(d: any) {
  try {
    return d ? new Date(d).toLocaleString() : "";
  } catch {
    return "";
  }
}

type Me = {
  role: "ADMIN" | "SHOP_OWNER" | "DOCTOR" | "BILLING";
};

function paymentBadge(statusRaw: any) {
  const s = String(statusRaw ?? "Unpaid").toLowerCase();
  if (s === "paid") return <span className="badge badge-ok">Paid</span>;
  if (s === "partial") return <span className="badge badge-warn">Partial</span>;
  return <span className="badge badge-warn">Unpaid</span>;
}

export default function InvoicesPage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activeStoreId =
    typeof window !== "undefined" ? localStorage.getItem("activeStoreId") : "";

  const qs = useMemo(() => {
    if (!activeStoreId) return "";
    return `?storeId=${encodeURIComponent(activeStoreId)}`;
  }, [activeStoreId]);

  const canView = useMemo(() => {
    const role = me?.role;
    return role === "BILLING" || role === "ADMIN" || role === "SHOP_OWNER";
  }, [me?.role]);

  async function loadMe() {
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setMe((data.user as Me) ?? null);
    } catch {
      setMe(null);
    }
  }

  async function load() {
    setErr(null);
    setLoading(true);

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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    if (me === undefined) return;
    if (me === null) return;
    if (!canView) return;

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.role, qs]);

  // Redirect guards
  if (me === null) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }
  if (me && !canView) {
    if (typeof window !== "undefined") window.location.href = "/dashboard";
    return null;
  }

  const showStoreLine = activeStoreId === "all";

  return (
    <main className="p-4 md:p-6">
      <div className="page space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="h1">Invoices</h1>
            <p className="subtle truncate">
              Latest invoices{" "}
              {activeStoreId === "all"
                ? "(All Stores)"
                : activeStoreId
                ? ""
                : "(Select a store)"}
            </p>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <Link className="btn btn-secondary w-full md:w-auto" href="/patients">
              Go to Patients
            </Link>

            <button
              className="btn btn-secondary w-full md:w-auto"
              onClick={load}
              disabled={loading}
              type="button"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {err && <div className="text-sm text-red-400">{err}</div>}

        {/* Content */}
        <div className="card card-pad">
          {/* -------- Mobile (cards) -------- */}
          <div className="md:hidden space-y-3">
            {loading && invoices.length === 0 && !err && (
              <div className="text-sm muted">Loading invoices…</div>
            )}

            {invoices.map((inv) => {
              const total = inv?.totalsJson?.total ?? inv?.total ?? 0;
              const status = inv?.paymentStatus ?? inv?.totalsJson?.paymentStatus ?? "Unpaid";

              return (
                <div key={inv.id} className="panel p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {inv.invoiceNo ?? "Invoice"}
                      </div>
                      <div className="text-xs muted truncate">{safeDate(inv.createdAt)}</div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="font-semibold whitespace-nowrap">₹{money(total)}</div>
                      <div className="mt-1">{paymentBadge(status)}</div>
                    </div>
                  </div>

                  <div className="surface-muted p-3">
                    <div className="text-sm truncate">
                      <span className="muted">Patient: </span>
                      <span className="font-medium">{inv.patient?.name ?? "-"}</span>
                    </div>

                    {showStoreLine && inv.store?.name ? (
                      <div className="text-xs muted truncate mt-1">Store: {inv.store.name}</div>
                    ) : null}

                    <div className="mt-3 flex justify-end">
                      <Link className="btn btn-secondary btn-sm" href={`/invoices/${inv.id}`}>
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}

            {!loading && invoices.length === 0 && !err && (
              <div className="panel p-4 text-sm muted">No invoices yet.</div>
            )}
          </div>

          {/* -------- Desktop (table) -------- */}
          <div className="hidden md:block table">
            <div className="table-head grid-cols-12 p-3">
              <div className="col-span-3">Invoice</div>
              <div className="col-span-4">Patient</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Total</div>
              <div className="col-span-1 text-right">Open</div>
            </div>

            {loading && invoices.length === 0 && !err && (
              <div className="p-4 text-sm muted">Loading invoices…</div>
            )}

            {invoices.map((inv) => {
              const total = inv?.totalsJson?.total ?? inv?.total ?? 0;
              const status = inv?.paymentStatus ?? inv?.totalsJson?.paymentStatus ?? "Unpaid";

              return (
                <div key={inv.id} className="table-row grid-cols-12 p-3 items-center">
                  <div className="col-span-3 min-w-0">
                    <div className="font-medium truncate">{inv.invoiceNo ?? "Invoice"}</div>
                    <div className="text-xs muted truncate">{safeDate(inv.createdAt)}</div>
                  </div>

                  <div className="col-span-4 min-w-0">
                    <div className="truncate">{inv.patient?.name ?? "-"}</div>
                    {showStoreLine && inv.store?.name ? (
                      <div className="text-xs muted truncate">Store: {inv.store.name}</div>
                    ) : (
                      <div className="text-xs muted truncate">
                        {inv.store?.name ? `Store: ${inv.store.name}` : ""}
                      </div>
                    )}
                  </div>

                  <div className="col-span-2">{paymentBadge(status)}</div>

                  <div className="col-span-2 text-right font-medium whitespace-nowrap">
                    ₹{money(total)}
                  </div>

                  <div className="col-span-1 text-right">
                    <Link className="btn btn-secondary btn-sm" href={`/invoices/${inv.id}`}>
                      View
                    </Link>
                  </div>
                </div>
              );
            })}

            {!loading && invoices.length === 0 && !err && (
              <div className="p-6 text-sm muted">No invoices yet.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
