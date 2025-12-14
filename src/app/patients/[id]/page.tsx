"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

function fmt(v: any) {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}

function money(n: any) {
  const x = Number(n || 0);
  return x.toFixed(2);
}

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const patientId = (params?.id as string) || "";

  const [patient, setPatient] = useState<Patient | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [err, setErr] = useState<string | null>(null);

  // ===== Prescriptions =====
  const [rxOpen, setRxOpen] = useState(false);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [rxErr, setRxErr] = useState<string | null>(null);
  const [showRxDebug, setShowRxDebug] = useState(false);

  const [rSphere, setRSphere] = useState("");
  const [rCyl, setRCyl] = useState("");
  const [rAxis, setRAxis] = useState("");
  const [rAdd, setRAdd] = useState("");

  const [lSphere, setLSphere] = useState("");
  const [lCyl, setLCyl] = useState("");
  const [lAxis, setLAxis] = useState("");
  const [lAdd, setLAdd] = useState("");

  const [pd, setPd] = useState("");
  const [notes, setNotes] = useState("");

  // ===== Orders =====
  const [orders, setOrders] = useState<any[]>([]);
  const [orderErr, setOrderErr] = useState<string | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);

  const [orderItemName, setOrderItemName] = useState("Frame + Lenses");
  const [orderQty, setOrderQty] = useState("1");
  const [orderRate, setOrderRate] = useState("2500");

  // ===== Invoices =====
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invErr, setInvErr] = useState<string | null>(null);

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

  async function loadPatient() {
    setErr(null);
    if (!patientId) return;

    const res = await fetch(`/api/patients/${patientId}`, { credentials: "include" });
    const data = await safeJson(res);

    if (!res.ok) {
      setErr(data.error ?? "Failed to load patient");
      return;
    }
    setPatient(data.patient ?? null);
  }

  async function loadPrescriptions() {
    setRxErr(null);
    if (!patientId) return;

    const res = await fetch(`/api/prescriptions?patientId=${patientId}`, {
      credentials: "include",
    });
    const data = await safeJson(res);

    if (!res.ok) {
      setRxErr(data.error ?? "Failed to load prescriptions");
      setPrescriptions([]);
      return;
    }
    setPrescriptions(data.prescriptions ?? []);
  }

  async function createPrescription() {
    setRxErr(null);

    const storeId = getActiveStoreId();
    if (!storeId) {
      setRxErr("No active store selected.");
      return;
    }

    const rxJson = {
      right: { sphere: rSphere, cyl: rCyl, axis: rAxis, add: rAdd },
      left: { sphere: lSphere, cyl: lCyl, axis: lAxis, add: lAdd },
      pd,
      notes,
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

    if (data.prescription) setPrescriptions((prev) => [data.prescription, ...prev]);

    setRxOpen(false);

    setRSphere(""); setRCyl(""); setRAxis(""); setRAdd("");
    setLSphere(""); setLCyl(""); setLAxis(""); setLAdd("");
    setPd(""); setNotes("");

    await loadPrescriptions();
  }

  async function loadOrders() {
    setOrderErr(null);
    if (!patientId) return;

    const res = await fetch(`/api/orders?patientId=${patientId}`, {
      credentials: "include",
    });
    const data = await safeJson(res);

    if (!res.ok) {
      setOrderErr(data.error ?? "Failed to load orders");
      setOrders([]);
      return;
    }
    setOrders(data.orders ?? []);
  }

  async function createOrder() {
    setOrderErr(null);

    const storeId = getActiveStoreId();
    if (!storeId) {
      setOrderErr("No active store selected.");
      return;
    }

    const latestRxId = prescriptions?.[0]?.id ?? null;

    const itemsJson = {
      items: [
        {
          name: orderItemName,
          qty: Number(orderQty || 1),
          rate: Number(orderRate || 0),
        },
      ],
    };

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

    if (data.order) setOrders((prev) => [data.order, ...prev]);
    setOrderOpen(false);

    await loadOrders();
  }

  async function loadInvoices() {
    setInvErr(null);
    if (!patientId) return;

    const res = await fetch(`/api/invoices?patientId=${patientId}`, { credentials: "include" });
    const data = await safeJson(res);

    if (!res.ok) {
      setInvErr(data.error ?? "Failed to load invoices");
      setInvoices([]);
      return;
    }
    setInvoices(data.invoices ?? []);
  }

async function generateInvoiceFromLatestOrder() {
  try {
    setInvErr(null);

    if (!patientId) {
      setInvErr("DEBUG: patientId missing");
      return;
    }

    const storeId = getActiveStoreId();
    if (!storeId) {
      setInvErr("DEBUG: activeStoreId missing (select a store in header once)");
      return;
    }

    const latestOrderId = orders?.[0]?.id;
    if (!latestOrderId) {
      setInvErr("DEBUG: no orders found for this patient");
      return;
    }

    setInvErr("DEBUG: calling POST /api/invoices ...");

    const res = await fetch("/api/invoices", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId,
        storeId,
        orderId: latestOrderId,
        discount: 0,
        paid: false,
        paymentMode: "Cash",
      }),
    });

    const data = await safeJson(res);

    if (!res.ok) {
      const msg = data?.error ? String(data.error) : `HTTP ${res.status}`;
      setInvErr("DEBUG: API error: " + msg);
      console.log("Invoice API error", res.status, data);
      return;
    }

    if (data.invoice?.id) {
      setInvErr("DEBUG: invoice created ✅ redirecting...");
      window.location.href = `/invoices/${data.invoice.id}`;
      return;
    }

    setInvErr("DEBUG: API OK but invoice missing in response. Reloading list...");
    await loadInvoices();
  } catch (e: any) {
    setInvErr("DEBUG: exception: " + (e?.message ?? String(e)));
    console.log("Invoice exception", e);
  }
}

async function generateInvoiceForOrder(orderId: string) {
  try {
    setInvErr(null);

    if (!patientId) {
      setInvErr("DEBUG: patientId missing");
      return;
    }

    const storeId = getActiveStoreId();
    if (!storeId) {
      setInvErr("Select a store in header once (activeStoreId missing).");
      return;
    }

    if (!orderId) {
      setInvErr("OrderId missing.");
      return;
    }

    const res = await fetch("/api/invoices", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId,
        storeId,
        orderId,
        discount: 0,
        paid: false,
        paymentMode: "Cash",
      }),
    });

    const data = await safeJson(res);

    if (!res.ok) {
      const msg = data?.error ? String(data.error) : `HTTP ${res.status}`;
      setInvErr("Invoice API error: " + msg);
      return;
    }

    if (data.invoice?.id) {
      setInvoices((prev) => [data.invoice, ...prev]);
      window.location.href = `/invoices/${data.invoice.id}`;
      return;
    }

    await loadInvoices();
  } catch (e: any) {
    setInvErr("Invoice exception: " + (e?.message ?? String(e)));
  }
}

  useEffect(() => {
    if (!patientId) return;
    loadPatient();
    loadPrescriptions();
    loadOrders();
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link className="underline text-sm" href="/patients">
            ← Back to Patients
          </Link>

          <h1 className="text-xl font-semibold mt-2">
            {patient ? patient.name : "Loading..."}
          </h1>

          {patient && (
            <div className="text-sm text-gray-600">
              {patient.mobile ? `📞 ${patient.mobile}` : ""}
              {patient.gender ? ` • ${patient.gender}` : ""}
              {patient.age ? ` • ${patient.age} yrs` : ""}
            </div>
          )}
        </div>

        <button
          className="bg-black text-white px-3 py-2 rounded-lg"
          onClick={() => {
            setTab("Prescriptions");
            setRxOpen(true);
          }}
        >
          + New Prescription
        </button>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            className={`px-3 py-2 rounded-lg border text-sm ${
              tab === t ? "bg-black text-white" : "bg-white"
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="border rounded-xl p-4">
        {tab === "Overview" && (
          <div className="space-y-2">
            <div>
              <span className="font-medium">Patient ID:</span> {patient?.id}
            </div>
            <div>
              <span className="font-medium">Address:</span> {patient?.address ?? "-"}
            </div>
            <div className="text-gray-600 text-sm">
              Demo flow: Prescription → Order → Invoice → Print/WhatsApp.
            </div>
          </div>
        )}

        {tab === "Prescriptions" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">Prescriptions</div>

              <div className="flex gap-2">
                <button
                  className="border px-3 py-2 rounded-lg text-sm"
                  onClick={() => setShowRxDebug((v) => !v)}
                >
                  {showRxDebug ? "Hide Debug JSON" : "Show Debug JSON"}
                </button>

                <button
                  className="bg-black text-white px-3 py-2 rounded-lg text-sm"
                  onClick={() => setRxOpen(true)}
                >
                  + Add Prescription
                </button>
              </div>
            </div>

            {rxErr && <div className="text-sm text-red-600">{rxErr}</div>}

            <div className="border rounded-lg overflow-hidden">
              {prescriptions.map((rx) => (
                <div key={rx.id} className="p-3 border-b">
                  <div className="text-sm font-medium">Prescription</div>
                  <div className="text-xs text-gray-600">
                    {new Date(rx.createdAt).toLocaleString()}
                  </div>

                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="border rounded-lg p-3">
                      <div className="font-medium text-sm mb-2">Right (OD)</div>
                      <div className="text-sm">Sphere: {fmt(rx.rxJson?.right?.sphere)}</div>
                      <div className="text-sm">Cyl: {fmt(rx.rxJson?.right?.cyl)}</div>
                      <div className="text-sm">Axis: {fmt(rx.rxJson?.right?.axis)}</div>
                      <div className="text-sm">Add: {fmt(rx.rxJson?.right?.add)}</div>
                    </div>

                    <div className="border rounded-lg p-3">
                      <div className="font-medium text-sm mb-2">Left (OS)</div>
                      <div className="text-sm">Sphere: {fmt(rx.rxJson?.left?.sphere)}</div>
                      <div className="text-sm">Cyl: {fmt(rx.rxJson?.left?.cyl)}</div>
                      <div className="text-sm">Axis: {fmt(rx.rxJson?.left?.axis)}</div>
                      <div className="text-sm">Add: {fmt(rx.rxJson?.left?.add)}</div>
                    </div>
                  </div>

                  <div className="mt-2 text-sm">
                    <span className="font-medium">PD:</span> {fmt(rx.rxJson?.pd)}{" "}
                    <span className="font-medium">Notes:</span> {fmt(rx.rxJson?.notes)}
                  </div>

                  {showRxDebug && (
                    <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-auto">
                      {JSON.stringify(rx.rxJson, null, 2)}
                    </pre>
                  )}
                </div>
              ))}

              {prescriptions.length === 0 && (
                <div className="p-4 text-sm text-gray-500">No prescriptions yet.</div>
              )}
            </div>
          </div>
        )}

        {tab === "Orders" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Spectacle Orders</div>
              <button
                className="bg-black text-white px-3 py-2 rounded-lg text-sm"
                onClick={() => setOrderOpen(true)}
              >
                + Create Order
              </button>
            </div>

            {orderErr && <div className="text-sm text-red-600">{orderErr}</div>}

            <div className="border rounded-lg overflow-hidden">
              {orders.map((o) => {
                const items = o.itemsJson?.items ?? [];
                const sub = items.reduce((s: number, it: any) => {
                  const qty = Number(it.qty || 0);
                  const rate = Number(it.rate || 0);
                  return s + qty * rate;
                }, 0);

                return (
                  <div key={o.id} className="p-3 border-b">
                    <div className="flex justify-between items-center gap-2">
                      <div className="text-sm font-medium">Order</div>

                      <div className="flex items-center gap-2">
                        <div className="text-xs px-2 py-1 rounded bg-gray-100">{o.status}</div>

                        {invoices.some((iv) => iv.orderId === o.id) ? (
                          <span className="text-xs text-green-700">Billed</span>
                        ) : (
                          <button
                            className="border px-2 py-1 rounded-lg text-xs"
                            onClick={() => generateInvoiceForOrder(o.id)}
                          >
                            Generate Invoice
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      {new Date(o.createdAt).toLocaleString()} • Amount ₹{money(sub)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Order ID: {String(o.id).slice(-6)} •{" "}
                      {invoices.some((iv) => iv.orderId === o.id) ? "Billed" : "Unbilled"}
                    </div>


                    <div className="mt-2 border rounded-lg overflow-hidden">
                      <div className="grid grid-cols-4 bg-gray-50 text-sm p-2 font-medium">
                        <div className="col-span-2">Item</div>
                        <div className="text-right">Qty</div>
                        <div className="text-right">Rate</div>
                      </div>

                      {items.map((it: any, idx: number) => (
                        <div key={idx} className="grid grid-cols-4 text-sm p-2 border-t">
                          <div className="col-span-2">{it.name}</div>
                          <div className="text-right">{Number(it.qty || 0)}</div>
                          <div className="text-right">₹{money(it.rate)}</div>
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-gray-600 mt-2">
                      Linked Rx: {o.prescriptionId ?? "—"}
                    </div>
                  </div>
                );
              })}

              {orders.length === 0 && (
                <div className="p-4 text-sm text-gray-500">No orders yet.</div>
              )}
            </div>
          </div>
        )}

        {tab === "Invoices" && (
          <div className="space-y-3">
            <div className="text-xs text-blue-600">DEBUG: Invoices tab rendered ✅</div>
            <div className="flex items-center justify-between">
              <div className="font-medium">Invoices</div>
            <button
              className="bg-black text-white px-3 py-2 rounded-lg text-sm"
              onClick={() => {
                setInvErr("DEBUG: Click registered ✅");
                generateInvoiceFromLatestOrder();
              }}
            >
              Generate Invoice (Latest Order)
            </button>


            </div>

            {invErr && <div className="text-sm text-red-600">{invErr}</div>}

            <div className="border rounded-lg overflow-hidden">
              {invoices.map((inv) => (
                <div key={inv.id} className="p-3 border-b flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{inv.invoiceNo}</div>
                    <div className="text-xs text-gray-600">
                      {new Date(inv.createdAt).toLocaleString()} • Total ₹{money(inv.total)}
                    </div>
                  </div>
                  <a className="underline text-sm" href={`/invoices/${inv.id}`}>
                    Open
                  </a>
                </div>
              ))}

              {invoices.length === 0 && (
                <div className="p-4 text-sm text-gray-500">No invoices yet.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Rx Modal */}
      {rxOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">New Prescription</h2>
              <button className="underline text-sm" onClick={() => setRxOpen(false)}>
                Close
              </button>
            </div>

            {rxErr && <div className="text-sm text-red-600">{rxErr}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border rounded-lg p-3 space-y-2">
                <div className="font-medium">Right Eye (OD)</div>
                <input className="w-full border rounded p-2" placeholder="Sphere" value={rSphere} onChange={(e)=>setRSphere(e.target.value)} />
                <input className="w-full border rounded p-2" placeholder="Cyl" value={rCyl} onChange={(e)=>setRCyl(e.target.value)} />
                <input className="w-full border rounded p-2" placeholder="Axis" value={rAxis} onChange={(e)=>setRAxis(e.target.value)} />
                <input className="w-full border rounded p-2" placeholder="Add" value={rAdd} onChange={(e)=>setRAdd(e.target.value)} />
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <div className="font-medium">Left Eye (OS)</div>
                <input className="w-full border rounded p-2" placeholder="Sphere" value={lSphere} onChange={(e)=>setLSphere(e.target.value)} />
                <input className="w-full border rounded p-2" placeholder="Cyl" value={lCyl} onChange={(e)=>setLCyl(e.target.value)} />
                <input className="w-full border rounded p-2" placeholder="Axis" value={lAxis} onChange={(e)=>setLAxis(e.target.value)} />
                <input className="w-full border rounded p-2" placeholder="Add" value={lAdd} onChange={(e)=>setLAdd(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="w-full border rounded p-2" placeholder="PD" value={pd} onChange={(e)=>setPd(e.target.value)} />
              <input className="w-full border rounded p-2" placeholder="Notes" value={notes} onChange={(e)=>setNotes(e.target.value)} />
            </div>

            <button className="w-full bg-black text-white rounded-lg p-2" onClick={createPrescription}>
              Save Prescription
            </button>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {orderOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Create Order</h2>
              <button className="underline text-sm" onClick={() => setOrderOpen(false)}>
                Close
              </button>
            </div>

            {orderErr && <div className="text-sm text-red-600">{orderErr}</div>}

            <input
              className="w-full border rounded p-2"
              placeholder="Item name (e.g., Frame + Lenses)"
              value={orderItemName}
              onChange={(e) => setOrderItemName(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <input className="w-full border rounded p-2" placeholder="Qty" value={orderQty} onChange={(e) => setOrderQty(e.target.value)} />
              <input className="w-full border rounded p-2" placeholder="Rate" value={orderRate} onChange={(e) => setOrderRate(e.target.value)} />
            </div>

            <button className="w-full bg-black text-white rounded-lg p-2" onClick={createOrder}>
              Save Order (Draft)
            </button>

            <div className="text-xs text-gray-600">
              Links to latest prescription automatically if present.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
