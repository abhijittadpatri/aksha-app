// src/app/(app)/stores/page.tsx
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

function safeDate(d: any) {
  try {
    return d ? new Date(d).toLocaleString() : "";
  } catch {
    return "";
  }
}

function statusLabel(s: Store) {
  return s.isActive ? "Active" : "Disabled";
}

function statusBadgeKind(s: Store): "ok" | "muted" {
  return s.isActive ? "ok" : "muted";
}

function statusBadge(kind: "ok" | "warn" | "danger" | "muted", text: string) {
  const k =
    kind === "ok"
      ? "badge badge-ok"
      : kind === "warn"
      ? "badge badge-warn"
      : kind === "danger"
      ? "badge badge-danger"
      : "badge";
  return <span className={k}>{text}</span>;
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

      const hay = [s.name ?? "", s.city ?? "", s.address ?? "", String(s.id ?? "")]
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

  const filterBtn = (active: boolean) =>
    cls("btn btn-sm", active ? "btn-soft" : "btn-secondary");

  return (
    <main className="p-4 md:p-6">
      <div className="page space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="h1">Stores</h1>
            <p className="subtle">Create stores and manage access.</p>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <button className="btn btn-secondary w-full md:w-auto" onClick={load} disabled={loading} type="button">
              {loading ? "Refreshing…" : "Refresh"}
            </button>

            <button className="btn btn-primary w-full md:w-auto" onClick={() => setOpen(true)} type="button">
              + Add Store
            </button>
          </div>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        {/* Controls */}
        <div className="card card-pad space-y-3">
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <button className={filterBtn(statusFilter === "all")} onClick={() => setStatusFilter("all")} type="button">
                All <span className="badge ml-1">{counts.all}</span>
              </button>
              <button
                className={filterBtn(statusFilter === "active")}
                onClick={() => setStatusFilter("active")}
                type="button"
              >
                Active <span className="badge ml-1">{counts.active}</span>
              </button>
              <button
                className={filterBtn(statusFilter === "disabled")}
                onClick={() => setStatusFilter("disabled")}
                type="button"
              >
                Disabled <span className="badge ml-1">{counts.disabled}</span>
              </button>
            </div>

            <div className="w-full md:w-[380px]">
              <input
                className="input"
                placeholder="Search stores (name, city, address, id)…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="text-xs muted">
            Tip: Disabled stores stay visible here, but your pickers can keep using <code>/api/stores</code> (without{" "}
            <code>?all=1</code>) to show only active ones.
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {filteredStores.map((s) => (
            <div key={s.id} className="panel p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{s.name}</div>
                  <div className="text-sm muted truncate">{s.city ?? "—"}</div>
                  {s.address ? <div className="text-xs muted break-words mt-1">{s.address}</div> : null}
                </div>

                <div className="shrink-0">{statusBadge(statusBadgeKind(s), statusLabel(s))}</div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => openStatusModal(s)}>
                  {s.isActive ? "Disable" : "Enable"}
                </button>

                <div className="text-xs muted text-right">
                  {s.disabledAt && !s.isActive ? `Disabled: ${safeDate(s.disabledAt)}` : ""}
                </div>
              </div>
            </div>
          ))}

          {filteredStores.length === 0 && (
            <div className="panel p-4 text-sm muted">No stores found.</div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block table">
          <div className="table-head grid-cols-12 p-3">
            <div className="col-span-4">Store</div>
            <div className="col-span-3">City</div>
            <div className="col-span-3">Status</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          {filteredStores.map((s) => (
            <div key={s.id} className="table-row grid-cols-12 p-3 items-center">
              <div className="col-span-4 min-w-0">
                <div className="font-medium truncate">{s.name}</div>
                <div className="text-xs muted truncate">{s.address ?? "—"}</div>
              </div>

              <div className="col-span-3 min-w-0 truncate">{s.city ?? "—"}</div>

              <div className="col-span-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {statusBadge(statusBadgeKind(s), statusLabel(s))}
                  {s.disabledAt && !s.isActive ? <span className="text-xs muted">{safeDate(s.disabledAt)}</span> : null}
                </div>
              </div>

              <div className="col-span-2 text-right">
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => openStatusModal(s)}>
                  {s.isActive ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
          ))}

          {filteredStores.length === 0 && <div className="p-4 text-sm muted">No stores found.</div>}
        </div>

        {/* Enable/Disable Modal */}
        {sdOpen && sdStore && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal w-full max-w-md">
              <div className="card-pad space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold truncate">{sdStore.isActive ? "Disable Store" : "Enable Store"}</div>
                    <div className="text-xs muted truncate">
                      {sdStore.name} • {sdStore.city ?? "—"}
                    </div>
                  </div>

                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => {
                      if (sdSaving) return;
                      setSdOpen(false);
                      setSdErr(null);
                    }}
                  >
                    Close
                  </button>
                </div>

                <div className="text-sm" style={{ color: "rgb(var(--fg-muted))" }}>
                  {sdStore.isActive ? (
                    <>
                      This store will be marked as <span className="font-medium" style={{ color: "rgb(var(--fg))" }}>Disabled</span>.
                      Disabled stores won’t appear in store selection dropdowns (pickers).
                    </>
                  ) : (
                    <>
                      This store will be marked as <span className="font-medium" style={{ color: "rgb(var(--fg))" }}>Active</span> and will appear in store
                      selection dropdowns.
                    </>
                  )}
                </div>

                {sdErr && <div className="text-sm text-red-600">{sdErr}</div>}

                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-secondary flex-1"
                    type="button"
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
                    className={cls("btn flex-1", sdStore.isActive ? "btn-danger" : "btn-primary")}
                    type="button"
                    onClick={submitStatusChange}
                    disabled={sdSaving}
                  >
                    {sdSaving ? "Saving..." : sdStore.isActive ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create store modal */}
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal w-full max-w-xl">
              <div className="card-pad space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">Create Store</h2>
                    <div className="text-xs muted">Add a new store location.</div>
                  </div>

                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(false)} disabled={saving}>
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="label mb-1">Store Name *</div>
                    <input
                      className="input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Aksha Banjara Hills"
                    />
                  </div>

                  <div>
                    <div className="label mb-1">City</div>
                    <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Hyderabad" />
                  </div>

                  <div className="md:col-span-2">
                    <div className="label mb-1">Address</div>
                    <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="btn btn-secondary w-full" type="button" onClick={() => setOpen(false)} disabled={saving}>
                    Cancel
                  </button>

                  <button className="btn btn-primary w-full" type="button" onClick={createStore} disabled={saving || !name.trim()}>
                    {saving ? "Creating..." : "Create Store"}
                  </button>
                </div>

                {err && <div className="text-sm text-red-600">{err}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
