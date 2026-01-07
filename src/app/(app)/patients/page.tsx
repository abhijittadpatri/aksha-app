"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Patient = {
  id: string;
  name: string;
  mobile?: string | null;
  age?: number | null;
  gender?: string | null;
  createdAt: string;
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

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

  // form
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [age, setAge] = useState<string>("");
  const [gender, setGender] = useState("Male");
  const [address, setAddress] = useState("");

  const activeStoreId =
    typeof window !== "undefined" ? localStorage.getItem("activeStoreId") : null;

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

    if (!name.trim()) {
      setErr("Name is required");
      return;
    }

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

      if (!res.ok) {
        setErr(data.error ?? "Failed to create patient");
        return;
      }

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
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="h1">Patients</h1>
            <p className="subtle">Search, add and manage patient records.</p>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <button
              className="btn btn-ghost border w-full md:w-auto"
              onClick={load}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>

            <button
              className="btn btn-primary w-full md:w-auto"
              onClick={() => setOpen(true)}
            >
              + Add Patient
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="card card-pad">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              className="input"
              placeholder="Search by name or mobile…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="btn btn-ghost border w-full md:w-auto"
                onClick={() => setQ("")}
                disabled={!q.trim()}
                title="Clear search"
              >
                Clear
              </button>
              <div className="badge">{filtered.length} result(s)</div>
            </div>
          </div>

          {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {loading && filtered.length === 0 && !err && (
            <div className="text-sm text-gray-500">Loading patients…</div>
          )}

          {filtered.map((p) => (
            <div key={p.id} className="card card-pad">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="mt-1 text-xs text-gray-600">
                    {p.mobile ? `📞 ${p.mobile}` : "—"}
                    {p.gender ? ` • ${p.gender}` : ""}
                    {p.age ? ` • ${p.age} yrs` : ""}
                  </div>
                </div>

                <Link className="btn btn-ghost border shrink-0" href={`/patients/${p.id}`}>
                  Open
                </Link>
              </div>
            </div>
          ))}

          {!loading && filtered.length === 0 && (
            <div className="card card-pad text-sm text-gray-500">
              No patients yet for this store.
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block table">
          <div className="table-head grid-cols-12 p-3">
            <div className="col-span-5">Name</div>
            <div className="col-span-4">Details</div>
            <div className="col-span-3 text-right">Action</div>
          </div>

          {loading && filtered.length === 0 && !err && (
            <div className="p-4 text-sm text-gray-500">Loading patients…</div>
          )}

          {filtered.map((p) => (
            <div
              key={p.id}
              className="table-row grid-cols-12 p-3 items-center"
            >
              <div className="col-span-5 min-w-0">
                <div className="font-medium truncate">{p.name}</div>
              </div>

              <div className="col-span-4 min-w-0">
                <div className="text-xs text-gray-600 truncate">
                  {p.mobile ? `📞 ${p.mobile}` : "—"}
                  {p.gender ? ` • ${p.gender}` : ""}
                  {p.age ? ` • ${p.age} yrs` : ""}
                </div>
              </div>

              <div className="col-span-3 text-right">
                <Link className="btn btn-ghost border" href={`/patients/${p.id}`}>
                  Open
                </Link>
              </div>
            </div>
          ))}

          {!loading && filtered.length === 0 && (
            <div className="p-6 text-gray-500">
              No patients yet for this store.
            </div>
          )}
        </div>

        {/* Modal */}
        {open && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-md rounded-2xl p-4 shadow max-h-[85vh] overflow-auto space-y-3">
              <div className="flex justify-between items-center gap-3">
                <h2 className="text-lg font-semibold">Add Patient</h2>
                <button
                  className="btn btn-ghost border"
                  onClick={() => {
                    setOpen(false);
                    setErr(null);
                  }}
                  disabled={saving}
                >
                  Close
                </button>
              </div>

              {err && <div className="text-sm text-red-600">{err}</div>}

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
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    className="input"
                    placeholder="Age"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
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

                <div className="flex gap-2">
                  <button
                    className="btn btn-primary w-full disabled:opacity-60"
                    disabled={!name.trim() || saving}
                    onClick={createPatient}
                  >
                    {saving ? "Saving..." : "Save Patient"}
                  </button>

                  <button
                    className="btn btn-ghost border w-full"
                    onClick={() => {
                      setOpen(false);
                      resetForm();
                      setErr(null);
                    }}
                    type="button"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>

                <div className="text-xs text-gray-500">
                  Tip: Search supports name + mobile.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
