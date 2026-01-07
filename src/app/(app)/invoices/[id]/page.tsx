"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { buildInvoiceWhatsAppMessage } from "@/lib/whatsapp";

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(n: any) {
  return safeNumber(n).toFixed(2);
}

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function safeDate(d: any) {
  try {
    return d ? new Date(d).toLocaleString() : "";
  } catch {
    return "";
  }
}

function paymentBadge(statusRaw: any) {
  const s = String(statusRaw ?? "Unpaid").toLowerCase();
  if (s === "paid") return <span className="badge badge-ok">Paid</span>;
  if (s === "partial") return <span className="badge badge-warn">Partial</span>;
  return <span className="badge badge-warn">Unpaid</span>;
}

export default function InvoicePage() {
  const params = useParams<{ id: string }>();
  const invoiceId = (params?.id as string) || "";

  const [invoice, setInvoice] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setErr(null);
    if (!invoiceId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { credentials: "include" });
      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!res.ok) {
        setErr(data.error ?? "Failed to load invoice");
        setInvoice(null);
        return;
      }

      setInvoice(data.invoice ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const items = invoice?.totalsJson?.items ?? [];

  const patientMobileRaw = invoice?.patient?.mobile ?? "";
  const patientMobile = String(patientMobileRaw).replace(/\D/g, "");
  const hasMobile = patientMobile.length >= 10;

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  const waMessage = useMemo(() => {
    if (!invoice) return "";
    const clinicOrStoreName = invoice.store?.name ?? "Aksha";
    const patientName = invoice.patient?.name ?? "Customer";
    const invoiceNo = invoice.invoiceNo ?? "Invoice";
    const amount = Number(invoice.totalsJson?.total ?? 0);
    const psRaw = String(invoice.paymentStatus ?? "Unpaid").toLowerCase();
    const paymentStatus =
      psRaw === "paid" ? "PAID" : psRaw === "partial" ? "PARTIAL" : "UNPAID";

    return buildInvoiceWhatsAppMessage({
      clinicOrStoreName,
      patientName,
      invoiceNo,
      amount,
      paymentStatus,
      invoiceUrl: currentUrl || "",
    });
  }, [invoice, currentUrl]);

  const waLink = useMemo(() => {
    if (!hasMobile) return "";
    const phone = patientMobile.startsWith("91") ? patientMobile : `91${patientMobile}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`;
  }, [hasMobile, patientMobile, waMessage]);

  async function copyMessage() {
    if (!waMessage) return;
    try {
      await navigator.clipboard.writeText(waMessage);
      setToast("Message copied ✅");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = waMessage;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setToast("Message copied ✅");
    }
  }

  const createdAtLabel = useMemo(() => safeDate(invoice?.createdAt), [invoice?.createdAt]);

  const totals = useMemo(() => {
    const subTotal = safeNumber(invoice?.totalsJson?.subTotal);
    const discount = safeNumber(invoice?.totalsJson?.discount);
    const total = safeNumber(invoice?.totalsJson?.total ?? invoice?.total);
    const mode = String(invoice?.totalsJson?.paymentMode ?? invoice?.paymentMode ?? "Cash");
    const status = String(invoice?.paymentStatus ?? invoice?.totalsJson?.paymentStatus ?? "Unpaid");
    return { subTotal, discount, total, mode, status };
  }, [invoice]);

  return (
    <>
      <main className="p-4 md:p-6">
        <div className="page space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <Link className="link text-sm" href="/invoices">
                ← Back to Invoices
              </Link>

              <div className="mt-2">
                <h1 className="h1 truncate">
                  {invoice?.invoiceNo ? `Invoice ${invoice.invoiceNo}` : "Invoice"}
                </h1>
                <p className="subtle truncate">
                  {invoice?.store?.name ? invoice.store.name : "Store"}
                  {createdAtLabel ? ` • ${createdAtLabel}` : ""}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="w-full md:w-auto">
              <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:justify-end">
                <button className="btn btn-secondary" onClick={() => window.print()} type="button">
                  Print
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={copyMessage}
                  disabled={!waMessage}
                  title={!waMessage ? "Invoice not loaded yet" : "Copy WhatsApp message"}
                  type="button"
                >
                  Copy Message
                </button>

                <a
                  className={cls(
                    "btn",
                    hasMobile ? "btn-primary" : "btn-secondary opacity-60 pointer-events-none"
                  )}
                  href={hasMobile ? waLink : "#"}
                  target="_blank"
                  rel="noreferrer"
                  title={hasMobile ? "Open WhatsApp with message" : "No patient mobile for WhatsApp"}
                >
                  WhatsApp
                </a>

                <button className="btn btn-secondary" onClick={load} disabled={loading} type="button">
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              {!hasMobile && invoice && (
                <div className="mt-2 text-xs muted">WhatsApp disabled: patient mobile not available.</div>
              )}
            </div>
          </div>

          {/* Toast */}
          {toast && <div className="panel p-3 text-sm">{toast}</div>}

          {/* Errors */}
          {err && <div className="text-sm text-red-400">{err}</div>}

          {/* Loading */}
          {loading && (
            <div className="card card-pad">
              <div className="h2">Loading invoice…</div>
              <div className="subtle">Please wait a second.</div>
            </div>
          )}

          {/* Content */}
          {invoice && !loading && (
            <div className="card card-pad print-card space-y-4">
              {/* Summary strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="panel p-4">
                  <div className="label">Total</div>
                  <div className="mt-1 text-2xl font-semibold">₹{money(totals.total)}</div>
                  <div className="mt-2 text-xs muted">
                    Subtotal ₹{money(totals.subTotal)} • Discount ₹{money(totals.discount)}
                  </div>
                </div>

                <div className="panel p-4">
                  <div className="label">Payment status</div>
                  <div className="mt-2">{paymentBadge(totals.status)}</div>
                  <div className="mt-2 text-xs muted">Mode: {totals.mode || "-"}</div>
                </div>

                <div className="panel p-4">
                  <div className="label">Store</div>
                  <div className="mt-1 text-lg font-semibold truncate">{invoice.store?.name ?? "Store"}</div>
                  <div className="mt-2 text-xs muted truncate">{invoice.store?.city ?? ""}</div>
                  <div className="mt-2 text-xs muted truncate">{createdAtLabel}</div>
                </div>
              </div>

              {/* Billed To */}
              <div className="panel p-4">
                <div className="h2">Billed To</div>
                <div className="mt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{invoice.patient?.name ?? "-"}</div>
                    <div className="text-xs muted truncate">{invoice.patient?.mobile ?? ""}</div>
                  </div>
                  <div className="shrink-0">
                    <span className="badge">{invoice.invoiceNo ?? "Invoice"}</span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="panel p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="h2">Items</div>
                  <div className="text-xs muted">{items.length} item(s)</div>
                </div>

                {/* Mobile items */}
                <div className="space-y-2 md:hidden">
                  {items.map((it: any, idx: number) => {
                    const qty = safeNumber(it.qty);
                    const rate = safeNumber(it.rate);
                    const amt = qty * rate;

                    return (
                      <div key={idx} className="surface-muted p-3">
                        <div className="font-medium truncate">{it.name ?? "Item"}</div>
                        <div className="mt-2 flex items-center justify-between text-xs muted">
                          <span>
                            Qty: <span className="text-[rgb(var(--fg))] font-medium">{qty}</span>
                          </span>
                          <span>
                            Rate: <span className="text-[rgb(var(--fg))] font-medium">₹{money(rate)}</span>
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs muted">Amount</span>
                          <span className="font-semibold">₹{money(amt)}</span>
                        </div>
                      </div>
                    );
                  })}

                  {items.length === 0 && <div className="surface-muted p-3 text-sm muted">No items.</div>}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block table">
                  <div className="table-head grid-cols-12 p-3">
                    <div className="col-span-7">Item</div>
                    <div className="col-span-2 text-right">Qty</div>
                    <div className="col-span-3 text-right">Amount</div>
                  </div>

                  {items.map((it: any, idx: number) => {
                    const qty = safeNumber(it.qty);
                    const rate = safeNumber(it.rate);
                    const amt = qty * rate;

                    return (
                      <div key={idx} className="table-row grid-cols-12 p-3 items-center">
                        <div className="col-span-7 min-w-0 truncate">{it.name ?? "Item"}</div>
                        <div className="col-span-2 text-right">{qty}</div>
                        <div className="col-span-3 text-right font-medium">₹{money(amt)}</div>
                      </div>
                    );
                  })}

                  {items.length === 0 && <div className="p-4 text-sm muted">No items.</div>}
                </div>
              </div>

              {/* Totals */}
              <div className="panel p-4">
                <div className="flex flex-col md:flex-row md:justify-end">
                  <div className="w-full md:max-w-sm space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="muted">Subtotal</span>
                      <span>₹{money(totals.subTotal)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="muted">Discount</span>
                      <span>₹{money(totals.discount)}</span>
                    </div>

                    <div className="flex justify-between text-base font-semibold">
                      <span>Total</span>
                      <span>₹{money(totals.total)}</span>
                    </div>

                    <div className="text-xs muted">
                      Payment mode: {totals.mode || "-"} • Status: {String(totals.status || "Unpaid")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center text-xs muted">
                Thank you for visiting.
              </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        @media print {
          a, button { display: none !important; }
          main { padding: 0 !important; }
          .print-card { border: none !important; box-shadow: none !important; background: white !important; color: #111 !important; }
          .print-card * { color: #111 !important; }
          .panel, .surface-muted, .table { border: 1px solid rgba(0,0,0,0.12) !important; background: white !important; box-shadow: none !important; }
          .badge { border: 1px solid rgba(0,0,0,0.12) !important; background: white !important; color: #111 !important; }
        }
      `}</style>
    </>
  );
}
