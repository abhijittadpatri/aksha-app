// src/components/patients/PatientWorkflowWizard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function money(n: any) {
  return safeNumber(n).toFixed(2);
}

type Step = 1 | 2 | 3;

function draftKey(patientId: string, storeId: string | null) {
  return `aksha:patientWizardDraft:v1:${storeId ?? "no-store"}:${patientId}`;
}

function safeParseDraft(text: string | null) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}


export default function PatientWorkflowWizard(props: {
  open: boolean;
  onClose: () => void;
  patientId: string;

  // optional helpers
  storeId: string | null;
  patientName?: string | null;

  // callbacks so your page can refresh its lists
  onCreatedPrescription?: () => Promise<void> | void;
  onCreatedOrder?: () => Promise<void> | void;
  onCreatedInvoice?: () => Promise<void> | void;
}) {
  const { open, onClose, patientId, storeId, patientName } = props;

  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // step 1: RX
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

  // step 2: order
  const [consultFee, setConsultFee] = useState("0");
  const [framesAmt, setFramesAmt] = useState("0");
  const [spectaclesAmt, setSpectaclesAmt] = useState("0");
  const [discountFlat, setDiscountFlat] = useState("0");
  const [discountPct, setDiscountPct] = useState("0");
  const [advancePaid, setAdvancePaid] = useState("0");
  const [orderNotes, setOrderNotes] = useState("");

  // created ids
  const [createdPrescriptionId, setCreatedPrescriptionId] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  const storageKey = useMemo(() => draftKey(patientId, storeId), [patientId, storeId]);

// Restore draft when wizard opens
useEffect(() => {
  if (!open) return;
  if (typeof window === "undefined") return;

  const raw = window.localStorage.getItem(storageKey);
  const d = safeParseDraft(raw);
  if (!d) return;

  // Restore only if draft matches current patient/store
  if (d.patientId !== patientId) return;
  if ((d.storeId ?? null) !== (storeId ?? null)) return;

  setStep((d.step as Step) ?? 1);

  // Rx
  setRSphere(d.rSphere ?? "");
  setRCyl(d.rCyl ?? "");
  setRAxis(d.rAxis ?? "");
  setRAdd(d.rAdd ?? "");
  setLSphere(d.lSphere ?? "");
  setLCyl(d.lCyl ?? "");
  setLAxis(d.lAxis ?? "");
  setLAdd(d.lAdd ?? "");
  setPd(d.pd ?? "");
  setRxNotes(d.rxNotes ?? "");

  // Order
  setConsultFee(d.consultFee ?? "0");
  setFramesAmt(d.framesAmt ?? "0");
  setSpectaclesAmt(d.spectaclesAmt ?? "0");
  setDiscountFlat(d.discountFlat ?? "0");
  setDiscountPct(d.discountPct ?? "0");
  setAdvancePaid(d.advancePaid ?? "0");
  setOrderNotes(d.orderNotes ?? "");

  // created ids
  setCreatedPrescriptionId(d.createdPrescriptionId ?? null);
  setCreatedOrderId(d.createdOrderId ?? null);
}, [open, storageKey, patientId, storeId]);

// Save draft whenever inputs change while open (light debounce)
useEffect(() => {
  if (!open) return;
  if (typeof window === "undefined") return;

  const payload = {
    v: 1,
    patientId,
    storeId,

    step,

    rSphere, rCyl, rAxis, rAdd,
    lSphere, lCyl, lAxis, lAdd,
    pd,
    rxNotes,

    consultFee,
    framesAmt,
    spectaclesAmt,
    discountFlat,
    discountPct,
    advancePaid,
    orderNotes,

    createdPrescriptionId,
    createdOrderId,
    savedAt: new Date().toISOString(),
  };

  const t = window.setTimeout(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, 250);

  return () => window.clearTimeout(t);
}, [
  open,
  storageKey,
  patientId,
  storeId,
  step,
  rSphere, rCyl, rAxis, rAdd,
  lSphere, lCyl, lAxis, lAdd,
  pd,
  rxNotes,
  consultFee,
  framesAmt,
  spectaclesAmt,
  discountFlat,
  discountPct,
  advancePaid,
  orderNotes,
  createdPrescriptionId,
  createdOrderId,
]);


  const totals = useMemo(() => {
    const consult = Math.max(0, safeNumber(consultFee));
    const frames = Math.max(0, safeNumber(framesAmt));
    const specs = Math.max(0, safeNumber(spectaclesAmt));
    const subTotal = consult + frames + specs;

    const dFlat = Math.max(0, safeNumber(discountFlat));
    const dPct = Math.max(0, safeNumber(discountPct));
    const discPct = dPct > 0 ? (subTotal * dPct) / 100 : 0;
    const disc = Math.min(subTotal, dFlat + discPct);

    const total = Math.max(0, subTotal - disc);
    const adv = Math.max(0, safeNumber(advancePaid));
    const balance = Math.max(0, total - adv);

    return { consult, frames, specs, subTotal, disc, total, adv, balance };
  }, [consultFee, framesAmt, spectaclesAmt, discountFlat, discountPct, advancePaid]);

  function resetAll() {
    setStep(1);
    setErr(null);
    setBusy(false);

    setRSphere(""); setRCyl(""); setRAxis(""); setRAdd("");
    setLSphere(""); setLCyl(""); setLAxis(""); setLAdd("");
    setPd(""); setRxNotes("");

    setConsultFee("0"); setFramesAmt("0"); setSpectaclesAmt("0");
    setDiscountFlat("0"); setDiscountPct("0"); setAdvancePaid("0");
    setOrderNotes("");

    setCreatedPrescriptionId(null);
    setCreatedOrderId(null);
  }

  function close() {
    if (busy) return;
    resetAll();
    onClose();
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
    setErr(null);
    if (!storeId) return setErr("No active store selected.");

    setBusy(true);
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

      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(data.error ?? "Failed to create prescription");

      const id = data?.prescription?.id ?? data?.id ?? null;
      if (!id) return setErr("Prescription created but id not returned.");

      setCreatedPrescriptionId(id);
      await props.onCreatedPrescription?.();
      setStep(2);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create prescription");
    } finally {
      setBusy(false);
    }
  }

  async function createOrder() {
    setErr(null);
    if (!storeId) return setErr("No active store selected.");

    setBusy(true);
    try {
      const items = [
        { name: "Consultation Fee", qty: 1, rate: totals.consult },
        { name: "Frames", qty: 1, rate: totals.frames },
        { name: "Spectacles / Lenses", qty: 1, rate: totals.specs },
      ].filter((x) => safeNumber(x.rate) > 0);

      const breakdown = {
        consultationFee: totals.consult,
        frames: totals.frames,
        spectacles: totals.specs,
        discount: totals.disc,
        subTotal: totals.subTotal,
        total: totals.total,
        advancePaid: totals.adv,
        balance: totals.balance,
        notes: orderNotes || "",
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          storeId,
          prescriptionId: createdPrescriptionId, // wizard-created Rx
          itemsJson: { items, breakdown },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(data.error ?? "Failed to create order");

      const id = data?.order?.id ?? data?.id ?? null;
      if (!id) return setErr("Order created but id not returned.");

      setCreatedOrderId(id);
      await props.onCreatedOrder?.();
      setStep(3);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create order");
    } finally {
      setBusy(false);
    }
  }

  async function generateInvoice() {
    setErr(null);
    if (!storeId) return setErr("No active store selected.");
    if (!createdOrderId) return setErr("Order not created yet.");

    setBusy(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          storeId,
          orderId: createdOrderId,
          discount: totals.disc,
          paid: false,
          paymentMode: "Cash",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(data.error ?? "Failed to generate invoice");

      const invoiceId = data?.invoice?.id ?? null;
      await props.onCreatedInvoice?.();

      if (typeof window !== "undefined") {
        try { window.localStorage.removeItem(storageKey); } catch {}
      }

      if (invoiceId) {
        window.location.href = `/invoices/${invoiceId}`;
        return;
      }

      close();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to generate invoice");
    } finally {
      setBusy(false);
    }
  }

  const title =
    step === 1 ? "New Patient Workflow • Prescription" :
    step === 2 ? "New Patient Workflow • Order" :
    "New Patient Workflow • Invoice";

  const description =
    step === 1 ? "Step 1 of 3 — capture the prescription quickly." :
    step === 2 ? "Step 2 of 3 — create an order (fees + discount + advance)." :
    "Step 3 of 3 — confirm totals and generate invoice.";

    if (typeof window !== "undefined") {
  try { window.localStorage.removeItem(draftKey(patientId, storeId)); } catch {}
}


  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      description={description}
      size="lg"
      busy={busy}
      footer={
        <div className="flex gap-2">
          <button className="btn btn-secondary flex-1" type="button" onClick={close} disabled={busy}>
            Cancel
          </button>

          {step === 1 && (
            <button className="btn btn-primary flex-1" type="button" onClick={createPrescription} disabled={busy}>
              {busy ? "Saving…" : "Save Prescription →"}
            </button>
          )}

          {step === 2 && (
            <button className="btn btn-primary flex-1" type="button" onClick={createOrder} disabled={busy}>
              {busy ? "Saving…" : "Create Order →"}
            </button>
          )}

          {step === 3 && (
            <button className="btn btn-primary flex-1" type="button" onClick={generateInvoice} disabled={busy}>
              {busy ? "Generating…" : "Generate Invoice"}
            </button>
          )}
        </div>
      }
    >
      {err && (
        <div
          className="text-sm"
          style={{
            color: "rgb(var(--fg))",
            background: "rgba(var(--danger),0.14)",
            border: "1px solid rgba(var(--danger),0.22)",
            borderRadius: "12px",
            padding: "10px 12px",
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="panel p-3">
            <div className="text-sm font-semibold">
              Patient: {patientName || "—"}
            </div>
            <div className="text-xs muted">Store: {storeId || "—"}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="panel p-3 space-y-2">
              <div className="label">Right Eye (OD)</div>
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="Sphere" value={rSphere} onChange={(e) => setRSphere(e.target.value)} />
                <input className="input" placeholder="Cyl" value={rCyl} onChange={(e) => setRCyl(e.target.value)} />
                <input className="input" placeholder="Axis" value={rAxis} onChange={(e) => setRAxis(e.target.value)} />
                <input className="input" placeholder="Add" value={rAdd} onChange={(e) => setRAdd(e.target.value)} />
              </div>
            </div>

            <div className="panel p-3 space-y-2">
              <div className="label">Left Eye (OS)</div>
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="Sphere" value={lSphere} onChange={(e) => setLSphere(e.target.value)} />
                <input className="input" placeholder="Cyl" value={lCyl} onChange={(e) => setLCyl(e.target.value)} />
                <input className="input" placeholder="Axis" value={lAxis} onChange={(e) => setLAxis(e.target.value)} />
                <input className="input" placeholder="Add" value={lAdd} onChange={(e) => setLAdd(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-secondary btn-sm" type="button" onClick={copyRightToLeft} disabled={busy}>
              Copy Right → Left
            </button>
            <button className="btn btn-secondary btn-sm" type="button" onClick={copyLeftToRight} disabled={busy}>
              Copy Left → Right
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input className="input" placeholder="PD" value={pd} onChange={(e) => setPd(e.target.value)} />
            <div className="md:col-span-2">
              <input className="input" placeholder="Notes (optional)" value={rxNotes} onChange={(e) => setRxNotes(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="panel p-3">
            <div className="text-sm font-semibold">Order pricing</div>
            <div className="text-xs muted">Fill only what applies. Zero values are ignored.</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input className="input" placeholder="Consultation Fee" inputMode="decimal" value={consultFee} onChange={(e) => setConsultFee(e.target.value)} />
            <input className="input" placeholder="Frames" inputMode="decimal" value={framesAmt} onChange={(e) => setFramesAmt(e.target.value)} />
            <input className="input" placeholder="Spectacles / Lenses" inputMode="decimal" value={spectaclesAmt} onChange={(e) => setSpectaclesAmt(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input className="input" placeholder="Discount (₹)" inputMode="decimal" value={discountFlat} onChange={(e) => setDiscountFlat(e.target.value)} />
            <input className="input" placeholder="Discount (%)" inputMode="decimal" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} />
            <input className="input" placeholder="Advance Paid" inputMode="decimal" value={advancePaid} onChange={(e) => setAdvancePaid(e.target.value)} />
          </div>

          <input className="input" placeholder="Order notes (optional)" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} />

          <div className="surface-muted p-3">
            <div className="text-sm font-semibold">Totals</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="muted">Subtotal</div><div className="text-right">₹{money(totals.subTotal)}</div>
              <div className="muted">Discount</div><div className="text-right">₹{money(totals.disc)}</div>
              <div className="font-semibold">Total</div><div className="text-right font-semibold">₹{money(totals.total)}</div>
              <div className="muted">Advance</div><div className="text-right">₹{money(totals.adv)}</div>
              <div className="muted">Balance</div><div className="text-right">₹{money(totals.balance)}</div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="panel p-3">
            <div className="text-sm font-semibold">Ready to generate invoice</div>
            <div className="text-xs muted">
              This will create an invoice for the order and open it automatically.
            </div>
          </div>

          <div className="surface-muted p-3">
            <div className="text-sm font-semibold">Invoice Summary</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="muted">Total</div><div className="text-right font-semibold">₹{money(totals.total)}</div>
              <div className="muted">Advance</div><div className="text-right">₹{money(totals.adv)}</div>
              <div className="muted">Balance</div><div className="text-right">₹{money(totals.balance)}</div>
            </div>
          </div>

          <div className="text-xs muted">
            Patient: <span className="text-[rgb(var(--fg))] font-medium">{patientName || "—"}</span>{" "}
            • Store: <span className="text-[rgb(var(--fg))] font-medium">{storeId || "—"}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}
