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

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

    const res = await fetch(
      `/api/patients?storeId=${encodeURIComponent(activeStoreId)}`,
      { credentials: "include" }
    );

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    if (!res.ok) {
      setErr(data.error ?? "Failed to load patients");
      return;
    }

    setPatients(data.patients ?? []);
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

  async function createPatient() {
    setErr(null);
    if (!activeStoreId) return;

    const res = await fetch("/api/patients", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: activeStoreId,
        name,
        mobile,
        age,
        gender,
        address,
      }),
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    if (!res.ok) {
      setErr(data.error ?? "Failed to create patient");
      return;
    }

    setOpen(false);
    setName("");
    setMobile("");
    setAge("");
    setGender("Male");
    setAddress("");
    load();
  }

  return (
    <main className="p-4 md:p-6">
      <div className="page space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="h1">Patients</h1>
          <p className="subtle">Search, add and manage patient records.</p>
          <button
            className="bg-black text-white px-3 py-2 rounded-lg"
            onClick={() => setOpen(true)}
          >
            + Add Patient
          </button>
        </div>

        <input
          className="w-full border rounded-lg p-2"
          placeholder="Search by name or mobile..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {err && <div className="text-sm text-red-600">{err}</div>}

        <div className="border rounded-xl overflow-hidden">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="p-3 border-b flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-gray-600">
                  {p.mobile ? `📞 ${p.mobile}` : ""}
                  {p.gender ? ` • ${p.gender}` : ""}
                  {p.age ? ` • ${p.age} yrs` : ""}
                </div>
              </div>
              <Link className="underline text-sm" href={`/patients/${p.id}`}>
                Open
              </Link>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-6 text-gray-500">
              No patients yet for this store.
            </div>
          )}
        </div>

        {open && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold">Add Patient</h2>
                <button
                  className="underline text-sm"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>

              <input
                className="w-full border rounded-lg p-2"
                placeholder="Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <input
                className="w-full border rounded-lg p-2"
                placeholder="Mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />

              <input
                className="w-full border rounded-lg p-2"
                placeholder="Age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />

              <select
                className="w-full border rounded-lg p-2"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>

              <input
                className="w-full border rounded-lg p-2"
                placeholder="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />

              <button
                className="w-full bg-black text-white rounded-lg p-2 disabled:opacity-60"
                disabled={!name}
                onClick={createPatient}
              >
                Save Patient
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
