"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createPortal } from "react-dom";

import Modal from "@/components/ui/Modal";

// Adjust this import path to wherever you saved the helpers you pasted.
// Example: "@/components/patients/patientUi" or "@/lib/ui/patientUi"
import {
  cls,
  fmt,
  safeDate,
  safeNumber,
  money,
  statusBadge,
  KpiChip,
  RowCard,
} from "@/components/patients/patientUi";

/**
 * Patient Detail - Workflow Driven (No Tabs)
 *
 * Workflow:
 *  - Prescription optional (can be skipped)
 *  - Create Order
 *  - Generate Invoice
 *  - Record Payment (partial allowed)
 *  - Mark Ready / Delivered
 *
 * Goals:
 *  - Shorter file
 *  - Less branching
 *  - Use reusable Modal + helpers
 *  - Same endpoints/logic
 */

type Patient = {
  id: string;
  name: string;
  mobile?: string | null;
  age?: number | null;
  gender?: string | null;
  address?: string | null;
};

type WorkflowState =
  | "NO_ACTIVE_ORDER"
  | "ORDER_ACTIVE"
  | "INVOICED"
  | "PAYMENT_PARTIAL"
  | "PAID"
  | "DELIVERED";

// -------------------- UI: Popover menu (portal) --------------------
function PopoverMenu({
  open,
  anchorEl,
  onClose,
  items,
}: {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  items: Array<{ id: string; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }>;
}) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 240,
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    function compute() {
      if (!anchorEl) return;
      const r = anchorEl.getBoundingClientRect();
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
        {items.map((it) => (
          <button
            key={it.id}
            className={cls(
              "w-full text-left px-3 py-2 text-sm rounded-lg",
              it.disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-[rgba(255,255,255,0.06)]",
              it.danger ? "text-[rgb(var(--danger))]" : "text-[rgb(var(--fg))]"
            )}
            type="button"
            disabled={it.disabled}
            onClick={() => {
              if (it.disabled) return;
              it.onClick();
              onClose();
            }}
          >
            {it.label}
          </button>
        ))}
      </div>
    </>
  );

  return createPortal(menu, document.body);
}

// -------------------- helpers (page local) --------------------
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

// -------------------- Page --------------------
export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const patientId = (params?.id as string) || "";

  // core data
  const [patient, setPatient] = useState<Patient | null>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  // misc
  const [err, setErr] = useState<string | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ui: order menu
  const [orderMenuOpenFor, setOrderMenuOpenFor] = useState<string | null>(null);
  const [orderMenuAnchor, setOrderMenuAnchor] = useState<HTMLElement | null>(null);

  // modal: prescription
  const [rxOpen, setRxOpen] = useState(false);
  const [rxSaving, setRxSaving] = useState(false);
  const [rxErr, setRxErr] = useState<string | null>(null);

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

  // modal: order
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderErr, setOrderErr] = useState<string | null>(null);

  const [consultFee, setConsultFee] = useState("0");
  const [framesAmt, setFramesAmt] = useState("0");
  const [spectaclesAmt, setSpectaclesAmt] = useState("0");
  const [discountFlat, setDiscountFlat] = useState("0");
  const [discountPct, setDiscountPct] = useState("0");
  const [advancePaid, setAdvancePaid] = useState("0");
  const [orderNotes, setOrderNotes] = useState("");

  // modal: payment
  const [payOpen, setPayOpen] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState("");
  const [payTotal, setPayTotal] = useState(0);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("Cash");
  const [payErr, setPayErr] = useState<string | null>(null);
  const [paySaving, setPaySaving] = useState(false);

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
    if (!patientId) return;

    const storeId = getActiveStoreId();
    const storeParam = storeId ? `&storeId=${encodeURIComponent(storeId)}` : "";

    const res = await fetch(`/api/invoices?patientId=${patientId}${storeParam}`, { credentials: "include" });
    const data = await safeJson(res);

    if (!res.ok) {
      // show in main area (since invoice is a workflow step)
      setErr(data.error ?? "Failed to load invoices");
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

  // ------------------- Derived workflow -------------------
  const latestRx = prescriptions?.[0] ?? null;

  const invoiceByOrderId = useMemo(() => {
    const m = new Map<string, any>();
    (invoices ?? []).forEach((iv) => {
      if (iv?.orderId) m.set(String(iv.orderId), iv);
    });
    return m;
  }, [invoices]);

  const activeOrder = useMemo(() => {
    if (!orders?.length) return null;
    const o = orders[0];
    return String(o.status) === "Delivered" ? null : o;
  }, [orders]);

  const activeInvoice = useMemo(() => {
    if (!activeOrder) return null;
    return invoiceByOrderId.get(String(activeOrder.id)) ?? null;
  }, [activeOrder, invoiceByOrderId]);

  const workflowState: WorkflowState = useMemo(() => {
    if (!activeOrder) return "NO_ACTIVE_ORDER";
    if (!activeInvoice) return "ORDER_ACTIVE";

    const total = invoiceTotal(activeInvoice);
    const paid = invoiceAmountPaid(activeInvoice);

    if (paid <= 0) return "INVOICED";
    if (paid < total) return "PAYMENT_PARTIAL";
    return String(activeOrder.status) === "Delivered" ? "DELIVERED" : "PAID";
  }, [activeOrder, activeInvoice]);

  const headerMeta = useMemo(() => {
    if (!patient) return "";
    const parts: string[] = [];
    if (patient.mobile) parts.push(`📞 ${patient.mobile}`);
    if (patient.gender) parts.push(patient.gender);
    if (patient.age) parts.push(`${patient.age} yrs`);
    return parts.join(" • ");
  }, [patient]);

  // ------------------- Actions -------------------
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
    } finally {
      setRxSaving(false);
    }
  }

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

    // Rx optional: attach latest if present
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
      await loadInvoices();
    } finally {
      setOrderSaving(false);
    }
  }

  async function updateOrderStatus(orderId: string, status: string) {
    if (!orderId) return;
    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        setErr(data.error ?? "Failed to update order status");
        return;
      }
      await loadOrders();
    } finally {
      setActionLoading(null);
    }
  }

  async function generateInvoiceForOrder(orderId: string) {
    try {
      setErr(null);
      const storeId = getActiveStoreId();
      if (!storeId) return setErr("Select a store in the header to generate invoice.");
      if (!orderId) return setErr("OrderId missing.");

      const order = orders.find((x) => String(x.id) === String(orderId));
      const discount = safeNumber(order?.itemsJson?.breakdown?.discount ?? 0);

      setActionLoading(orderId);

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
        setErr("Invoice error: " + msg);
        return;
      }

      if (data.invoice?.id) {
        window.location.href = `/invoices/${data.invoice.id}`;
        return;
      }

      await loadInvoices();
    } catch (e: any) {
      setErr("Invoice exception: " + (e?.message ?? String(e)));
    } finally {
      setActionLoading(null);
    }
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

  // ------------------- Workflow card decisions -------------------
  const workflowCard = useMemo(() => {
    const rxInfo = latestRx
      ? `PD: ${fmt(latestRx?.rxJson?.pd)} • Notes: ${fmt(latestRx?.rxJson?.notes)}`
      : "Prescription is optional. You can skip and create an order directly.";

    const orderInfo = activeOrder
      ? (() => {
          const oc = orderComputed(activeOrder);
          return `Total ₹${money(oc.total)} • Balance ₹${money(oc.balance)} • Status: ${fmt(activeOrder.status ?? "Draft")}`;
        })()
      : "No active order. Create an order to proceed.";

    const invInfo = activeInvoice
      ? (() => {
          const total = invoiceTotal(activeInvoice);
          const paid = invoiceAmountPaid(activeInvoice);
          const bal = Math.max(0, total - paid);
          const ps = invoicePaymentStatus(activeInvoice);
          return `Invoice ${fmt(activeInvoice.invoiceNo ?? "")} • ₹${money(total)} • Paid ₹${money(paid)} • Balance ₹${money(
            bal
          )} • ${ps}`;
        })()
      : "No invoice yet. Generate invoice after creating an order.";

    // Primary CTA depends on workflowState
    let primaryLabel = "Create Order";
    let primaryAction = () => setOrderOpen(true);
    let primaryKind: "primary" | "secondary" = "primary";

    if (workflowState === "NO_ACTIVE_ORDER") {
      primaryLabel = "Create Order";
      primaryAction = () => setOrderOpen(true);
      primaryKind = "primary";
    } else if (workflowState === "ORDER_ACTIVE") {
      primaryLabel = "Generate Invoice";
      primaryAction = () => activeOrder?.id && generateInvoiceForOrder(String(activeOrder.id));
      primaryKind = "primary";
    } else if (workflowState === "INVOICED" || workflowState === "PAYMENT_PARTIAL") {
      primaryLabel = "Record Payment";
      primaryAction = () => activeInvoice && openPaymentModal(activeInvoice);
      primaryKind = "primary";
    } else if (workflowState === "PAID") {
      primaryLabel = "Mark Ready";
      primaryAction = () => activeOrder?.id && updateOrderStatus(String(activeOrder.id), "Ready");
      primaryKind = "secondary";
    }

    return {
      rxInfo,
      orderInfo,
      invInfo,
      primaryLabel,
      primaryAction,
      primaryKind,
    };
  }, [latestRx, activeOrder, activeInvoice, workflowState]);

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

            <button className="btn btn-primary" type="button" onClick={() => setOrderOpen(true)}>
              + Create Order
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

        {/* Patient summary */}
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
            <div className="mt-3 text-xs muted">Patient ID: {patient?.id ? String(patient.id).slice(-8) : "—"}</div>
          </div>

          <div className="panel p-4 xl:col-span-2" style={{ overflow: "visible" }}>
            <div className="text-sm font-semibold">Workflow</div>
            <div className="mt-1 text-sm muted">Prescription (optional) → Order → Invoice → Payment → Delivery</div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button className="btn btn-secondary w-full" type="button" onClick={() => setRxOpen(true)}>
                + Prescription (Optional)
              </button>

              <button className="btn btn-primary w-full" type="button" onClick={() => setOrderOpen(true)}>
                + Order
              </button>

              <button
                className="btn btn-outline w-full"
                type="button"
                disabled={!activeOrder?.id || !!activeInvoice}
                onClick={() => activeOrder?.id && generateInvoiceForOrder(String(activeOrder.id))}
              >
                + Invoice
              </button>
            </div>

            <div className="mt-2 text-[11px] muted">
              This page always focuses on the latest active order. Delivered orders close the workflow.
            </div>
          </div>
        </div>

        {/* Workflow cards */}
        <div className="space-y-3">
          <RowCard
            left={
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-semibold">Prescription</div>
                  {latestRx ? statusBadge("ok", "Available") : statusBadge("muted", "Skipped")}
                </div>
                <div className="text-xs muted mt-1">{latestRx ? safeDate(latestRx.createdAt) : "Optional step"}</div>
                <div className="text-sm mt-2" style={{ color: "rgb(var(--fg-muted))" }}>
                  {workflowCard.rxInfo}
                </div>
              </div>
            }
            right={
              <div className="flex lg:justify-end">
                <button className="btn btn-secondary w-full lg:w-auto" type="button" onClick={() => setRxOpen(true)}>
                  {latestRx ? "Add new Rx" : "Add Rx (optional)"}
                </button>
              </div>
            }
          />

          <RowCard
            left={
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-semibold">Order</div>
                  {activeOrder ? statusBadge("info", fmt(activeOrder.status ?? "Draft")) : statusBadge("muted", "None")}
                </div>
                <div className="text-xs muted mt-1">{activeOrder ? safeDate(activeOrder.createdAt) : "Create to begin billing"}</div>
                <div className="text-sm mt-2" style={{ color: "rgb(var(--fg-muted))" }}>
                  {workflowCard.orderInfo}
                </div>
              </div>
            }
            mid={
              activeOrder ? (
                <div className="grid grid-cols-3 gap-2">
                  {(() => {
                    const oc = orderComputed(activeOrder);
                    return (
                      <>
                        <KpiChip label="Total" value={`₹${money(oc.total)}`} tone="info" />
                        <KpiChip label="Advance" value={`₹${money(oc.adv)}`} tone="ok" />
                        <KpiChip label="Balance" value={`₹${money(oc.balance)}`} tone={oc.balance <= 0 ? "ok" : "warn"} />
                      </>
                    );
                  })()}
                </div>
              ) : null
            }
            right={
              <div className="flex flex-col gap-2 lg:items-end">
                <button
                  className={cls("btn w-full", workflowCard.primaryKind === "primary" ? "btn-primary" : "btn-secondary")}
                  type="button"
                  onClick={workflowCard.primaryAction}
                  disabled={!!actionLoading}
                >
                  {actionLoading ? "Working…" : workflowCard.primaryLabel}
                </button>

                {activeOrder?.id ? (
                  <>
                    <button
                      className="btn btn-ghost w-full"
                      type="button"
                      onClick={(e) => {
                        const orderId = String(activeOrder.id);
                        const next = orderMenuOpenFor === orderId ? null : orderId;
                        setOrderMenuOpenFor(next);
                        setOrderMenuAnchor(next ? (e.currentTarget as HTMLElement) : null);
                      }}
                    >
                      More •••
                    </button>

                    <PopoverMenu
                      open={orderMenuOpenFor === String(activeOrder.id)}
                      anchorEl={orderMenuAnchor}
                      onClose={() => {
                        setOrderMenuOpenFor(null);
                        setOrderMenuAnchor(null);
                      }}
                      items={[
                        {
                          id: "ready",
                          label: "Mark Ready",
                          onClick: () => updateOrderStatus(String(activeOrder.id), "Ready"),
                          disabled: !!actionLoading,
                        },
                        {
                          id: "delivered",
                          label: "Mark Delivered",
                          onClick: () => updateOrderStatus(String(activeOrder.id), "Delivered"),
                          disabled: !!actionLoading,
                        },
                      ]}
                    />
                  </>
                ) : null}
              </div>
            }
            bottom={
              activeOrder?.itemsJson?.breakdown?.notes ? (
                <div className="surface-muted p-3">
                  <div className="text-xs muted mb-1">Notes</div>
                  <div className="text-sm" style={{ color: "rgb(var(--fg-muted))" }}>
                    {String(activeOrder.itemsJson.breakdown.notes)}
                  </div>
                </div>
              ) : null
            }
          />

          <RowCard
            left={
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-semibold">Invoice & Payment</div>
                  {activeInvoice ? (
                    invoicePaymentStatus(activeInvoice) === "Paid" ? (
                      statusBadge("ok", "Paid")
                    ) : invoicePaymentStatus(activeInvoice) === "Partial" ? (
                      statusBadge("warn", "Partial")
                    ) : (
                      statusBadge("warn", "Unpaid")
                    )
                  ) : (
                    statusBadge("muted", "Not generated")
                  )}
                </div>

                <div className="text-xs muted mt-1">{activeInvoice ? safeDate(activeInvoice.createdAt) : "Generate invoice after order"}</div>
                <div className="text-sm mt-2" style={{ color: "rgb(var(--fg-muted))" }}>
                  {workflowCard.invInfo}
                </div>
              </div>
            }
            mid={
              activeInvoice ? (
                <div className="grid grid-cols-3 gap-2">
                  {(() => {
                    const total = invoiceTotal(activeInvoice);
                    const paid = invoiceAmountPaid(activeInvoice);
                    const bal = Math.max(0, total - paid);
                    return (
                      <>
                        <KpiChip label="Total" value={`₹${money(total)}`} tone="info" />
                        <KpiChip label="Paid" value={`₹${money(paid)}`} tone="ok" />
                        <KpiChip label="Balance" value={`₹${money(bal)}`} tone={bal <= 0 ? "ok" : "warn"} />
                      </>
                    );
                  })()}
                </div>
              ) : null
            }
            right={
              <div className="flex flex-col gap-2 lg:items-end">
                {activeInvoice?.id ? (
                  <>
                    <a className="btn btn-secondary w-full" href={`/invoices/${String(activeInvoice.id)}`}>
                      Open Invoice
                    </a>

                    {invoicePaymentStatus(activeInvoice) !== "Paid" ? (
                      <button className="btn btn-primary w-full" type="button" onClick={() => openPaymentModal(activeInvoice)}>
                        Record Payment
                      </button>
                    ) : (
                      <button className="btn btn-ghost w-full" type="button" disabled>
                        Paid
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    className="btn btn-outline w-full"
                    type="button"
                    disabled={!activeOrder?.id}
                    onClick={() => activeOrder?.id && generateInvoiceForOrder(String(activeOrder.id))}
                  >
                    Generate Invoice
                  </button>
                )}
              </div>
            }
          />
        </div>

        {/* -------------------- Rx Modal -------------------- */}
        <Modal
          open={rxOpen}
          onClose={() => {
            if (rxSaving) return;
            setRxOpen(false);
            setRxErr(null);
          }}
          title="New Prescription (Optional)"
          description="You may skip this step and create an order directly."
          size="lg"
          busy={rxSaving}
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

              <button
                className="btn btn-ghost w-full md:w-auto md:ml-auto"
                type="button"
                disabled={rxSaving}
                onClick={() => {
                  if (rxSaving) return;
                  setRxOpen(false);
                }}
              >
                Skip
              </button>
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

        {/* -------------------- Order Modal -------------------- */}
        <Modal
          open={orderOpen}
          onClose={() => {
            if (orderSaving) return;
            setOrderOpen(false);
            setOrderErr(null);
          }}
          title="Create Order"
          description="Prescription is optional. Order can be created directly."
          size="lg"
          busy={orderSaving}
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
              <input className="input" value={spectaclesAmt} onChange={(e) => setSpectaclesAmt(e.target.value)} placeholder="0" inputMode="decimal" />
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
            {(() => {
              const t = orderTotalsFromForm();
              return (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
                  {[
                    { label: "Subtotal", value: `₹${money(t.subTotal)}` },
                    { label: "Discount", value: `₹${money(t.disc)}` },
                    { label: "Total", value: `₹${money(t.total)}` },
                    { label: "Advance", value: `₹${money(t.adv)}` },
                    { label: "Balance", value: `₹${money(t.balance)}` },
                    { label: "Discount %", value: `${money(t.pct)}%` },
                  ].map((x) => (
                    <div key={x.label} className="surface-muted p-2">
                      <div className="text-xs muted">{x.label}</div>
                      <div className="font-semibold">{x.value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </Modal>

        {/* -------------------- Payment Modal -------------------- */}
        <Modal
          open={payOpen}
          onClose={() => {
            if (paySaving) return;
            setPayOpen(false);
          }}
          title="Record Payment"
          description={`Total ₹${money(payTotal)} • Partial payments supported`}
          size="md"
          busy={paySaving}
          footer={
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                className="btn btn-secondary w-full"
                type="button"
                onClick={() => setPayAmount(String(payTotal))}
                disabled={paySaving}
              >
                Mark paid (full)
              </button>

              <button className="btn btn-primary w-full" type="button" onClick={submitPayment} disabled={paySaving}>
                {paySaving ? "Saving…" : "Save payment"}
              </button>
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
              <div className="text-[11px] muted mt-1">Tip: Use “Mark paid (full)” for full settlement.</div>
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
    </main>
  );
}