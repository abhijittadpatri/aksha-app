"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";

type Store = { id: string; name: string; city?: string | null };

export type CreatedPayload = { email: string; tempPassword: string } | undefined;

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

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
    setStoreIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function create() {
    setErr(null);

    const e = email.trim().toLowerCase();
    if (!e) return setErr("Email is required");
    if (!tempPassword || tempPassword.trim().length < 6) return setErr("Temp password must be at least 6 characters");
    if (storeIds.length === 0) return setErr("Select at least one store");

    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: e,
          name: name.trim(),
          role,
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

      onCreated({ email: e, tempPassword: tempPassword.trim() });
      onClose();
    } catch (e: any) {
      setErr(String(e?.message ?? "Create failed"));
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (saving) return;
        onClose();
      }}
      title="Create User"
      description="Create Admin, Doctor, or Billing users (owners are created manually)."
      size="md"
      closeOnBackdrop
      closeOnEsc
      preventCloseWhileBusy
      busy={saving}
      footer={
        <div className="pt-4 flex flex-col sm:flex-row gap-2">
          <button className="btn btn-primary w-full" onClick={create} disabled={saving} type="button">
            {saving ? "Creating…" : "Create User"}
          </button>
          <button className="btn btn-secondary w-full" onClick={onClose} disabled={saving} type="button">
            Cancel
          </button>
        </div>
      }
    >
      <div className="surface-muted p-3 text-xs">
        <span className="font-semibold">Note:</span> Owners (<code>SHOP_OWNER</code>) are created manually for security
        reasons.
      </div>

      {err && <div className="text-sm text-red-400">{err}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="label mb-1">Email *</div>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@clinic.com"
            autoComplete="off"
            inputMode="email"
          />
        </div>

        <div>
          <div className="label mb-1">Name</div>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            autoComplete="off"
          />
        </div>

        <div>
          <div className="label mb-1">Role *</div>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as any)}>
            <option value="ADMIN">Admin</option>
            <option value="DOCTOR">Doctor</option>
            <option value="BILLING">Billing</option>
          </select>
        </div>

        <div>
          <div className="label mb-1">Temp Password *</div>
          <input
            className="input"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            placeholder="Min 6 characters"
            type="password"
            autoComplete="new-password"
          />
          <div className="text-[11px] muted mt-1">User will be forced to change on next login.</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="label">Stores *</div>
          <div className="text-[11px] muted">Selected: {storeIds.length}</div>
        </div>

        <div className="surface-muted p-2 max-h-[40vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {stores.map((s) => {
              const checked = storeIds.includes(s.id);
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => toggleStore(s.id)}
                  className={cls(
                    "text-left text-sm rounded-xl px-3 py-2 transition border",
                    checked
                      ? "bg-[rgba(var(--brand),0.18)] border-[rgba(var(--brand),0.32)]"
                      : "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.05)]"
                  )}
                >
                  <div className="font-medium truncate">{s.name}</div>
                  <div className={cls("text-xs truncate", checked ? "text-[rgba(var(--fg),0.85)]" : "muted")}>
                    {s.city ?? ""}
                  </div>
                </button>
              );
            })}

            {stores.length === 0 && <div className="text-sm muted p-2">No stores found.</div>}
          </div>
        </div>

        {storeIds.length === 0 && <div className="text-[11px] muted">Tip: choose at least one store.</div>}
      </div>
    </Modal>
  );
}
