// src/app/(app)/patients/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

/**
 * Patient Detail Page (final consolidated version)
 * - Keeps 4 tabs (Overview / Prescriptions / Orders / Invoices)
 * - Orders tab now supports:
 *    - Generate Invoice (existing)
 *    - Record Payment (for the linked invoice) via /api/invoices/[id] PATCH
 *    - Mark Ready / Mark Delivered via /api/orders/[id]/status PATCH
 *
 * NOTE:
 * - Operational status lives on Order (Ready/Delivered).
 * - Payment status lives on Invoice (Unpaid/Partial/Paid).
 * - We DO NOT change schema; we only call existing endpoints.
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

function statusPill(kind: "ok" | "warn" | "muted", text: string) {
  const c =
    kind === "ok"
      ? "bg-green-50 text-green-900 border-green-200"
      : kind === "warn"
      ? "bg-yellow-50 text-yellow-900 border-yellow-200"
      : "bg-gray-50 text-gray-900 border-gray-200";
  return (
    <span className={cls("inline-flex text-[12px] px-2 py-1 rounded-full border", c)}>
      {text}
    </span>
  );
}

function TabButton({
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
      onClick={onClick}
      className={cls(
        "shrink-0 rounded-full px-3 py-2 text-sm border transition flex items-center gap-2",
        active ? "bg-black text-white border-black" : "bg-white hover:bg-gray-50"
      )}
    >
      <span>{label}</span>
      {meta ? (
        <span
          className={cls(
            "text-[11px] px-2 py-[2px] rounded-full",
            active ? "bg-white/20" : "bg-gray-100"
          )}
        >
          {meta}
        </span>
      ) : null}
    </button>
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

  // ---- Payment modal (NEW)
  const [payOpen, setPayOpen] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState<string>("");
  const [payTotal, setPayTotal] = useState<number>(0);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMode, setPayMode] = useState<string>("Cash");
  const [payErr, setPayErr] = useState<string | null>(null);
  const [paySaving, setPaySaving] = useState(false);

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

  const res = await fetch(`/api/invoices?patientId=${patientId}${storeParam}`, {
    credentials: "include",
  });
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

  const billedOrderIds = useMemo(() => new Set((invoices ?? []).map((iv) => iv.orderId)), [invoices]);

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

    // ✅ Keep compatibility: invoice generator reads itemsJson.items
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

      const order = orders.find((x) => x.id === orderId);
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
    return generateInvoiceForOrder(latestOrderId);
  }

  async function updateInvoicePayment(invoiceId: string, amountPaid: number, paymentMode: string) {
    if (!invoiceId) return;
    setInvErr(null);
    setInvActionLoading(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountPaid, paymentMode }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        setInvErr(data.error ?? "Failed to update payment");
        return;
      }
      await loadInvoices();
    } finally {
      setInvActionLoading(null);
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

  // invoice lookup per order (NEW, used in Orders tab)
  const invoiceByOrderId = useMemo(() => {
    const m = new Map<string, any>();
    (invoices ?? []).forEach((iv) => {
      if (iv?.orderId) m.set(String(iv.orderId), iv);
    });
    return m;
  }, [invoices]);

  // ------------------- Overview cards -------------------
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
            ? `PD: ${fmt(latestRx.rxJson?.pd)} • ${fmt(latestRx.rxJson?.notes)}`
            : "Add a prescription to start.",
        pill: latestRx ? statusPill("ok", "Ready") : statusPill("muted", "Missing"),
        action: () => {
          setTab("Prescriptions");
          setRxOpen(true);
        },
        actionLabel: latestRx ? "Add New Rx" : "Create Rx",
      },
      order: {
        title: "Latest Order",
        value: oDate || "No order yet",
        sub: oc ? `Total ₹${money(oc.total)} • Balance ₹${money(oc.balance)}` : "Create an order (walk-in supported).",
        pill: latestOrder ? statusPill("ok", latestOrder.status ?? "Draft") : statusPill("muted", "Missing"),
        action: () => {
          setTab("Orders");
          setOrderOpen(true);
        },
        actionLabel: latestOrder ? "Create New Order" : "Create Order",
      },
      invoice: {
        title: "Latest Invoice",
        value: latestInvoice ? (latestInvoice.invoiceNo ?? "Invoice") : "No invoice yet",
        sub: latestInvoice ? `₹${money(invTotal)} • ${invDate}` : "Generate invoice from an order.",
        pill: latestInvoice
          ? invPS === "Paid"
            ? statusPill("ok", "Paid")
            : invPS === "Partial"
            ? statusPill("warn", "Partial")
            : statusPill("warn", "Unpaid")
          : statusPill("muted", "Missing"),
        action: () => {
          if (latestInvoice?.id) window.location.href = `/invoices/${latestInvoice.id}`;
          else generateInvoiceFromLatestOrder();
        },
        actionLabel: latestInvoice ? "Open Invoice" : "Generate Invoice",
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <Link href="/patients" className="text-sm underline">
              ← Back to Patients
            </Link>

            <h1 className="h1 mt-2 truncate">{patient?.name ?? "Patient"}</h1>
            {patient && <div className="subtle truncate">{headerMeta}</div>}
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <button className="btn btn-ghost border w-full md:w-auto" onClick={loadAll} disabled={loadingAll}>
              {loadingAll ? "Refreshing…" : "Refresh"}
            </button>

            <button
              className="btn btn-primary w-full md:w-auto"
              onClick={() => {
                setTab("Prescriptions");
                setRxOpen(true);
              }}
            >
              + New Prescription
            </button>
          </div>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        {/* Tabs */}
        <div className="card card-pad">
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            <TabButton active={tab === "Overview"} label="Overview" onClick={() => setTab("Overview")} />
            <TabButton
              active={tab === "Prescriptions"}
              label="Prescriptions"
              meta={tabMeta.Prescriptions}
              onClick={() => setTab("Prescriptions")}
            />
            <TabButton active={tab === "Orders"} label="Orders" meta={tabMeta.Orders} onClick={() => setTab("Orders")} />
            <TabButton
              active={tab === "Invoices"}
              label="Invoices"
              meta={tabMeta.Invoices}
              onClick={() => setTab("Invoices")}
            />
          </div>
        </div>

        {/* Content */}
        <div className="card card-pad">
          {/* ================= OVERVIEW ================= */}
          {tab === "Overview" && (
            <div className="space-y-4">
              {/* Patient quick info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border rounded-2xl p-4">
                  <div className="text-xs text-gray-500">Mobile</div>
                  <div className="mt-1 text-lg font-semibold truncate">{patient?.mobile ?? "—"}</div>
                  <div className="mt-2 text-xs text-gray-500 truncate">{patient?.address ?? "—"}</div>
                </div>

                <div className="border rounded-2xl p-4">
                  <div className="text-xs text-gray-500">Age / Gender</div>
                  <div className="mt-1 text-lg font-semibold">
                    {patient?.age ? `${patient.age} yrs` : "—"}{" "}
                    <span className="text-gray-500 font-normal">{patient?.gender ? `• ${patient.gender}` : ""}</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Patient ID: {patient?.id ? String(patient.id).slice(-8) : "—"}
                  </div>
                </div>

                <div className="border rounded-2xl p-4">
                  <div className="text-xs text-gray-500">Recommended flow</div>
                  <div className="mt-1 text-sm text-gray-700">Prescription → Order → Invoice → Payment → Delivery</div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      className="btn btn-ghost border"
                      onClick={() => {
                        setTab("Orders");
                        setOrderOpen(true);
                      }}
                    >
                      + Order
                    </button>
                    <button className="btn btn-primary" onClick={generateInvoiceFromLatestOrder}>
                      + Invoice
                    </button>
                  </div>

                  <div className="mt-2 text-[11px] text-gray-500">
                    Walk-in sale supported: you can create an order even without Rx.
                  </div>
                </div>
              </div>

              {/* At-a-glance cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(["rx", "order", "invoice"] as const).map((k) => {
                  const c = overview[k];
                  return (
                    <div key={k} className="border rounded-2xl p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{c.title}</div>
                          <div className="text-xs text-gray-500 truncate">{c.value}</div>
                        </div>
                        <div className="shrink-0">{c.pill}</div>
                      </div>

                      <div className="text-sm text-gray-700">{c.sub}</div>

                      <button className="btn btn-ghost border w-full" onClick={c.action}>
                        {c.actionLabel}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Latest quick actions */}
              <div className="border rounded-2xl p-4">
                <div className="text-sm font-semibold">Quick actions</div>
                <div className="mt-2 flex flex-col md:flex-row gap-2">
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setTab("Prescriptions");
                      setRxOpen(true);
                    }}
                  >
                    Add Prescription
                  </button>

                  <button
                    className="btn btn-ghost border"
                    onClick={() => {
                      setTab("Orders");
                      setOrderOpen(true);
                    }}
                  >
                    Create Order
                  </button>

                  <button className="btn btn-ghost border" onClick={generateInvoiceFromLatestOrder}>
                    Generate Invoice (Latest Order)
                  </button>
                </div>

                {latestOrder?.id ? (
                  <div className="mt-3 flex flex-col md:flex-row md:items-center gap-2">
                    <div className="text-sm text-gray-700">
                      Latest order status: <span className="font-medium">{fmt(latestOrder.status ?? "Draft")}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-ghost border"
                        disabled={invActionLoading === latestOrder.id}
                        onClick={() => updateOrderStatus(latestOrder.id, "Ready")}
                      >
                        Mark Ready
                      </button>
                      <button
                        className="btn btn-ghost border"
                        disabled={invActionLoading === latestOrder.id}
                        onClick={() => updateOrderStatus(latestOrder.id, "Delivered")}
                      >
                        Mark Delivered
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* ================= PRESCRIPTIONS ================= */}
          {tab === "Prescriptions" && (
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="h2">Prescriptions</div>

                <div className="grid grid-cols-2 gap-2 md:flex md:justify-end">
                  <button className="btn btn-ghost border" onClick={loadPrescriptions}>
                    Refresh
                  </button>
                  <button className="btn btn-primary" onClick={() => setRxOpen(true)}>
                    + Add Rx
                  </button>
                </div>
              </div>

              {rxErr && <div className="text-sm text-red-600">{rxErr}</div>}

              <div className="space-y-3">
                {prescriptions.map((rx) => (
                  <div key={rx.id} className="border rounded-2xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">Prescription</div>
                        <div className="text-xs text-gray-600 truncate">{safeDate(rx.createdAt)}</div>
                      </div>
                      <span className="badge shrink-0">Rx</span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="border rounded-xl p-3">
                        <div className="font-medium text-sm mb-2">Right (OD)</div>
                        <div className="text-sm">Sphere: {fmt(rx.rxJson?.right?.sphere)}</div>
                        <div className="text-sm">Cyl: {fmt(rx.rxJson?.right?.cyl)}</div>
                        <div className="text-sm">Axis: {fmt(rx.rxJson?.right?.axis)}</div>
                        <div className="text-sm">Add: {fmt(rx.rxJson?.right?.add)}</div>
                      </div>

                      <div className="border rounded-xl p-3">
                        <div className="font-medium text-sm mb-2">Left (OS)</div>
                        <div className="text-sm">Sphere: {fmt(rx.rxJson?.left?.sphere)}</div>
                        <div className="text-sm">Cyl: {fmt(rx.rxJson?.left?.cyl)}</div>
                        <div className="text-sm">Axis: {fmt(rx.rxJson?.left?.axis)}</div>
                        <div className="text-sm">Add: {fmt(rx.rxJson?.left?.add)}</div>
                      </div>
                    </div>

                    <div className="mt-2 text-sm">
                      <span className="font-medium">PD:</span> {fmt(rx.rxJson?.pd)}{" "}
                      <span className="font-medium">• Notes:</span> {fmt(rx.rxJson?.notes)}
                    </div>
                  </div>
                ))}

                {prescriptions.length === 0 && (
                  <div className="p-4 text-sm text-gray-500 border rounded-2xl">No prescriptions yet.</div>
                )}
              </div>
            </div>
          )}

          {/* ================= ORDERS ================= */}
          {tab === "Orders" && (
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="h2">Orders</div>

                <div className="grid grid-cols-2 gap-2 md:flex md:justify-end">
                  <button className="btn btn-primary" onClick={() => setOrderOpen(true)}>
                    + Create Order
                  </button>
                  <button className="btn btn-ghost border" onClick={loadOrders}>
                    Refresh
                  </button>
                </div>
              </div>

              {orderErr && <div className="text-sm text-red-600">{orderErr}</div>}
              {invErr && <div className="text-sm text-red-600">{invErr}</div>}

              <div className="space-y-3">
                {orders.map((o) => {
                  const billed = billedOrderIds.has(o.id);
                  const oc = orderComputed(o);

                  const inv = invoiceByOrderId.get(String(o.id)) ?? null;
                  const invPS = inv ? invoicePaymentStatus(inv) : null;
                  const invTotal = inv ? invoiceTotal(inv) : 0;

                  return (
                    <div key={o.id} className="border rounded-2xl p-3 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-sm font-medium">Order</div>
                            {o.status ? statusPill("muted", String(o.status)) : null}
                            {billed ? statusPill("ok", "Billed") : statusPill("warn", "Unbilled")}
                            {invPS ? (
                              invPS === "Paid" ? (
                                statusPill("ok", "Paid")
                              ) : invPS === "Partial" ? (
                                statusPill("warn", "Partial")
                              ) : (
                                statusPill("warn", "Unpaid")
                              )
                            ) : (
                              <span className="text-xs text-gray-500">No invoice</span>
                            )}
                          </div>

                          <div className="text-xs text-gray-600 truncate">
                            {safeDate(o.createdAt)} • Total ₹{money(oc.total)} • Balance ₹{money(oc.balance)}
                          </div>

                          <div className="text-xs text-gray-500">
                            Order ID: {String(o.id).slice(-6)} • Linked Rx: {o.prescriptionId ?? "—"}
                          </div>

                          {inv?.invoiceNo ? (
                            <div className="text-xs text-gray-500 mt-1">
                              Invoice: <span className="font-medium">{inv.invoiceNo}</span> • ₹{money(invTotal)}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 justify-end flex-wrap">
                          {!billed ? (
                            <button className="btn btn-ghost border" onClick={() => generateInvoiceForOrder(o.id)}>
                              Generate Invoice
                            </button>
                          ) : inv?.id ? (
                            <>
                              <button className="btn btn-ghost border" onClick={() => window.location.href = `/invoices/${inv.id}`}>
                                Open Invoice
                              </button>
                              <button className="btn btn-primary" onClick={() => openPaymentModal(inv)}>
                                Record Payment
                              </button>
                            </>
                          ) : (
                            <button className="btn btn-ghost border" onClick={loadInvoices}>
                              Refresh Invoice
                            </button>
                          )}

                          <button
                            className="btn btn-ghost border"
                            disabled={invActionLoading === o.id}
                            onClick={() => updateOrderStatus(o.id, "Ready")}
                            title="Operational status"
                          >
                            {invActionLoading === o.id ? "Updating…" : "Mark Ready"}
                          </button>

                          <button
                            className="btn btn-ghost border"
                            disabled={invActionLoading === o.id}
                            onClick={() => updateOrderStatus(o.id, "Delivered")}
                            title="Operational status"
                          >
                            {invActionLoading === o.id ? "Updating…" : "Mark Delivered"}
                          </button>
                        </div>
                      </div>

                      {/* Breakdown */}
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
                        <div className="border rounded-xl p-2">
                          <div className="text-xs text-gray-500">Consult</div>
                          <div className="font-semibold">₹{money(oc.breakdown?.consultationFee ?? 0)}</div>
                        </div>
                        <div className="border rounded-xl p-2">
                          <div className="text-xs text-gray-500">Frames</div>
                          <div className="font-semibold">₹{money(oc.breakdown?.frames ?? 0)}</div>
                        </div>
                        <div className="border rounded-xl p-2">
                          <div className="text-xs text-gray-500">Spectacles</div>
                          <div className="font-semibold">₹{money(oc.breakdown?.spectacles ?? 0)}</div>
                        </div>
                        <div className="border rounded-xl p-2">
                          <div className="text-xs text-gray-500">Discount</div>
                          <div className="font-semibold">₹{money(oc.disc)}</div>
                        </div>
                        <div className="border rounded-xl p-2">
                          <div className="text-xs text-gray-500">Advance</div>
                          <div className="font-semibold">₹{money(oc.adv)}</div>
                        </div>
                        <div className="border rounded-xl p-2">
                          <div className="text-xs text-gray-500">Balance</div>
                          <div className="font-semibold">₹{money(oc.balance)}</div>
                        </div>
                      </div>

                      {oc.breakdown?.notes ? (
                        <div className="text-sm text-gray-700 border rounded-xl p-2">
                          <div className="text-xs text-gray-500 mb-1">Notes</div>
                          {String(oc.breakdown.notes)}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {orders.length === 0 && <div className="p-4 text-sm text-gray-500 border rounded-2xl">No orders yet.</div>}
              </div>
            </div>
          )}

          {/* ================= INVOICES ================= */}
          {tab === "Invoices" && (
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="h2">Invoices</div>

                <div className="grid grid-cols-2 gap-2 md:flex md:justify-end">
                  <button className="btn btn-primary" onClick={generateInvoiceFromLatestOrder}>
                    Generate (Latest Order)
                  </button>
                  <button className="btn btn-ghost border" onClick={loadInvoices}>
                    Refresh
                  </button>
                </div>
              </div>

              {invErr && <div className="text-sm text-red-600">{invErr}</div>}

              <div className="space-y-2">
                {invoices.map((inv) => {
                  const total = invoiceTotal(inv);
                  const ps = invoicePaymentStatus(inv);
                  const paymentMode = String(inv?.totalsJson?.paymentMode ?? "Cash");
                  const orderId = inv?.orderId ?? "";

                  return (
                    <div key={inv.id} className="border rounded-2xl p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-sm font-medium truncate">{inv.invoiceNo ?? "Invoice"}</div>
                            {ps === "Paid"
                              ? statusPill("ok", "Paid")
                              : ps === "Partial"
                              ? statusPill("warn", "Partial")
                              : statusPill("warn", "Unpaid")}
                          </div>
                          <div className="text-xs text-gray-600 truncate">
                            {safeDate(inv.createdAt)} • Total ₹{money(total)} • Mode: {paymentMode}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            Order: {orderId ? String(orderId).slice(-6) : "—"}
                          </div>
                        </div>

                        <a className="btn btn-ghost border shrink-0" href={`/invoices/${inv.id}`}>
                          Open
                        </a>
                      </div>

                      {/* Quick actions */}
                      <div className="flex flex-col md:flex-row gap-2">
                        <button className="btn btn-primary" onClick={() => openPaymentModal(inv)}>
                          Record Payment
                        </button>

                        <button
                          className="btn btn-ghost border"
                          disabled={!orderId || invActionLoading === orderId}
                          onClick={() => updateOrderStatus(orderId, "Delivered")}
                          title={!orderId ? "No order linked" : "Updates order status to Delivered"}
                        >
                          {invActionLoading === orderId ? "Updating…" : "Mark Delivered"}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {invoices.length === 0 && <div className="p-4 text-sm text-gray-500 border rounded-2xl">No invoices yet.</div>}
              </div>
            </div>
          )}
        </div>

        {/* ================= Rx Modal ================= */}
        {rxOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-3xl rounded-2xl p-4 shadow max-h-[85vh] overflow-auto space-y-4">
              <div className="flex justify-between items-center sticky top-0 bg-white pb-2">
                <div>
                  <h2 className="text-lg font-semibold">New Prescription</h2>
                  <div className="text-xs text-gray-500">Single form • OD & OS sections • Copy between eyes</div>
                </div>

                <button
                  className="text-sm underline"
                  onClick={() => {
                    if (rxSaving) return;
                    setRxOpen(false);
                    setRxErr(null);
                  }}
                >
                  Close
                </button>
              </div>

              {rxErr && <div className="text-sm text-red-600">{rxErr}</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Right */}
                <div className="border rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">Right Eye (OD)</div>
                    <button className="btn btn-ghost border" type="button" onClick={copyRightToLeft}>
                      Copy → Left
                    </button>
                  </div>
                  <input className="input" placeholder="Sphere" value={rSphere} onChange={(e) => setRSphere(e.target.value)} />
                  <input className="input" placeholder="Cyl" value={rCyl} onChange={(e) => setRCyl(e.target.value)} />
                  <input className="input" placeholder="Axis" value={rAxis} onChange={(e) => setRAxis(e.target.value)} />
                  <input className="input" placeholder="Add" value={rAdd} onChange={(e) => setRAdd(e.target.value)} />
                </div>

                {/* Left */}
                <div className="border rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">Left Eye (OS)</div>
                    <button className="btn btn-ghost border" type="button" onClick={copyLeftToRight}>
                      Copy → Right
                    </button>
                  </div>
                  <input className="input" placeholder="Sphere" value={lSphere} onChange={(e) => setLSphere(e.target.value)} />
                  <input className="input" placeholder="Cyl" value={lCyl} onChange={(e) => setLCyl(e.target.value)} />
                  <input className="input" placeholder="Axis" value={lAxis} onChange={(e) => setLAxis(e.target.value)} />
                  <input className="input" placeholder="Add" value={lAdd} onChange={(e) => setLAdd(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="input" placeholder="PD" value={pd} onChange={(e) => setPd(e.target.value)} />
                <input className="input" placeholder="Notes" value={rxNotes} onChange={(e) => setRxNotes(e.target.value)} />
              </div>

              <div className="flex flex-col md:flex-row gap-2">
                <button className="btn btn-primary w-full disabled:opacity-60" onClick={createPrescription} disabled={rxSaving}>
                  {rxSaving ? "Saving..." : "Save Prescription"}
                </button>

                <button
                  className="btn btn-ghost border w-full"
                  type="button"
                  onClick={() => {
                    if (rxSaving) return;
                    resetRxForm();
                    setRxErr(null);
                  }}
                >
                  Clear
                </button>
              </div>

              <div className="text-xs text-gray-500">Tip: If both eyes are same, fill one side and use “Copy”.</div>
            </div>
          </div>
        )}

        {/* ================= Order Modal ================= */}
        {orderOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-3xl rounded-2xl p-4 shadow max-h-[85vh] overflow-auto space-y-4">
              <div className="flex justify-between items-center sticky top-0 bg-white pb-2">
                <div>
                  <h2 className="text-lg font-semibold">Create Order</h2>
                  <div className="text-xs text-gray-500">Split amounts • Auto balance • Walk-in supported</div>
                </div>

                <button
                  className="text-sm underline"
                  onClick={() => {
                    if (orderSaving) return;
                    setOrderOpen(false);
                    setOrderErr(null);
                  }}
                >
                  Close
                </button>
              </div>

              {orderErr && <div className="text-sm text-red-600">{orderErr}</div>}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Consultation Fee</div>
                  <input className="input" value={consultFee} onChange={(e) => setConsultFee(e.target.value)} placeholder="0" inputMode="decimal" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Frames</div>
                  <input className="input" value={framesAmt} onChange={(e) => setFramesAmt(e.target.value)} placeholder="0" inputMode="decimal" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Spectacles / Lenses</div>
                  <input className="input" value={spectaclesAmt} onChange={(e) => setSpectaclesAmt(e.target.value)} placeholder="0" inputMode="decimal" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Discount (Flat ₹)</div>
                  <input className="input" value={discountFlat} onChange={(e) => setDiscountFlat(e.target.value)} placeholder="0" inputMode="decimal" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Discount (%)</div>
                  <input className="input" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} placeholder="0" inputMode="decimal" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Advance Paid</div>
                  <input className="input" value={advancePaid} onChange={(e) => setAdvancePaid(e.target.value)} placeholder="0" inputMode="decimal" />
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Notes</div>
                <input className="input" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Optional" />
              </div>

              <div className="border rounded-2xl p-3">
                <div className="text-sm font-medium">Summary</div>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
                  <div className="border rounded-xl p-2">
                    <div className="text-xs text-gray-500">Subtotal</div>
                    <div className="font-semibold">₹{money(formTotals.subTotal)}</div>
                  </div>
                  <div className="border rounded-xl p-2">
                    <div className="text-xs text-gray-500">Discount</div>
                    <div className="font-semibold">₹{money(formTotals.disc)}</div>
                  </div>
                  <div className="border rounded-xl p-2">
                    <div className="text-xs text-gray-500">Total</div>
                    <div className="font-semibold">₹{money(formTotals.total)}</div>
                  </div>
                  <div className="border rounded-xl p-2">
                    <div className="text-xs text-gray-500">Advance</div>
                    <div className="font-semibold">₹{money(formTotals.adv)}</div>
                  </div>
                  <div className="border rounded-xl p-2">
                    <div className="text-xs text-gray-500">Balance</div>
                    <div className="font-semibold">₹{money(formTotals.balance)}</div>
                  </div>
                  <div className="border rounded-xl p-2">
                    <div className="text-xs text-gray-500">Discount %</div>
                    <div className="font-semibold">{money(formTotals.pct)}%</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-2">
                <button className="btn btn-primary w-full disabled:opacity-60" onClick={createOrder} disabled={orderSaving}>
                  {orderSaving ? "Saving..." : "Save Order (Draft)"}
                </button>

                <button
                  className="btn btn-ghost border w-full"
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

              <div className="text-xs text-gray-500">Order links to the latest prescription automatically (if present).</div>
            </div>
          </div>
        )}

        {/* ================= Payment Modal (NEW) ================= */}
        {payOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-lg rounded-2xl p-4 shadow space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">Record Payment</div>
                  <div className="text-xs text-gray-500">Total ₹{money(payTotal)} • Update will set Paid/Partial/Unpaid on invoice</div>
                </div>
                <button
                  className="text-sm underline"
                  onClick={() => {
                    if (paySaving) return;
                    setPayOpen(false);
                  }}
                >
                  Close
                </button>
              </div>

              {payErr && <div className="text-sm text-red-600">{payErr}</div>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Amount paid</div>
                  <input className="input" inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0" />
                  <div className="text-[11px] text-gray-500 mt-1">
                    Tip: For full payment, use “Mark paid (full)”.
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Payment mode</div>
                  <select className="input" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Card</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  className="btn btn-ghost border w-full"
                  type="button"
                  onClick={() => setPayAmount(String(payTotal))}
                  disabled={paySaving}
                >
                  Mark paid (full)
                </button>

                <button className="btn btn-primary w-full disabled:opacity-60" onClick={submitPayment} disabled={paySaving}>
                  {paySaving ? "Saving…" : "Save payment"}
                </button>
              </div>

              <div className="text-xs text-gray-500">
                After saving, the Orders tab will show Paid/Partial/Unpaid for this order.
              </div>
            </div>
          </div>
        )}
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
