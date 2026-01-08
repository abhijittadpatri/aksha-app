// src/app/(app)/patients/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";

type Patient = {
  id: string;
  name: string;
  mobile?: string | null;
  age?: number | null;
  gender?: string | null;
  createdAt: string;
};

function safeJson(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Render exactly ONE list variant (mobile OR desktop) to avoid duplicate UI
  const [isDesktop, setIsDesktop] = useState(false);

  // form
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [age, setAge] = useState<string>("");
  const [gender, setGender] = useState("Male");
  const [address, setAddress] = useState("");

  const activeStoreId =
    typeof window !== "undefined" ? localStorage.getItem("activeStoreId") : null;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  async function load() {
    setErr(null);
    if (!activeStoreId) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/patients?storeId=${encodeURIComponent(activeStoreId)}`,
        { credentials: "include" }
      );

      const text = await res.text();
      const data = safeJson(text);

      if (!res.ok) {
        setErr(data.error ?? "Failed to load patients");
        setPatients([]);
        return;
      }

      setPatients(data.patients ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load patients");
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStoreId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return patients;
    return patients.filter((p) =>
      `${p.name} ${p.mobile ?? ""}`.toLowerCase().includes(s)
    );
  }, [patients, q]);

  function resetForm() {
    setName("");
    setMobile("");
    setAge("");
    setGender("Male");
    setAddress("");
  }

  async function createPatient() {
    setErr(null);
    if (!activeStoreId) return;

    if (!name.trim()) return setErr("Name is required");

    setSaving(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: activeStoreId,
          name: name.trim(),
          mobile: mobile.trim(),
          age: age ? String(age).trim() : "",
          gender,
          address: address.trim(),
        }),
      });

      const text = await res.text();
      const data = safeJson(text);

      if (!res.ok) return setErr(data.error ?? "Failed to create patient");

      setOpen(false);
      resetForm();
      load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create patient");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p-4 md:p-6">
      <div className="page space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="h1">Patients</h1>
            <p className="subtle">Search, add and manage patient records.</p>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <button
              className="btn btn-secondary w-full md:w-auto"
              onClick={load}
              disabled={loading}
              type="button"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>

            <button
              className="btn btn-primary w-full md:w-auto"
              onClick={() => {
                setErr(null);
                setOpen(true);
              }}
              type="button"
            >
              + Add Patient
            </button>
          </div>
        </div>

        {/* Search / toolbar */}
        <div className="card card-pad">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              className="input"
              placeholder="Search by name or mobile…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <div className="flex gap-2 items-center">
              <button
                className="btn btn-secondary"
                onClick={() => setQ("")}
                disabled={!q.trim()}
                type="button"
              >
                Clear
              </button>

              <span className="badge">{filtered.length} result(s)</span>
            </div>
          </div>

          {err && (
            <div
              className="mt-3 text-sm"
              style={{
                color: "rgb(var(--fg))",
                background: "rgba(var(--danger),0.14)",
                border: "1px solid rgba(var(--danger),0.22)",
                borderRadius: "12px",
                padding: "10px 12px",
              }}
            >
              {err}
            </div>
          )}

          {!activeStoreId ? (
            <div className="mt-3 text-xs muted">
              Select an active store in the sidebar to view patients.
            </div>
          ) : null}
        </div>

        {/* MOBILE (rendered only when !isDesktop) */}
        {!isDesktop && (
          <div className="space-y-3">
            {loading && filtered.length === 0 && !err && (
              <div className="text-sm subtle">Loading patients…</div>
            )}

            {filtered.map((p) => (
              <div key={p.id} className="panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="mt-1 text-xs muted">
                      {p.mobile ? `📞 ${p.mobile}` : "—"}
                      {p.gender ? ` • ${p.gender}` : ""}
                      {p.age ? ` • ${p.age} yrs` : ""}
                    </div>
                  </div>

                  <Link
                    className="btn btn-secondary btn-sm shrink-0"
                    href={`/patients/${p.id}`}
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}

            {!loading && filtered.length === 0 && (
              <div className="panel p-4 text-sm muted">
                No patients yet for this store.
              </div>
            )}
          </div>
        )}

        {/* DESKTOP (rendered only when isDesktop) */}
        {isDesktop && (
          <div className="table">
            <div className="table-head grid-cols-12 p-3">
              <div className="col-span-5">Name</div>
              <div className="col-span-4">Details</div>
              <div className="col-span-3 text-right">Action</div>
            </div>

            {loading && filtered.length === 0 && !err && (
              <div className="p-4 text-sm muted">Loading patients…</div>
            )}

            {filtered.map((p) => (
              <div
                key={p.id}
                className="table-row grid-cols-12 p-3 items-center"
              >
                <div className="col-span-5 min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                </div>

                <div className="col-span-4 text-xs muted truncate">
                  {p.mobile ? `📞 ${p.mobile}` : "—"}
                  {p.gender ? ` • ${p.gender}` : ""}
                  {p.age ? ` • ${p.age} yrs` : ""}
                </div>

                <div className="col-span-3 text-right">
                  <Link
                    className="btn btn-secondary btn-sm"
                    href={`/patients/${p.id}`}
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}

            {!loading && filtered.length === 0 && (
              <div className="p-6 muted">No patients yet for this store.</div>
            )}
          </div>
        )}

        {/* Add Patient (Standard Modal Shell) */}
        <Modal
          open={open}
          onClose={() => {
            if (saving) return;
            setOpen(false);
            setErr(null);
          }}
          title="Add Patient"
          description="Create a new patient record."
          size="md"
          busy={saving}
          footer={
            <div className="flex gap-2">
              <button
                className="btn btn-secondary flex-1"
                type="button"
                onClick={() => {
                  if (saving) return;
                  setOpen(false);
                  resetForm();
                  setErr(null);
                }}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="btn btn-primary flex-1"
                type="button"
                disabled={!name.trim() || saving}
                onClick={createPatient}
              >
                {saving ? "Saving…" : "Save Patient"}
              </button>
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
              }}
            >
              {err}
            </div>
          )}

          <div className="space-y-3">
            <input
              className="input"
              placeholder="Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              className="input"
              placeholder="Mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              inputMode="tel"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                className="input"
                placeholder="Age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                inputMode="numeric"
              />

              <select
                className="input"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>

            <input
              className="input"
              placeholder="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />

            <div className="text-xs muted">
              Tip: Search supports name + mobile.
            </div>
          </div>
        </Modal>
      </div>
    </main>
  );
}
