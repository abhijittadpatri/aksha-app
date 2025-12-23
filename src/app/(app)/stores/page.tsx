"use client";

import { useEffect, useMemo, useState } from "react";

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type Store = {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  isActive: boolean;
  disabledAt?: string | null;
  createdAt?: string;
};

export default function StoresPage() {
  const [me, setMe] = useState<any>(undefined);
  const [stores, setStores] = useState<Store[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // create modal
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        setMe(data.user ?? null);
      } catch {
        setMe(null);
      }
    })();
  }, []);

  const canManage = useMemo(() => {
    const r = String(me?.role ?? "").toUpperCase();
    return r === "ADMIN" || r === "SHOP_OWNER";
  }, [me?.role]);

  if (me === null) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }
  if (me && !canManage) {
    if (typeof window !== "undefined") window.location.href = "/dashboard";
    return null;
  }

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stores", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Failed to load stores");
        setStores([]);
        return;
      }
      setStores(data.stores ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load stores");
      setStores([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createStore() {
    setErr(null);
    const nm = name.trim();
    if (!nm) {
      setErr("Store name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nm,
          city: city.trim() || null,
          address: address.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Failed to create store");
        return;
      }

      setOpen(false);
      setName("");
      setCity("");
      setAddress("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function setStoreActive(storeId: string, isActive: boolean) {
    const ok = confirm(
      isActive
        ? "Enable this store?"
        : "Disable this store?\n\nDisabled stores will not appear in store selection."
    );
    if (!ok) return;

    setErr(null);
    try {
      const res = await fetch(`/api/stores/${storeId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Failed to update store");
        return;
      }
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update store");
    }
  }

  return (
    <main className="p-4 md:p-6 space-y-4">
      <div className="flex items-start md:items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Stores</h1>
          <p className="text-sm text-gray-500">Create, enable/disable stores.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="border px-3 py-2 rounded-lg text-sm"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            className="bg-black text-white px-3 py-2 rounded-lg text-sm"
            onClick={() => setOpen(true)}
          >
            + Add Store
          </button>
        </div>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {stores.map((s) => (
          <div key={s.id} className="border rounded-2xl bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{s.name}</div>
                <div className="text-sm text-gray-600 truncate">{s.city ?? ""}</div>
                {s.address ? (
                  <div className="text-xs text-gray-500 break-words mt-1">{s.address}</div>
                ) : null}
              </div>

              <span
                className={cls(
                  "text-[11px] px-2 py-1 rounded-full shrink-0",
                  s.isActive ? "bg-green-50 text-green-800" : "bg-gray-100 text-gray-700"
                )}
              >
                {s.isActive ? "Active" : "Disabled"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                className="text-sm underline"
                onClick={() => setStoreActive(s.id, !s.isActive)}
              >
                {s.isActive ? "Disable" : "Enable"}
              </button>

              <div className="text-xs text-gray-500">
                {s.disabledAt && !s.isActive
                  ? `Disabled: ${new Date(s.disabledAt).toLocaleString()}`
                  : ""}
              </div>
            </div>
          </div>
        ))}

        {stores.length === 0 && (
          <div className="p-4 text-sm text-gray-500 border rounded-2xl bg-white">
            No stores yet.
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block border rounded-xl overflow-hidden bg-white">
        <div className="grid grid-cols-6 bg-gray-50 text-sm font-medium p-3">
          <div>Name</div>
          <div>City</div>
          <div className="col-span-2">Address</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {stores.map((s) => (
          <div key={s.id} className="grid grid-cols-6 p-3 text-sm border-t items-center">
            <div className="min-w-0 truncate">{s.name}</div>
            <div className="min-w-0 truncate">{s.city ?? "-"}</div>
            <div className="col-span-2 min-w-0 truncate">{s.address ?? "-"}</div>

            <div>
              <span
                className={cls(
                  "text-xs px-2 py-1 rounded-full",
                  s.isActive ? "bg-green-50 text-green-800" : "bg-gray-100 text-gray-700"
                )}
              >
                {s.isActive ? "Active" : "Disabled"}
              </span>
            </div>

            <div>
              <button className="text-sm underline" onClick={() => setStoreActive(s.id, !s.isActive)}>
                {s.isActive ? "Disable" : "Enable"}
              </button>
            </div>
          </div>
        ))}

        {stores.length === 0 && (
          <div className="p-4 text-sm text-gray-500">No stores yet.</div>
        )}
      </div>

      {/* Create store modal */}
      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-xl rounded-2xl p-4 space-y-4 shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Store</h2>
              <button className="text-sm underline" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">Store Name *</div>
                <input
                  className="w-full border rounded-lg p-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Aksha Banjara Hills"
                />
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">City</div>
                <input
                  className="w-full border rounded-lg p-2"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g., Hyderabad"
                />
              </div>

              <div className="md:col-span-2">
                <div className="text-xs text-gray-500 mb-1">Address</div>
                <input
                  className="w-full border rounded-lg p-2"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <button
              className="w-full bg-black text-white rounded-lg p-2 disabled:opacity-50"
              onClick={createStore}
              disabled={saving}
            >
              {saving ? "Creating..." : "Create Store"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
