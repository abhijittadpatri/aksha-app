"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { buildInvoiceWhatsAppMessage } from "@/lib/whatsapp";

function money(n: any) {
  const x = Number(n || 0);
  return x.toFixed(2);
}

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
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
    const paymentStatus = psRaw === "paid" ? "PAID" : "UNPAID";

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
      // fallback
      const ta = document.createElement("textarea");
      ta.value = waMessage;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setToast("Message copied ✅");
    }
  }

  const createdAtLabel = useMemo(() => {
    try {
      return invoice?.createdAt ? new Date(invoice.createdAt).toLocaleString() : "";
    } catch {
      return "";
    }
  }, [invoice?.createdAt]);

  return (
    <>
      <main className="p-4 md:p-6">
        <div className="page space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <Link className="text-sm underline" href="/invoices">
                ← Back to Invoices
              </Link>
              <div className="mt-2">
                <h1 className="h1 truncate">
                  {invoice?.invoiceNo ? `Invoice ${invoice.invoiceNo}` : "Invoice"}
                </h1>
                <p className="subtle truncate">
                  {invoice?.store?.name ? invoice.store.name : "Store"}{" "}
                  {createdAtLabel ? `• ${createdAtLabel}` : ""}
                </p>
              </div>
            </div>

            {/* Actions: mobile grid, desktop inline */}
            <div className="w-full md:w-auto">
              <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:justify-end">
                <button className="btn btn-ghost border" onClick={() => window.print()}>
                  Print
                </button>

                <button
                  className="btn btn-ghost border"
                  onClick={copyMessage}
                  disabled={!waMessage}
                  title={!waMessage ? "Invoice not loaded yet" : "Copy WhatsApp message"}
                >
                  Copy Message
                </button>

                <a
                  className={cls(
                    "btn",
                    hasMobile ? "btn-primary" : "btn-ghost border opacity-60 pointer-events-none"
                  )}
                  href={hasMobile ? waLink : "#"}
                  target="_blank"
                  rel="noreferrer"
                  title={hasMobile ? "Open WhatsApp with message" : "No patient mobile for WhatsApp"}
                >
                  WhatsApp
                </a>

                <button className="btn btn-ghost border" onClick={load} disabled={loading}>
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              {!hasMobile && invoice && (
                <div className="mt-2 text-xs text-gray-500">
                  WhatsApp disabled: patient mobile not available.
                </div>
              )}
            </div>
          </div>

          {/* Toast */}
          {toast && <div className="card card-pad text-sm">{toast}</div>}

          {/* Errors */}
          {err && <div className="text-sm text-red-600">{err}</div>}

          {/* Loading */}
          {loading && (
            <div className="card card-pad">
              <div className="h2">Loading invoice…</div>
              <div className="subtle">Please wait a second.</div>
            </div>
          )}

          {/* Content */}
          {invoice && !loading && (
            <div className="card card-pad print-card bg-white space-y-4">
              {/* Store + meta */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-semibold truncate">
                    {invoice.store?.name ?? "Store"}
                  </div>
                  <div className="subtle truncate">{invoice.store?.city ?? ""}</div>
                </div>

                <div className="text-right shrink-0">
                  <div className="badge">{invoice.invoiceNo}</div>
                  <div className="subtle mt-1 text-xs">{createdAtLabel}</div>
                </div>
              </div>

              {/* Billed To */}
              <div className="border-t pt-3">
                <div className="h2">Billed To</div>
                <div className="mt-1 text-sm font-medium truncate">
                  {invoice.patient?.name ?? "-"}
                </div>
                <div className="text-xs text-gray-600 truncate">
                  {invoice.patient?.mobile ?? ""}
                </div>
              </div>

              {/* Items: mobile cards */}
              <div className="border-t pt-3 space-y-2">
                <div className="h2">Items</div>

                {/* Mobile list */}
                <div className="space-y-2 md:hidden">
                  {items.map((it: any, idx: number) => {
                    const qty = Number(it.qty || 0);
                    const rate = Number(it.rate || 0);
                    const amt = qty * rate;

                    return (
                      <div key={idx} className="border rounded-xl p-3">
                        <div className="font-medium truncate">{it.name ?? "Item"}</div>
                        <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
                          <span>
                            Qty: <span className="font-medium">{qty}</span>
                          </span>
                          <span>
                            Rate: <span className="font-medium">₹{money(rate)}</span>
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-gray-600">Amount</span>
                          <span className="font-semibold">₹{money(amt)}</span>
                        </div>
                      </div>
                    );
                  })}

                  {items.length === 0 && (
                    <div className="p-3 text-sm text-gray-500 border rounded-xl">No items.</div>
                  )}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block border rounded-xl overflow-hidden bg-white">
                  <div className="grid grid-cols-4 bg-gray-50 text-sm p-2 font-medium">
                    <div className="col-span-2">Item</div>
                    <div className="text-right">Qty</div>
                    <div className="text-right">Amount</div>
                  </div>

                  {items.map((it: any, idx: number) => {
                    const qty = Number(it.qty || 0);
                    const rate = Number(it.rate || 0);
                    const amt = qty * rate;

                    return (
                      <div key={idx} className="grid grid-cols-4 text-sm p-2 border-t">
                        <div className="col-span-2">{it.name}</div>
                        <div className="text-right">{qty}</div>
                        <div className="text-right">₹{money(amt)}</div>
                      </div>
                    );
                  })}

                  {items.length === 0 && (
                    <div className="p-3 text-sm text-gray-500">No items.</div>
                  )}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-3">
                <div className="flex flex-col sm:flex-row sm:justify-end">
                  <div className="w-full sm:max-w-sm space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>₹{money(invoice.totalsJson?.subTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discount</span>
                      <span>₹{money(invoice.totalsJson?.discount)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-base">
                      <span>Total</span>
                      <span>₹{money(invoice.totalsJson?.total)}</span>
                    </div>
                    <div className="subtle text-xs">
                      Payment: {invoice.totalsJson?.paymentMode ?? "-"} •{" "}
                      {invoice.paymentStatus ?? "Unpaid"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center text-xs text-gray-600 pt-2 border-t">
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
          .print-card { border: none !important; box-shadow: none !important; }
        }
      `}</style>
    </>
  );
}
