"use client";

import { useEffect, useState } from "react";

type Store = { id: string; name: string; city?: string | null };

export type CreatedPayload =
  | { email: string; tempPassword: string }
  | undefined;

export default function UserCreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (payload?: CreatedPayload) => void;
}) {
  const [stores, setStores] = useState<Store[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "DOCTOR" | "BILLING">("BILLING");
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [tempPassword, setTempPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load stores when opened
  useEffect(() => {
    if (!open) return;

    fetch("/api/stores", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setStores(d.stores || []))
      .catch(() => setStores([]));
  }, [open]);

  // Reset form when opened
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setEmail("");
    setName("");
    setRole("BILLING");
    setStoreIds([]);
    setTempPassword("");
    setSaving(false);
  }, [open]);

  function toggleStore(id: string) {
    setStoreIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function create() {
    setErr(null);

    const e = email.trim().toLowerCase();
    if (!e) return setErr("Email is required");
    if (!tempPassword || tempPassword.trim().length < 6)
      return setErr("Temp password must be at least 6 characters");
    if (storeIds.length === 0)
      return setErr("Select at least one store");

    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: e,
          name: name.trim(),
          role, // ADMIN | DOCTOR | BILLING only
          storeIds,
          tempPassword: tempPassword.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Failed to create user");
        setSaving(false);
        return;
      }

      // Pass invite details back to Users page
      onCreated({
        email: e,
        tempPassword: tempPassword.trim(),
      });

      onClose();
    } catch (e: any) {
      setErr(String(e?.message ?? "Create failed"));
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-xl rounded-2xl p-4 space-y-4 shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create User</h2>
          <button className="text-sm underline" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="text-xs text-gray-600">
          <strong>Note:</strong> Owners (<code>SHOP_OWNER</code>) are created
          manually for security reasons. You can create Admin, Doctor, or
          Billing users here.
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Email *</div>
            <input
              className="w-full border rounded-lg p-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@clinic.com"
              autoComplete="off"
            />
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Name</div>
            <input
              className="w-full border rounded-lg p-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoComplete="off"
            />
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Role *</div>
            <select
              className="w-full border rounded-lg p-2"
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
            >
              <option value="ADMIN">Admin</option>
              <option value="DOCTOR">Doctor</option>
              <option value="BILLING">Billing</option>
            </select>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Temp Password *</div>
            <input
              className="w-full border rounded-lg p-2"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              placeholder="Min 6 characters"
              type="text"
              autoComplete="off"
            />
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-2">Stores *</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {stores.map((s) => {
              const checked = storeIds.includes(s.id);
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => toggleStore(s.id)}
                  className={`border rounded-lg p-2 text-left text-sm ${
                    checked ? "bg-black text-white" : "bg-white"
                  }`}
                >
                  <div className="font-medium">{s.name}</div>
                  <div
                    className={`text-xs ${
                      checked ? "text-white/80" : "text-gray-500"
                    }`}
                  >
                    {s.city ?? ""}
                  </div>
                </button>
              );
            })}

            {stores.length === 0 && (
              <div className="text-sm text-gray-500">
                No stores found. (Seed should create stores.)
              </div>
            )}
          </div>
        </div>

        <button
          className="w-full bg-black text-white rounded-lg p-2 disabled:opacity-50"
          onClick={create}
          disabled={saving}
        >
          {saving ? "Creating..." : "Create User"}
        </button>
      </div>
    </div>
  );
}
