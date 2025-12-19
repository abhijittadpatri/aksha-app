"use client";

import { useEffect, useMemo, useState } from "react";

type Store = { id: string; name: string; city?: string | null };

type MeUser = {
  id: string;
  role: string; // "ADMIN" | "BILLING" | "DOCTOR" | "SHOP_OWNER" etc
  stores?: Store[]; // from /api/me (already store objects)
};

function normalizeRole(r: any) {
  return String(r ?? "").toUpperCase();
}

export default function UserCreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [me, setMe] = useState<MeUser | null>(null);
  const [stores, setStores] = useState<Store[]>([]);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("BILLING");
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [tempPassword, setTempPassword] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const myRole = useMemo(() => normalizeRole(me?.role), [me?.role]);

  const allowedRoles = useMemo(() => {
    // ✅ Owners created manually only → never show SHOP_OWNER here
    if (myRole === "SHOP_OWNER") return ["ADMIN", "DOCTOR", "BILLING"];
    if (myRole === "ADMIN") return ["DOCTOR", "BILLING"];
    // fallback (shouldn’t happen because /users is protected)
    return ["DOCTOR", "BILLING"];
  }, [myRole]);

  const canAssignAdmin = myRole === "SHOP_OWNER"; // only owner can create admin

  useEffect(() => {
    if (!open) return;

    // load /api/me so we know role + allowed stores
    (async () => {
      try {
        const r = await fetch("/api/me", { credentials: "include" });
        const t = await r.text();
        const d = t ? JSON.parse(t) : { user: null };
        setMe(d.user ?? null);
      } catch {
        setMe(null);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    // load tenant stores
    fetch("/api/stores", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setStores(d.stores || []))
      .catch(() => setStores([]));
  }, [open]);

  // reset form every open
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

  // If role becomes invalid (e.g. admin can't create admin), auto-fix
  useEffect(() => {
    if (!open) return;
    if (!allowedRoles.includes(role)) setRole(allowedRoles[0] ?? "BILLING");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedRoles.join(","), open]);

  // Admin should only be able to assign within their stores.
  // We already enforce this on backend, but we also do UX-side filtering.
  const visibleStores = useMemo(() => {
    if (!me) return stores;
    if (myRole === "SHOP_OWNER") return stores;

    // ADMIN: show only stores returned by /api/me
    const allowed = new Set((me.stores ?? []).map((s) => s.id));
    return stores.filter((s) => allowed.has(s.id));
  }, [stores, me, myRole]);

  function toggleStore(id: string) {
    setStoreIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAllStores() {
    setStoreIds(visibleStores.map((s) => s.id));
  }

  function clearStores() {
    setStoreIds([]);
  }

  async function create() {
    setErr(null);

    const e = email.trim().toLowerCase();
    const nm = name.trim();
    const pw = tempPassword.trim();

    if (!e) return setErr("Email is required");
    if (pw.length < 6) return setErr("Temp password must be at least 6 characters");
    if (storeIds.length === 0) return setErr("Select at least one store");
    if (!allowedRoles.includes(role)) return setErr("You are not allowed to create this role");

    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: e,
          name: nm,
          role, // ADMIN/DOCTOR/BILLING
          storeIds,
          tempPassword: pw,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Failed to create user");
        setSaving(false);
        return;
      }

      onCreated();
      onClose();
    } catch (e: any) {
      setErr(String(e?.message ?? e ?? "Create failed"));
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
          Note: <span className="font-medium">Owners (SHOP_OWNER) are created manually</span>.{" "}
          {canAssignAdmin ? "As Owner you can create Admin/Doctor/Billing." : "As Admin you can create Doctor/Billing."}
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
              onChange={(e) => setRole(e.target.value)}
            >
              {/* Only render roles allowed for current user */}
              {allowedRoles.includes("DOCTOR") && <option value="DOCTOR">Doctor</option>}
              {allowedRoles.includes("BILLING") && <option value="BILLING">Billing</option>}
              {allowedRoles.includes("ADMIN") && <option value="ADMIN">Admin</option>}
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
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-500">Stores *</div>

            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs underline"
                onClick={selectAllStores}
                disabled={visibleStores.length === 0}
              >
                Select all
              </button>
              <button type="button" className="text-xs underline" onClick={clearStores}>
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {visibleStores.map((s) => {
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
                  <div className={`text-xs ${checked ? "text-white/80" : "text-gray-500"}`}>
                    {s.city ?? ""}
                  </div>
                </button>
              );
            })}

            {visibleStores.length === 0 && (
              <div className="text-sm text-gray-500">
                No stores available. (Check seed + store access.)
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
