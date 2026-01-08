// src/app/(app)/patients/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";

/**
 * Patient Detail Page (UI simplified + fixed menus + proper modals)
 * ✅ Same endpoints + logic
 * ✅ Layout-level simplification across all tabs
 * ✅ Fix: React key warning (unique keys everywhere)
 * ✅ Fix: “More” menu not visible (portal popover avoids overflow clipping)
 * ✅ Restores a reusable Modal component (backdrop + header + body + footer)
 */

type Patient = {
  id: string;
  name: string;
  mobile?: string | null;
  age?: number | null;
  gender?: string | null;
  address?: string | null;
};

const TABS = ["Overview", "Prescriptions", "Orders", "Invoices"] as const;
type Tab = (typeof TABS)[number];

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function fmt(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

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

function statusBadge(kind: "ok" | "warn" | "danger" | "muted" | "info", text: string) {
  const k =
    kind === "ok"
      ? "badge badge-ok"
      : kind === "warn"
      ? "badge badge-warn"
      : kind === "danger"
      ? "badge badge-danger"
      : kind === "info"
      ? "badge badge-info"
      : "badge";
  return <span className={k}>{text}</span>;
}

function SegTab({
  active,
  label,
  meta,
  onClick,
}: {
  active: boolean;
  label: string;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls(
        "shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition",
        "focus-visible:outline-none",
        active
          ? "bg-[rgba(var(--brand),0.16)] text-[rgb(var(--fg))] shadow-[0_10px_24px_rgba(var(--brand),0.12)]"
          : "bg-[rgba(255,255,255,0.04)] text-[rgb(var(--fg-muted))] hover:bg-[rgba(255,255,255,0.07)] hover:text-[rgb(var(--fg))]"
      )}
      style={{ border: "1px solid rgba(255,255,255,0.10)" }}
    >
      <span className={cls(active ? "font-semibold" : "font-medium")}>{label}</span>

      {meta ? (
        <span
          className={cls(
            "text-[11px] px-2 py-[2px] rounded-full",
            active ? "text-[rgb(var(--fg))]" : "text-[rgb(var(--fg-muted))]"
          )}
          style={{
            background: active ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          {meta}
        </span>
      ) : null}
    </button>
  );
}

function KpiChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "info" | "ok" | "warn" | "danger";
}) {
  const glow =
    tone === "info"
      ? "rgba(var(--info),0.08)"
      : tone === "ok"
      ? "rgba(var(--success),0.08)"
      : tone === "warn"
      ? "rgba(var(--warning),0.10)"
      : tone === "danger"
      ? "rgba(var(--danger),0.10)"
      : "rgba(255,255,255,0.03)";

  return (
    <div
      className="surface-muted px-3 py-2 rounded-2xl"
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          `radial-gradient(600px 160px at 20% 0%, ${glow}, transparent 60%),` +
          "linear-gradient(180deg, rgba(var(--panel-2),0.92), rgba(var(--panel),0.90))",
      }}
    >
      <div className="text-[11px] muted">{label}</div>
      <div className="text-sm font-semibold" style={{ color: "rgb(var(--fg))" }}>
        {value}
      </div>
    </div>
  );
}

function RowCard({
  left,
  mid,
  right,
  bottom,
}: {
  left: React.ReactNode;
  mid?: React.ReactNode;
  right?: React.ReactNode;
  bottom?: React.ReactNode;
}) {
  // IMPORTANT: Do NOT clip popovers/menus. (Your global .panel had overflow:hidden.)
  return (
    <div className="panel p-4 space-y-3" style={{ overflow: "visible" }}>
      <div className="flex flex-col lg:flex-row lg:items-start gap-3">
        <div className="min-w-0 flex-1">{left}</div>
        {mid ? <div className="w-full lg:w-[360px] xl:w-[420px]">{mid}</div> : null}
        {right ? <div className="w-full lg:w-[220px]">{right}</div> : null}
      </div>
      {bottom ? <div>{bottom}</div> : null}
    </div>
  );
}

/** Portal popover (fixes “More expands but shows nothing” due to overflow clipping). */
function PopoverMenu({
  open,
  anchorEl,
  onClose,
  items,
}: {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  items: Array<{ id?: string; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }>;
}) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 240 });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    function compute() {
      const el = anchorEl;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = 240;
      const margin = 10;
      const left = Math.min(window.innerWidth - width - margin, Math.max(margin, r.right - width));
      const top = Math.min(window.innerHeight - margin, r.bottom + 8);
      setPos({ top, left, width });
    }

    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open, anchorEl]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const menu = (
    <>
      <div className="fixed inset-0 z-[80]" onMouseDown={onClose} />
      <div
        className="fixed z-[90] rounded-xl border p-1 shadow"
        style={{
          top: pos.top,
          left: pos.left,
          width: pos.width,
          background: "rgb(var(--panel))",
          borderColor: "rgba(255,255,255,0.10)",
          boxShadow: "0 18px 44px rgba(0,0,0,0.55)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {items.map((it, idx) => (
          <button
            key={it.id ?? `${it.label}-${idx}`}
            className={cls(
              "w-full text-left px-3 py-2 text-sm rounded-lg",
              it.disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-[rgba(255,255,255,0.06)]",
              it.danger ? "text-[rgb(var(--danger))]" : "text-[rgb(var(--fg))]"
            )}
            onClick={() => {
              if (it.disabled) return;
              it.onClick();
              onClose();
            }}
            type="button"
            disabled={it.disabled}
          >
            {it.label}
          </button>
        ))}
      </div>
    </>
  );

  return createPortal(menu, document.body);
}


/** Reusable Modal wrapper (restores the “missing modal component calling”). */
function Modal({
  open,
  title,
  subtitle,
  children,
  footer,
  onClose,
  maxWidthClass = "max-w-3xl",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  maxWidthClass?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 modal-backdrop" onMouseDown={onClose} />
      <div
        ref={containerRef}
        className={cls("w-full", maxWidthClass, "modal")}
        style={{ maxHeight: "86vh", overflow: "auto" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header px-5 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg font-semibold">{title}</div>
              {subtitle ? <div className="text-xs muted mt-1">{subtitle}</div> : null}
            </div>
            <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="modal-body px-5 pb-4">{children}</div>

        {footer ? <div className="modal-footer px-5 pb-5">{footer}</div> : null}
      </div>
    </div>
  );
}

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const patientId = (params?.id as string) || "";

  // ---- page state
  const [patient, setPatient] = useState<Patient | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [err, setErr] = useState<string | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);

  // ---- Prescriptions
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [rxErr, setRxErr] = useState<string | null>(null);
  const [rxOpen, setRxOpen] = useState(false);
  const [rxSaving, setRxSaving] = useState(false);

  // single rx form
  const [rSphere, setRSphere] = useState("");
  const [rCyl, setRCyl] = useState("");
  const [rAxis, setRAxis] = useState("");
  const [rAdd, setRAdd] = useState("");
  const [lSphere, setLSphere] = useState("");
  const [lCyl, setLCyl] = useState("");
  const [lAxis, setLAxis] = useState("");
  const [lAdd, setLAdd] = useState("");
  const [pd, setPd] = useState("");
  const [rxNotes, setRxNotes] = useState("");

  // ---- Orders
  const [orders, setOrders] = useState<any[]>([]);
  const [orderErr, setOrderErr] = useState<string | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);

  // split order inputs
  const [consultFee, setConsultFee] = useState("0");
  const [framesAmt, setFramesAmt] = useState("0");
  const [spectaclesAmt, setSpectaclesAmt] = useState("0");
  const [discountFlat, setDiscountFlat] = useState("0"); // ₹
  const [discountPct, setDiscountPct] = useState("0"); // %
  const [advancePaid, setAdvancePaid] = useState("0");
  const [orderNotes, setOrderNotes] = useState("");

  // ---- Invoices
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invErr, setInvErr] = useState<string | null>(null);
  const [invActionLoading, setInvActionLoading] = useState<string | null>(null); // invoiceId or orderId while action runs

  // ---- Payment modal
  const [payOpen, setPayOpen] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState<string>("");
  const [payTotal, setPayTotal] = useState<number>(0);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMode, setPayMode] = useState<string>("Cash");
  const [payErr, setPayErr] = useState<string | null>(null);
  const [paySaving, setPaySaving] = useState(false);

  // ---- UI helpers
  const [rxExpanded, setRxExpanded] = useState<Record<string, boolean>>({});
  const [orderMenuFor, setOrderMenuFor] = useState<string | null>(null);
  const [orderMenuAnchor, setOrderMenuAnchor] = useState<HTMLElement | null>(null);


  function getActiveStoreId() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("activeStoreId");
  }

  async function safeJson(res: Response) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  // ------------------- Loaders -------------------
  async function loadPatient() {
    setErr(null);
    if (!patientId) return;

    const res = await fetch(`/api/patients/${patientId}`, { credentials: "include" });
    const data = await safeJson(res);
    if (!res.ok) {
      setErr(data.error ?? "Failed to load patient");
      setPatient(null);
      return;
    }
    setPatient(data.patient ?? null);
  }

  async function loadPrescriptions() {
    setRxErr(null);
    if (!patientId) return;

    const res = await fetch(`/api/prescriptions?patientId=${patientId}`, { credentials: "include" });
    const data = await safeJson(res);

    if (!res.ok) {
      setRxErr(data.error ?? "Failed to load prescriptions");
      setPrescriptions([]);
      return;
    }
    setPrescriptions(data.prescriptions ?? []);
  }

  async function loadOrders() {
    setOrderErr(null);
    if (!patientId) return;

    const res = await fetch(`/api/orders?patientId=${patientId}`, { credentials: "include" });
    const data = await safeJson(res);

    if (!res.ok) {
      setOrderErr(data.error ?? "Failed to load orders");
      setOrders([]);
      return;
    }
    setOrders(data.orders ?? []);
  }

  async function loadInvoices() {
    setInvErr(null);
    if (!patientId) return;

    const storeId = getActiveStoreId();
    const storeParam = storeId ? `&storeId=${encodeURIComponent(storeId)}` : "";

    const res = await fetch(`/api/invoices?patientId=${patientId}${storeParam}`, { credentials: "include" });
    const data = await safeJson(res);

    if (!res.ok) {
      setInvErr(data.error ?? "Failed to load invoices");
      setInvoices([]);
      return;
    }
    setInvoices(data.invoices ?? []);
  }

  async function loadAll() {
    if (!patientId) return;
    setLoadingAll(true);
    try {
      await Promise.all([loadPatient(), loadPrescriptions(), loadOrders(), loadInvoices()]);
    } finally {
      setLoadingAll(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  // ------------------- Derived -------------------
  const latestRx = prescriptions?.[0] ?? null;
  const latestOrder = orders?.[0] ?? null;
  const latestInvoice = invoices?.[0] ?? null;

  const billedOrderIds = useMemo(() => new Set((invoices ?? []).map((iv) => String(iv.orderId))), [invoices]);

  const tabMeta = useMemo(() => {
    return {
      Prescriptions: String(prescriptions.length),
      Orders: String(orders.length),
      Invoices: String(invoices.length),
    } as Record<string, string>;
  }, [prescriptions.length, orders.length, invoices.length]);

  const headerMeta = useMemo(() => {
    if (!patient) return "";
    const parts: string[] = [];
    if (patient.mobile) parts.push(`📞 ${patient.mobile}`);
    if (patient.gender) parts.push(patient.gender);
    if (patient.age) parts.push(`${patient.age} yrs`);
    return parts.join(" • ");
  }, [patient]);

  function orderComputed(o: any) {
    const items = o?.itemsJson?.items ?? [];
    const breakdown = o?.itemsJson?.breakdown ?? {};
    const subTotal = items.reduce((s: number, it: any) => s + safeNumber(it.qty) * safeNumber(it.rate), 0);
    const disc = safeNumber(breakdown.discount ?? 0);
    const total = Math.max(0, subTotal - disc);
    const adv = safeNumber(breakdown.advancePaid ?? 0);
    const balance = Math.max(0, total - adv);
    return { items, breakdown, subTotal, disc, total, adv, balance };
  }

  // ------------------- Prescription actions -------------------
  function resetRxForm() {
    setRSphere("");
    setRCyl("");
    setRAxis("");
    setRAdd("");
    setLSphere("");
    setLCyl("");
    setLAxis("");
    setLAdd("");
    setPd("");
    setRxNotes("");
  }

  function copyRightToLeft() {
    setLSphere(rSphere);
    setLCyl(rCyl);
    setLAxis(rAxis);
    setLAdd(rAdd);
  }
  function copyLeftToRight() {
    setRSphere(lSphere);
    setRCyl(lCyl);
    setRAxis(lAxis);
    setRAdd(lAdd);
  }

  async function createPrescription() {
    setRxErr(null);
    const storeId = getActiveStoreId();
    if (!storeId) return setRxErr("No active store selected.");

    setRxSaving(true);
    try {
      const rxJson = {
        right: { sphere: rSphere, cyl: rCyl, axis: rAxis, add: rAdd },
        left: { sphere: lSphere, cyl: lCyl, axis: lAxis, add: lAdd },
        pd,
        notes: rxNotes,
        createdAt: new Date().toISOString(),
      };

      const res = await fetch("/api/prescriptions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, storeId, rxJson }),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        setRxErr(data.error ?? "Failed to create prescription");
        return;
      }

      setRxOpen(false);
      resetRxForm();
      await loadPrescriptions();
      setTab("Prescriptions");
    } finally {
      setRxSaving(false);
    }
  }

  // ------------------- Order actions -------------------
  function orderTotalsFromForm() {
    const consult = Math.max(0, safeNumber(consultFee));
    const frames = Math.max(0, safeNumber(framesAmt));
    const specs = Math.max(0, safeNumber(spectaclesAmt));

    const subTotal = consult + frames + specs;

    const discFlat = Math.max(0, safeNumber(discountFlat));
    const pct = Math.max(0, safeNumber(discountPct));
    const discPct = pct > 0 ? (subTotal * pct) / 100 : 0;
    const disc = Math.min(subTotal, discFlat + discPct);

    const total = Math.max(0, subTotal - disc);

    const adv = Math.max(0, safeNumber(advancePaid));
    const balance = Math.max(0, total - adv);

    return { consult, frames, specs, subTotal, discFlat, discPct, disc, pct, total, adv, balance };
  }

  function orderItemsFromForm() {
    const t = orderTotalsFromForm();

    const items = [
      { name: "Consultation Fee", qty: 1, rate: t.consult },
      { name: "Frames", qty: 1, rate: t.frames },
      { name: "Spectacles / Lenses", qty: 1, rate: t.specs },
    ].filter((x) => safeNumber(x.rate) > 0);

    const breakdown = {
      consultationFee: t.consult,
      frames: t.frames,
      spectacles: t.specs,
      discountFlat: t.discFlat,
      discountPct: t.pct,
      discount: t.disc,
      subTotal: t.subTotal,
      total: t.total,
      advancePaid: t.adv,
      balance: t.balance,
      notes: orderNotes || "",
    };

    return { items, breakdown };
  }

  function resetOrderForm() {
    setConsultFee("0");
    setFramesAmt("0");
    setSpectaclesAmt("0");
    setDiscountFlat("0");
    setDiscountPct("0");
    setAdvancePaid("0");
    setOrderNotes("");
  }

  async function createOrder() {
    setOrderErr(null);
    const storeId = getActiveStoreId();
    if (!storeId) return setOrderErr("No active store selected.");

    const latestRxId = prescriptions?.[0]?.id ?? null;
    const { items, breakdown } = orderItemsFromForm();
    const itemsJson = { items, breakdown };

    setOrderSaving(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          storeId,
          prescriptionId: latestRxId,
          itemsJson,
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        setOrderErr(data.error ?? "Failed to create order");
        return;
      }

      setOrderOpen(false);
      resetOrderForm();
      await loadOrders();
      setTab("Orders");
    } finally {
      setOrderSaving(false);
    }
  }

  async function updateOrderStatus(orderId: string, status: string) {
    if (!orderId) return;
    setOrderErr(null);
    setInvErr(null);
    setInvActionLoading(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        setInvErr(data.error ?? "Failed to update order status");
        return;
      }
      await loadOrders();
    } finally {
      setInvActionLoading(null);
    }
  }

  // ------------------- Invoice actions -------------------
  async function generateInvoiceForOrder(orderId: string) {
    try {
      setInvErr(null);
      const storeId = getActiveStoreId();
      if (!storeId) return setInvErr("Select a store in the header to generate invoice.");
      if (!orderId) return setInvErr("OrderId missing.");

      const order = orders.find((x) => String(x.id) === String(orderId));
      const discount = safeNumber(order?.itemsJson?.breakdown?.discount ?? 0);

      const res = await fetch("/api/invoices", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          storeId,
          orderId,
          discount,
          paid: false,
          paymentMode: "Cash",
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        const msg = data?.error ? String(data.error) : `HTTP ${res.status}`;
        setInvErr("Invoice error: " + msg);
        return;
      }

      if (data.invoice?.id) {
        window.location.href = `/invoices/${data.invoice.id}`;
        return;
      }

      await loadInvoices();
    } catch (e: any) {
      setInvErr("Invoice exception: " + (e?.message ?? String(e)));
    }
  }

  async function generateInvoiceFromLatestOrder() {
    const latestOrderId = orders?.[0]?.id;
    if (!latestOrderId) return setInvErr("No orders found. Create an order first.");
    return generateInvoiceForOrder(String(latestOrderId));
  }

  function invoiceTotal(inv: any) {
    const t = inv?.totalsJson?.total ?? inv?.total ?? 0;
    return safeNumber(t);
  }

  function invoicePaymentStatus(inv: any): "Paid" | "Partial" | "Unpaid" {
    const ps = String(inv?.paymentStatus ?? inv?.totalsJson?.paymentStatus ?? "Unpaid").toLowerCase();
    if (ps === "paid") return "Paid";
    if (ps === "partial") return "Partial";
    return "Unpaid";
  }

  function invoiceAmountPaid(inv: any) {
    const a = inv?.totalsJson?.amountPaid;
    if (a !== undefined) return safeNumber(a);
    const b = inv?.totalsJson?.paidAmount;
    if (b !== undefined) return safeNumber(b);
    return 0;
  }

  function openPaymentModal(inv: any) {
    const total = invoiceTotal(inv);
    const paid = invoiceAmountPaid(inv);
    const mode = String(inv?.totalsJson?.paymentMode ?? "Cash");

    setPayErr(null);
    setPayOpen(true);
    setPayInvoiceId(String(inv.id));
    setPayTotal(total);
    setPayAmount(String(paid || ""));
    setPayMode(mode || "Cash");
  }

  async function submitPayment() {
    setPayErr(null);
    if (!payInvoiceId) return setPayErr("Invoice not selected.");
    const amt = Math.max(0, safeNumber(payAmount));
    const mode = String(payMode || "Cash").trim() || "Cash";

    setPaySaving(true);
    try {
      const res = await fetch(`/api/invoices/${payInvoiceId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountPaid: amt, paymentMode: mode }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        setPayErr(data.error ?? "Failed to record payment.");
        return;
      }

      setPayOpen(false);
      setPayInvoiceId("");
      await loadInvoices();
      await loadOrders();
    } finally {
      setPaySaving(false);
    }
  }

  const invoiceByOrderId = useMemo(() => {
    const m = new Map<string, any>();
    (invoices ?? []).forEach((iv) => {
      if (iv?.orderId) m.set(String(iv.orderId), iv);
    });
    return m;
  }, [invoices]);

  // ------------------- Overview “next-step” model -------------------
  const overview = useMemo(() => {
    const rxDate = latestRx ? safeDate(latestRx.createdAt) : "";
    const oDate = latestOrder ? safeDate(latestOrder.createdAt) : "";
    const invDate = latestInvoice ? safeDate(latestInvoice.createdAt) : "";

    const oc = latestOrder ? orderComputed(latestOrder) : null;

    const invTotal = latestInvoice ? invoiceTotal(latestInvoice) : 0;
    const invPS = latestInvoice ? invoicePaymentStatus(latestInvoice) : "Unpaid";

    return {
      rx: {
        title: "Latest Prescription",
        value: rxDate || "No Rx yet",
        sub:
          latestRx && (latestRx.rxJson?.pd || latestRx.rxJson?.notes)
            ? `PD: ${fmt(latestRx.rxJson?.pd)} • Notes: ${fmt(latestRx.rxJson?.notes)}`
            : "Create a prescription to start.",
        pill: latestRx ? statusBadge("ok", "Ready") : statusBadge("muted", "Missing"),
        action: () => {
          setTab("Prescriptions");
          setRxOpen(true);
        },
        actionLabel: latestRx ? "Add new Rx" : "Create Rx",
      },
      order: {
        title: "Latest Order",
        value: oDate || "No order yet",
        sub: oc ? `Total ₹${money(oc.total)} • Balance ₹${money(oc.balance)}` : "Create an order (walk-in supported).",
        pill: latestOrder ? statusBadge("info", String(latestOrder.status ?? "Draft")) : statusBadge("muted", "Missing"),
        action: () => {
          setTab("Orders");
          setOrderOpen(true);
        },
        actionLabel: latestOrder ? "New order" : "Create order",
      },
      invoice: {
        title: "Latest Invoice",
        value: latestInvoice ? (latestInvoice.invoiceNo ?? "Invoice") : "No invoice yet",
        sub: latestInvoice ? `₹${money(invTotal)} • ${invDate}` : "Generate invoice from an order.",
        pill: latestInvoice
          ? invPS === "Paid"
            ? statusBadge("ok", "Paid")
            : invPS === "Partial"
            ? statusBadge("warn", "Partial")
            : statusBadge("warn", "Unpaid")
          : statusBadge("muted", "Missing"),
        action: () => {
          if (latestInvoice?.id) window.location.href = `/invoices/${latestInvoice.id}`;
          else generateInvoiceFromLatestOrder();
        },
        actionLabel: latestInvoice ? "Open invoice" : "Generate invoice",
      },
    };
  }, [latestRx, latestOrder, latestInvoice, prescriptions, orders, invoices]);

  const formTotals = useMemo(
    () => orderTotalsFromForm(),
    [consultFee, framesAmt, spectaclesAmt, discountFlat, discountPct, advancePaid]
  );

  // ------------------- Render -------------------
  return (
    <main className="p-4 md:p-6">
      <div className="page space-y-4">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0">
            <Link href="/patients" className="link text-sm">
              ← Back to Patients
            </Link>

            <h1 className="h1 mt-2 truncate">{patient?.name ?? "Patient"}</h1>
            {patient && <div className="subtle truncate">{headerMeta}</div>}
          </div>

          <div className="grid grid-cols-2 gap-2 w-full lg:w-auto">
            <button className="btn btn-secondary" onClick={loadAll} disabled={loadingAll} type="button">
              {loadingAll ? "Refreshing…" : "Refresh"}
            </button>

            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                setTab("Prescriptions");
                setRxOpen(true);
              }}
            >
              + New Prescription
            </button>
          </div>
        </div>

        {err && (
          <div className="panel p-3">
            <div className="text-sm" style={{ color: "rgb(var(--danger))" }}>
              {err}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="card card-pad">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <SegTab active={tab === "Overview"} label="Overview" onClick={() => setTab("Overview")} />
            <SegTab
              active={tab === "Prescriptions"}
              label="Prescriptions"
              meta={tabMeta.Prescriptions}
              onClick={() => setTab("Prescriptions")}
            />
            <SegTab active={tab === "Orders"} label="Orders" meta={tabMeta.Orders} onClick={() => setTab("Orders")} />
            <SegTab
              active={tab === "Invoices"}
              label="Invoices"
              meta={tabMeta.Invoices}
              onClick={() => setTab("Invoices")}
            />
          </div>
        </div>

        {/* Content wrapper */}
        <div className="card card-pad">
          {/* ================= OVERVIEW ================= */}
          {tab === "Overview" && (
            <div className="space-y-4">
              {/* Patient summary + next steps */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                <div className="panel p-4" style={{ overflow: "visible" }}>
                  <div className="label">Patient</div>
                  <div className="mt-1 text-lg font-semibold truncate">{patient?.name ?? "—"}</div>
                  <div className="mt-2 text-sm muted truncate">{patient?.address ?? "—"}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {patient?.mobile ? statusBadge("info", patient.mobile) : statusBadge("muted", "No mobile")}
                    {patient?.age ? statusBadge("muted", `${patient.age} yrs`) : null}
                    {patient?.gender ? statusBadge("muted", patient.gender) : null}
                  </div>
                  <div className="mt-3 text-xs muted">
                    Patient ID: {patient?.id ? String(patient.id).slice(-8) : "—"}
                  </div>
                </div>

                <div className="panel p-4 xl:col-span-2" style={{ overflow: "visible" }}>
                  <div className="text-sm font-semibold">Next steps</div>
                  <div className="mt-1 text-sm muted">Prescription → Order → Invoice → Payment → Delivery</div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      className="btn btn-primary w-full"
                      type="button"
                      onClick={() => {
                        setTab("Prescriptions");
                        setRxOpen(true);
                      }}
                    >
                      + Prescription
                    </button>

                    <button
                      className="btn btn-secondary w-full"
                      type="button"
                      onClick={() => {
                        setTab("Orders");
                        setOrderOpen(true);
                      }}
                    >
                      + Order
                    </button>

                    <button className="btn btn-outline w-full" type="button" onClick={generateInvoiceFromLatestOrder}>
                      + Invoice (latest order)
                    </button>
                  </div>

                  <div className="mt-2 text-[11px] muted">Walk-in supported: you can create an order even without Rx.</div>
                </div>
              </div>

              {/* Latest items */}
              <div className="space-y-3">
                {(["rx", "order", "invoice"] as const).map((k) => {
                  const c = overview[k];
                  return (
                    <RowCard
                      key={k}
                      left={
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-sm font-semibold">{c.title}</div>
                            <div className="shrink-0">{c.pill}</div>
                          </div>
                          <div className="text-xs muted truncate">{c.value}</div>
                          <div className="text-sm mt-1" style={{ color: "rgb(var(--fg-muted))" }}>
                            {c.sub}
                          </div>
                        </div>
                      }
                      right={
                        <div className="flex lg:justify-end">
                          <button className="btn btn-secondary w-full lg:w-auto" type="button" onClick={c.action}>
                            {c.actionLabel}
                          </button>
                        </div>
                      }
                    />
                  );
                })}
              </div>

              {/* Operational shortcuts */}
              {latestOrder?.id ? (
                <div className="panel p-4" style={{ overflow: "visible" }}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">Operational status</div>
                      <div className="text-sm muted">
                        Latest order:{" "}
                        <span style={{ color: "rgb(var(--fg))", fontWeight: 600 }}>{fmt(latestOrder.status ?? "Draft")}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        disabled={invActionLoading === String(latestOrder.id)}
                        onClick={() => updateOrderStatus(String(latestOrder.id), "Ready")}
                      >
                        Mark Ready
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        disabled={invActionLoading === String(latestOrder.id)}
                        onClick={() => updateOrderStatus(String(latestOrder.id), "Delivered")}
                      >
                        Mark Delivered
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* ================= PRESCRIPTIONS ================= */}
          {tab === "Prescriptions" && (
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="h2">Prescriptions</div>

                <div className="grid grid-cols-2 gap-2 md:flex md:justify-end">
                  <button className="btn btn-secondary" type="button" onClick={loadPrescriptions}>
                    Refresh
                  </button>
                  <button className="btn btn-primary" type="button" onClick={() => setRxOpen(true)}>
                    + Add Rx
                  </button>
                </div>
              </div>

              {rxErr && (
                <div className="panel p-3">
                  <div className="text-sm" style={{ color: "rgb(var(--danger))" }}>
                    {rxErr}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {prescriptions.map((rx) => {
                  const rxId = String(rx.id);
                  const expanded = !!rxExpanded[rxId];
                  const right = rx.rxJson?.right ?? {};
                  const left = rx.rxJson?.left ?? {};
                  const pdVal = fmt(rx.rxJson?.pd);
                  const notesVal = fmt(rx.rxJson?.notes);

                  return (
                    <RowCard
                      key={rxId}
                      left={
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-sm font-semibold">Prescription</div>
                            {statusBadge("info", "Rx")}
                            <div className="text-xs muted">{safeDate(rx.createdAt)}</div>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="badge">PD: {pdVal}</span>
                            {notesVal !== "—" ? <span className="badge">Notes: {notesVal}</span> : null}
                          </div>
                        </div>
                      }
                      mid={
                        <div className="grid grid-cols-1 gap-2">
                          <KpiChip
                            label="OD (Right)"
                            value={`S ${fmt(right.sphere)} • C ${fmt(right.cyl)} • A ${fmt(right.axis)} • Add ${fmt(right.add)}`}
                            tone="info"
                          />
                          <KpiChip
                            label="OS (Left)"
                            value={`S ${fmt(left.sphere)} • C ${fmt(left.cyl)} • A ${fmt(left.axis)} • Add ${fmt(left.add)}`}
                            tone="neutral"
                          />
                        </div>
                      }
                      right={
                        <div className="flex lg:justify-end gap-2">
                          <button
                            className="btn btn-secondary btn-sm w-full lg:w-auto"
                            type="button"
                            onClick={() => setRxExpanded((m) => ({ ...m, [rxId]: !expanded }))}
                          >
                            {expanded ? "Hide details" : "View details"}
                          </button>
                        </div>
                      }
                      bottom={
                        expanded ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="surface-muted p-3">
                              <div className="font-medium text-sm mb-2">Right (OD)</div>
                              <div className="text-sm">Sphere: {fmt(right.sphere)}</div>
                              <div className="text-sm">Cyl: {fmt(right.cyl)}</div>
                              <div className="text-sm">Axis: {fmt(right.axis)}</div>
                              <div className="text-sm">Add: {fmt(right.add)}</div>
                            </div>

                            <div className="surface-muted p-3">
                              <div className="font-medium text-sm mb-2">Left (OS)</div>
                              <div className="text-sm">Sphere: {fmt(left.sphere)}</div>
                              <div className="text-sm">Cyl: {fmt(left.cyl)}</div>
                              <div className="text-sm">Axis: {fmt(left.axis)}</div>
                              <div className="text-sm">Add: {fmt(left.add)}</div>
                            </div>
                          </div>
                        ) : null
                      }
                    />
                  );
                })}

                {prescriptions.length === 0 && <div className="panel p-4 text-sm muted">No prescriptions yet.</div>}
              </div>
            </div>
          )}

          {/* ================= ORDERS ================= */}
          {tab === "Orders" && (
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="h2">Orders</div>

                <div className="grid grid-cols-2 gap-2 md:flex md:justify-end">
                  <button className="btn btn-primary" type="button" onClick={() => setOrderOpen(true)}>
                    + Create Order
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={loadOrders}>
                    Refresh
                  </button>
                </div>
              </div>

              {orderErr && (
                <div className="panel p-3">
                  <div className="text-sm" style={{ color: "rgb(var(--danger))" }}>
                    {orderErr}
                  </div>
                </div>
              )}
              {invErr && (
                <div className="panel p-3">
                  <div className="text-sm" style={{ color: "rgb(var(--danger))" }}>
                    {invErr}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {orders.map((o) => {
                  const orderId = String(o.id);
                  const billed = billedOrderIds.has(orderId);
                  const oc = orderComputed(o);

                  const inv = invoiceByOrderId.get(orderId) ?? null;
                  const invPS = inv ? invoicePaymentStatus(inv) : null;
                  const invTotal = inv ? invoiceTotal(inv) : 0;

                  // balance display derived from invoice status
                  let displayBalance = oc.balance;
                  if (inv) {
                    const paidAmt = invoiceAmountPaid(inv);
                    const totalAmt = invoiceTotal(inv);
                    const ps = invoicePaymentStatus(inv);
                    if (ps === "Paid") displayBalance = 0;
                    else if (ps === "Partial") displayBalance = Math.max(0, totalAmt - paidAmt);
                  }

                  // single primary CTA based on state
                  let primaryLabel = "Generate Invoice";
                  let primaryAction = () => generateInvoiceForOrder(orderId);
                  let primaryKind: "primary" | "secondary" = "primary";

                  if (billed && inv?.id) {
                    if (invPS === "Paid") {
                      primaryLabel = "Open Invoice";
                      primaryAction = () => (window.location.href = `/invoices/${inv.id}`);
                      primaryKind = "secondary";
                    } else {
                      primaryLabel = "Record Payment";
                      primaryAction = () => openPaymentModal(inv);
                      primaryKind = "primary";
                    }
                  }

                  // pills with guaranteed unique keys (fixes React warning)
                  const pills: Array<{ key: string; node: React.ReactNode }> = [
                    { key: `o-status-${orderId}`, node: o.status ? <span className="badge">{String(o.status)}</span> : null },
                    { key: `o-billed-${orderId}`, node: billed ? statusBadge("ok", "Billed") : statusBadge("warn", "Unbilled") },
                    ...(invPS
                      ? [
                          {
                            key: `o-pay-${orderId}`,
                            node:
                              invPS === "Paid"
                                ? statusBadge("ok", "Paid")
                                : invPS === "Partial"
                                ? statusBadge("warn", "Partial")
                                : statusBadge("warn", "Unpaid"),
                          },
                        ]
                      : []),
                  ].filter((p) => p.node != null);

                  return (
                    <RowCard
                      key={orderId}
                      left={
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {pills.map((p) => (
                              <span key={p.key}>{p.node}</span>
                            ))}
                          </div>

                          <div className="mt-1 text-sm font-semibold">Order</div>
                          <div className="text-xs muted truncate">
                            {safeDate(o.createdAt)} • Order ID: {String(o.id).slice(-6)} • Rx: {o.prescriptionId ?? "—"}
                          </div>

                          {inv?.invoiceNo ? (
                            <div className="text-xs muted truncate">
                              Invoice:{" "}
                              <span style={{ color: "rgb(var(--fg))", fontWeight: 600 }}>{inv.invoiceNo}</span> • ₹{money(invTotal)}
                            </div>
                          ) : (
                            <div className="text-xs muted truncate">Invoice: —</div>
                          )}
                        </div>
                      }
                      mid={
                        <div className="grid grid-cols-3 gap-2">
                          <KpiChip label="Total" value={`₹${money(inv ? invTotal : oc.total)}`} tone="info" />
                          <KpiChip label="Advance/Paid" value={`₹${money(inv ? invoiceAmountPaid(inv) : oc.adv)}`} tone="ok" />
                          <KpiChip
                            label="Balance"
                            value={`₹${money(displayBalance)}`}
                            tone={displayBalance <= 0 ? "ok" : "warn"}
                          />
                        </div>
                      }
                      right={
                        <div className="flex flex-col gap-2 lg:items-end">
                          <button
                            className={cls("btn w-full", primaryKind === "primary" ? "btn-primary" : "btn-secondary")}
                            type="button"
                            onClick={primaryAction}
                            disabled={invActionLoading === orderId}
                          >
                            {invActionLoading === orderId ? "Working…" : primaryLabel}
                          </button>

                          <button
                            className="btn btn-ghost w-full"
                            type="button"
                            onClick={(e) => {
                              const nextId = orderMenuFor === orderId ? null : orderId;
                              setOrderMenuFor(nextId);
                              setOrderMenuAnchor(nextId ? (e.currentTarget as HTMLElement) : null);
                            }}
                          >
                            More •••
                          </button>

                          <PopoverMenu
                            open={orderMenuFor === orderId}
                            anchorEl={orderMenuAnchor}
                            onClose={() => {
                              setOrderMenuFor(null);
                              setOrderMenuAnchor(null);
                            }}
                            items={[
                              {
                                id: `ready-${orderId}`,
                                label: "Mark Ready",
                                onClick: () => updateOrderStatus(orderId, "Ready"),
                                disabled: invActionLoading === orderId,
                              },
                              {
                                id: `delivered-${orderId}`,
                                label: "Mark Delivered",
                                onClick: () => updateOrderStatus(orderId, "Delivered"),
                                disabled: invActionLoading === orderId,
                              },
                              ...(inv?.id
                                ? [
                                    {
                                      id: `openinv-${orderId}`,
                                      label: "Open Invoice",
                                      onClick: () => (window.location.href = `/invoices/${inv.id}`),
                                    },
                                  ]
                                : []),
                            ]}
                          />

                        </div>
                      }
                      bottom={
                        oc.breakdown?.notes ? (
                          <div className="surface-muted p-3">
                            <div className="text-xs muted mb-1">Notes</div>
                            <div className="text-sm" style={{ color: "rgb(var(--fg-muted))" }}>
                              {String(oc.breakdown.notes)}
                            </div>
                          </div>
                        ) : null
                      }
                    />
                  );
                })}

                {orders.length === 0 && <div className="panel p-4 text-sm muted">No orders yet.</div>}
              </div>
            </div>
          )}

          {/* ================= INVOICES ================= */}
          {tab === "Invoices" && (
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="h2">Invoices</div>

                <div className="grid grid-cols-2 gap-2 md:flex md:justify-end">
                  <button className="btn btn-primary" type="button" onClick={generateInvoiceFromLatestOrder}>
                    Generate (Latest Order)
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={loadInvoices}>
                    Refresh
                  </button>
                </div>
              </div>

              {invErr && (
                <div className="panel p-3">
                  <div className="text-sm" style={{ color: "rgb(var(--danger))" }}>
                    {invErr}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {invoices.map((inv) => {
                  const invId = String(inv.id);
                  const total = invoiceTotal(inv);
                  const ps = invoicePaymentStatus(inv);
                  const paidAmt = invoiceAmountPaid(inv);
                  const balance = Math.max(0, total - paidAmt);
                  const paymentMode = String(inv?.totalsJson?.paymentMode ?? "Cash");
                  const orderId = inv?.orderId ?? "";

                  const pill =
                    ps === "Paid"
                      ? statusBadge("ok", "Paid")
                      : ps === "Partial"
                      ? statusBadge("warn", "Partial")
                      : statusBadge("warn", "Unpaid");

                  return (
                    <RowCard
                      key={invId}
                      left={
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-sm font-semibold truncate">{inv.invoiceNo ?? "Invoice"}</div>
                            <span key={`pill-${invId}`}>{pill}</span>
                          </div>
                          <div className="text-xs muted truncate">
                            {safeDate(inv.createdAt)} • Mode: {paymentMode} • Order: {orderId ? String(orderId).slice(-6) : "—"}
                          </div>
                        </div>
                      }
                      mid={
                        <div className="grid grid-cols-3 gap-2">
                          <KpiChip label="Total" value={`₹${money(total)}`} tone="info" />
                          <KpiChip label="Paid" value={`₹${money(paidAmt)}`} tone="ok" />
                          <KpiChip label="Balance" value={`₹${money(balance)}`} tone={balance <= 0 ? "ok" : "warn"} />
                        </div>
                      }
                      right={
                        <div className="flex flex-col gap-2 lg:items-end">
                          <a className="btn btn-secondary w-full" href={`/invoices/${invId}`}>
                            Open
                          </a>

                          {ps !== "Paid" ? (
                            <button className="btn btn-primary w-full" type="button" onClick={() => openPaymentModal(inv)}>
                              Record Payment
                            </button>
                          ) : (
                            <button className="btn btn-ghost w-full" type="button" disabled>
                              Paid
                            </button>
                          )}
                        </div>
                      }
                    />
                  );
                })}

                {invoices.length === 0 && <div className="panel p-4 text-sm muted">No invoices yet.</div>}
              </div>
            </div>
          )}
        </div>

        {/* ================= Rx Modal ================= */}
        <Modal
          open={rxOpen}
          title="New Prescription"
          subtitle="Single form • OD & OS • Copy between eyes"
          onClose={() => {
            if (rxSaving) return;
            setRxOpen(false);
            setRxErr(null);
          }}
          footer={
            <div className="flex flex-col md:flex-row gap-2">
              <button className="btn btn-primary w-full" onClick={createPrescription} disabled={rxSaving} type="button">
                {rxSaving ? "Saving..." : "Save Prescription"}
              </button>

              <button
                className="btn btn-secondary w-full"
                type="button"
                onClick={() => {
                  if (rxSaving) return;
                  resetRxForm();
                  setRxErr(null);
                }}
              >
                Clear
              </button>

              <div className="w-full md:w-auto md:ml-auto text-xs muted self-center">
                Tip: If both eyes are same, fill one side and use “Copy”.
              </div>
            </div>
          }
        >
          {rxErr && (
            <div className="panel p-3 mb-3">
              <div className="text-sm" style={{ color: "rgb(var(--danger))" }}>
                {rxErr}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="panel p-3 space-y-2" style={{ overflow: "visible" }}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">Right Eye (OD)</div>
                <button className="btn btn-secondary btn-sm" type="button" onClick={copyRightToLeft}>
                  Copy → Left
                </button>
              </div>
              <input className="input" placeholder="Sphere" value={rSphere} onChange={(e) => setRSphere(e.target.value)} />
              <input className="input" placeholder="Cyl" value={rCyl} onChange={(e) => setRCyl(e.target.value)} />
              <input className="input" placeholder="Axis" value={rAxis} onChange={(e) => setRAxis(e.target.value)} />
              <input className="input" placeholder="Add" value={rAdd} onChange={(e) => setRAdd(e.target.value)} />
            </div>

            <div className="panel p-3 space-y-2" style={{ overflow: "visible" }}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">Left Eye (OS)</div>
                <button className="btn btn-secondary btn-sm" type="button" onClick={copyLeftToRight}>
                  Copy → Right
                </button>
              </div>
              <input className="input" placeholder="Sphere" value={lSphere} onChange={(e) => setLSphere(e.target.value)} />
              <input className="input" placeholder="Cyl" value={lCyl} onChange={(e) => setLCyl(e.target.value)} />
              <input className="input" placeholder="Axis" value={lAxis} onChange={(e) => setLAxis(e.target.value)} />
              <input className="input" placeholder="Add" value={lAdd} onChange={(e) => setLAdd(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <input className="input" placeholder="PD" value={pd} onChange={(e) => setPd(e.target.value)} />
            <input className="input" placeholder="Notes" value={rxNotes} onChange={(e) => setRxNotes(e.target.value)} />
          </div>
        </Modal>

        {/* ================= Order Modal ================= */}
        <Modal
          open={orderOpen}
          title="Create Order"
          subtitle="Split amounts • Auto balance • Walk-in supported"
          onClose={() => {
            if (orderSaving) return;
            setOrderOpen(false);
            setOrderErr(null);
          }}
          footer={
            <div className="flex flex-col md:flex-row gap-2">
              <button className="btn btn-primary w-full" onClick={createOrder} disabled={orderSaving} type="button">
                {orderSaving ? "Saving..." : "Save Order (Draft)"}
              </button>

              <button
                className="btn btn-secondary w-full"
                type="button"
                onClick={() => {
                  if (orderSaving) return;
                  resetOrderForm();
                  setOrderErr(null);
                }}
              >
                Clear
              </button>

              <div className="w-full md:w-auto md:ml-auto text-xs muted self-center">
                Order links to the latest prescription automatically (if present).
              </div>
            </div>
          }
        >
          {orderErr && (
            <div className="panel p-3 mb-3">
              <div className="text-sm" style={{ color: "rgb(var(--danger))" }}>
                {orderErr}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="label mb-1">Consultation Fee</div>
              <input className="input" value={consultFee} onChange={(e) => setConsultFee(e.target.value)} placeholder="0" inputMode="decimal" />
            </div>
            <div>
              <div className="label mb-1">Frames</div>
              <input className="input" value={framesAmt} onChange={(e) => setFramesAmt(e.target.value)} placeholder="0" inputMode="decimal" />
            </div>
            <div>
              <div className="label mb-1">Spectacles / Lenses</div>
              <input
                className="input"
                value={spectaclesAmt}
                onChange={(e) => setSpectaclesAmt(e.target.value)}
                placeholder="0"
                inputMode="decimal"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div>
              <div className="label mb-1">Discount (Flat ₹)</div>
              <input className="input" value={discountFlat} onChange={(e) => setDiscountFlat(e.target.value)} placeholder="0" inputMode="decimal" />
            </div>
            <div>
              <div className="label mb-1">Discount (%)</div>
              <input className="input" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} placeholder="0" inputMode="decimal" />
            </div>
            <div>
              <div className="label mb-1">Advance Paid</div>
              <input className="input" value={advancePaid} onChange={(e) => setAdvancePaid(e.target.value)} placeholder="0" inputMode="decimal" />
            </div>
          </div>

          <div className="mt-3">
            <div className="label mb-1">Notes</div>
            <input className="input" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Optional" />
          </div>

          <div className="panel p-3 mt-3" style={{ overflow: "visible" }}>
            <div className="text-sm font-semibold">Summary</div>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
              {[
                { label: "Subtotal", value: `₹${money(formTotals.subTotal)}`, tone: "neutral" as const },
                { label: "Discount", value: `₹${money(formTotals.disc)}`, tone: "warn" as const },
                { label: "Total", value: `₹${money(formTotals.total)}`, tone: "info" as const },
                { label: "Advance", value: `₹${money(formTotals.adv)}`, tone: "ok" as const },
                { label: "Balance", value: `₹${money(formTotals.balance)}`, tone: formTotals.balance <= 0 ? ("ok" as const) : ("warn" as const) },
                { label: "Discount %", value: `${money(formTotals.pct)}%`, tone: "neutral" as const },
              ].map((x) => (
                <div key={x.label} className="surface-muted p-2">
                  <div className="text-xs muted">{x.label}</div>
                  <div className="font-semibold">{x.value}</div>
                </div>
              ))}
            </div>
          </div>
        </Modal>

        {/* ================= Payment Modal ================= */}
        <Modal
          open={payOpen}
          title="Record Payment"
          subtitle={`Total ₹${money(payTotal)} • Updates invoice Paid/Partial/Unpaid`}
          maxWidthClass="max-w-lg"
          onClose={() => {
            if (paySaving) return;
            setPayOpen(false);
          }}
          footer={
            <div className="flex flex-col sm:flex-row gap-2">
              <button className="btn btn-secondary w-full" type="button" onClick={() => setPayAmount(String(payTotal))} disabled={paySaving}>
                Mark paid (full)
              </button>

              <button className="btn btn-primary w-full" type="button" onClick={submitPayment} disabled={paySaving}>
                {paySaving ? "Saving…" : "Save payment"}
              </button>

              <div className="w-full sm:w-auto sm:ml-auto text-xs muted self-center">
                After saving, Orders will reflect Paid/Partial/Unpaid for this order.
              </div>
            </div>
          }
        >
          {payErr && (
            <div className="panel p-3 mb-3">
              <div className="text-sm" style={{ color: "rgb(var(--danger))" }}>
                {payErr}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="label mb-1">Amount paid</div>
              <input className="input" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0" />
              <div className="text-[11px] muted mt-1">Tip: For full payment, use “Mark paid (full)”.</div>
            </div>

            <div>
              <div className="label mb-1">Payment mode</div>
              <select className="input" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                <option>Cash</option>
                <option>UPI</option>
                <option>Card</option>
                <option>Other</option>
              </select>
            </div>
          </div>
        </Modal>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </main>
  );
}
