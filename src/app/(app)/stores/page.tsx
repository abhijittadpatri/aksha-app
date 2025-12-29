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

function statusLabel(s: Store) {
  return s.isActive ? "Active" : "Disabled";
}

function statusPillClass(s: Store) {
  return s.isActive
    ? "bg-green-50 text-green-900 border-green-200"
    : "bg-gray-100 text-gray-800 border-gray-200";
}

export default function StoresPage() {
  const [me, setMe] = useState<any>(undefined);
  const [stores, setStores] = useState<Store[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Create modal
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  // Filters / Search
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");

  // Enable/Disable modal
  const [sdOpen, setSdOpen] = useState(false);
  const [sdStore, setSdStore] = useState<Store | null>(null);
  const [sdSaving, setSdSaving] = useState(false);
  const [sdErr, setSdErr] = useState<string | null>(null);

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
      // ✅ IMPORTANT: request all stores, including disabled
      const res = await fetch("/api/stores?all=1", { credentials: "include" });
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

  function openStatusModal(s: Store) {
    setSdErr(null);
    setSdStore(s);
    setSdOpen(true);
  }

  async function submitStatusChange() {
    if (!sdStore) return;

    const nextIsActive = !sdStore.isActive;

    setSdSaving(true);
    setSdErr(null);
    try {
      const res = await fetch(`/api/stores/${sdStore.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextIsActive }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSdErr(data.error ?? "Failed to update store");
        return;
      }

      setSdOpen(false);
      setSdStore(null);
      await load();
    } catch (e: any) {
      setSdErr(e?.message ?? "Failed to update store");
    } finally {
      setSdSaving(false);
    }
  }

  const filteredStores = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return (stores ?? []).filter((s) => {
      if (statusFilter === "active" && !s.isActive) return false;
      if (statusFilter === "disabled" && s.isActive) return false;

      if (!needle) return true;

      const hay = [
        s.name ?? "",
        s.city ?? "",
        s.address ?? "",
        String(s.id ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(needle);
    });
  }, [stores, q, statusFilter]);

  const counts = useMemo(() => {
    const all = stores.length;
    const active = stores.filter((s) => s.isActive).length;
    const disabled = all - active;
    return { all, active, disabled };
  }, [stores]);

  return (
    <main className="p-4 md:p-6 space-y-4">
      <div className="flex items-start md:items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Stores</h1>
          <p className="text-sm text-gray-500">Create stores and manage access.</p>
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

      {/* Controls */}
      <div className="card card-pad space-y-3">
        <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className={cls(
                "btn border",
                statusFilter === "all" ? "bg-black text-white border-black" : "bg-white"
              )}
              onClick={() => setStatusFilter("all")}
            >
              All ({counts.all})
            </button>
            <button
              className={cls(
                "btn border",
                statusFilter === "active" ? "bg-black text-white border-black" : "bg-white"
              )}
              onClick={() => setStatusFilter("active")}
            >
              Active ({counts.active})
            </button>
            <button
              className={cls(
                "btn border",
                statusFilter === "disabled" ? "bg-black text-white border-black" : "bg-white"
              )}
              onClick={() => setStatusFilter("disabled")}
            >
              Disabled ({counts.disabled})
            </button>
          </div>

          <div className="w-full md:w-[360px]">
            <input
              className="input"
              placeholder="Search stores (name, city, address, id)…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="text-xs text-gray-500">
          Tip: Disabled stores stay visible here, but your pickers can keep using <code>/api/stores</code>{" "}
          (without <code>?all=1</code>) to show only active ones.
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filteredStores.map((s) => (
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
                className={cls("text-[11px] px-2 py-1 rounded-full border shrink-0", statusPillClass(s))}
              >
                {statusLabel(s)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button className="text-sm underline" onClick={() => openStatusModal(s)}>
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

        {filteredStores.length === 0 && (
          <div className="p-4 text-sm text-gray-500 border rounded-2xl bg-white">
            No stores found.
          </div>
        )}
      </div>

      {/* Desktop table (cleaner) */}
      <div className="hidden md:block border rounded-2xl overflow-hidden bg-white">
        <div className="grid grid-cols-12 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide p-3">
          <div className="col-span-4">Store</div>
          <div className="col-span-3">City</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-2 text-right">Action</div>
        </div>

        {filteredStores.map((s) => (
          <div key={s.id} className="grid grid-cols-12 p-3 text-sm border-t items-center">
            <div className="col-span-4 min-w-0">
              <div className="font-medium truncate">{s.name}</div>
              <div className="text-xs text-gray-500 truncate">{s.address ?? "—"}</div>
            </div>

            <div className="col-span-3 min-w-0 truncate">{s.city ?? "—"}</div>

            <div className="col-span-3">
              <div className="flex items-center gap-2">
                <span className={cls("inline-flex text-[12px] px-2 py-1 rounded-full border", statusPillClass(s))}>
                  {statusLabel(s)}
                </span>
                {s.disabledAt && !s.isActive ? (
                  <span className="text-xs text-gray-500">
                    {new Date(s.disabledAt).toLocaleString()}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="col-span-2 text-right">
              <button className="text-sm underline" onClick={() => openStatusModal(s)}>
                {s.isActive ? "Disable" : "Enable"}
              </button>
            </div>
          </div>
        ))}

        {filteredStores.length === 0 && (
          <div className="p-4 text-sm text-gray-500">No stores found.</div>
        )}
      </div>

      {/* Enable/Disable Modal */}
      {sdOpen && sdStore && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl p-4 shadow">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">
                  {sdStore.isActive ? "Disable Store" : "Enable Store"}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {sdStore.name} • {sdStore.city ?? "—"}
                </div>
              </div>

              <button
                className="text-sm underline"
                onClick={() => {
                  if (sdSaving) return;
                  setSdOpen(false);
                  setSdErr(null);
                }}
              >
                Close
              </button>
            </div>

            <div className="mt-3 text-sm text-gray-700">
              {sdStore.isActive ? (
                <>
                  This store will be marked as <span className="font-medium">Disabled</span>. Disabled stores won’t appear
                  in store selection dropdowns (pickers).
                </>
              ) : (
                <>
                  This store will be marked as <span className="font-medium">Active</span> and will appear in store
                  selection dropdowns.
                </>
              )}
            </div>

            {sdErr && <div className="mt-3 text-sm text-red-600">{sdErr}</div>}

            <div className="mt-4 flex items-center gap-2">
              <button
                className="btn border flex-1"
                onClick={() => {
                  if (sdSaving) return;
                  setSdOpen(false);
                  setSdStore(null);
                }}
                disabled={sdSaving}
              >
                Cancel
              </button>

              <button
                className={cls(
                  "btn flex-1",
                  sdStore.isActive ? "bg-gray-900 text-white" : "bg-black text-white",
                  sdSaving && "opacity-60"
                )}
                onClick={submitStatusChange}
                disabled={sdSaving}
              >
                {sdSaving ? "Saving..." : sdStore.isActive ? "Disable" : "Enable"}
              </button>
            </div>
          </div>
        </div>
      )}

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
