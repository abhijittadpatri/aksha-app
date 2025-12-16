"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { buildInvoiceWhatsAppMessage } from "@/lib/whatsapp";

function money(n: any) {
  const x = Number(n || 0);
  return x.toFixed(2);
}

export default function InvoicePage() {
  const params = useParams<{ id: string }>();
  const invoiceId = (params?.id as string) || "";

  const [invoice, setInvoice] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setErr(null);
    if (!invoiceId) return;

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
      return;
    }

    setInvoice(data.invoice);
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
    const paymentStatus = (invoice.paymentStatus ?? "UNPAID") === "PAID" ? "PAID" : "UNPAID";

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
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = waMessage;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setToast("Message copied ✅");
    }
  }

  return (
    <>
      <main className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link className="underline text-sm" href="/patients">
            ← Back
          </Link>

          <div className="flex gap-2 flex-wrap justify-end">
            <button className="border px-3 py-2 rounded-lg text-sm" onClick={() => window.print()}>
              Print
            </button>

            {invoice ? (
              <>
                <button
                  className="border px-3 py-2 rounded-lg text-sm"
                  onClick={copyMessage}
                  disabled={!waMessage}
                  title={!waMessage ? "Invoice not loaded yet" : "Copy WhatsApp message"}
                >
                  Copy Message
                </button>

                {hasMobile ? (
                  <a
                    className="bg-black text-white px-3 py-2 rounded-lg text-sm"
                    href={waLink}
                    target="_blank"
                    rel="noreferrer"
                    title="Open WhatsApp with message"
                  >
                    Open WhatsApp
                  </a>
                ) : (
                  <span className="text-sm text-gray-500">No patient mobile for WhatsApp</span>
                )}
              </>
            ) : null}
          </div>
        </div>

        {toast && (
          <div className="rounded-lg border bg-green-50 p-2 text-sm text-green-800">
            {toast}
          </div>
        )}

        {err && <div className="text-sm text-red-600">{err}</div>}

        {invoice && (
          <div className="border rounded-xl p-4 space-y-3 print-card bg-white">
            <div className="flex justify-between">
              <div>
                <div className="text-lg font-semibold">{invoice.store?.name ?? "Store"}</div>
                <div className="text-sm text-gray-600">{invoice.store?.city ?? ""}</div>
              </div>
              <div className="text-right">
                <div className="font-medium">{invoice.invoiceNo}</div>
                <div className="text-sm text-gray-600">{new Date(invoice.createdAt).toLocaleString()}</div>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="font-medium">Billed To</div>
              <div className="text-sm">{invoice.patient?.name}</div>
              <div className="text-sm text-gray-600">{invoice.patient?.mobile ?? ""}</div>
            </div>

            <div className="border-t pt-3">
              <div className="font-medium mb-2">Items</div>
              <div className="border rounded-lg overflow-hidden">
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

            <div className="border-t pt-3 flex justify-end">
              <div className="w-full max-w-sm space-y-1 text-sm">
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
                <div className="text-xs text-gray-600">
                  Payment: {invoice.totalsJson?.paymentMode ?? "-"} • {invoice.paymentStatus ?? "UNPAID"}
                </div>
              </div>
            </div>

            <div className="text-center text-xs text-gray-600 pt-2 border-t">
              Thank you for visiting.
            </div>
          </div>
        )}
      </main>

      <style>{`
        @media print {
          a, button { display: none !important; }
          main { padding: 0 !important; }
          .print-card { border: none !important; }
        }
      `}</style>
    </>
  );
}
