"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(undefined);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function safeJson(res: Response) {
    const t = await res.text();
    try { return t ? JSON.parse(t) : {}; } catch { return {}; }
  }

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me", { credentials: "include" });
      const data = await safeJson(res);
      setMe(data.user ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    setErr(null);

    const n = name.trim();
    if (!n) return setErr("Store name is required");

    setSaving(true);
    const res = await fetch("/api/setup", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n, city: city.trim(), address: address.trim() }),
    });

    const data = await safeJson(res);
    setSaving(false);

    if (!res.ok) {
      setErr(data.error ?? "Setup failed");
      return;
    }

    // Persist active store
    if (typeof window !== "undefined" && data.store?.id) {
      localStorage.setItem("activeStoreId", data.store.id);
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (me === undefined) {
    return (
      <main className="p-6">
        <div className="text-sm text-gray-600">Loading…</div>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="p-6">
        <div className="text-sm text-red-600">Please login first.</div>
      </main>
    );
  }

  const role = String(me.role || "");
  if (role !== "OWNER" && role !== "ADMIN") {
    return (
      <main className="p-6">
        <div className="text-sm text-red-600">Forbidden (OWNER/ADMIN only).</div>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-6">
      <div className="max-w-xl space-y-4">
        <div className="rounded-2xl border bg-white p-5 space-y-2">
          <div className="text-xl font-semibold">Setup your first store</div>
          <div className="text-sm text-gray-600">
            This runs once to create the initial clinic/store in production.
          </div>
        </div>

        {err && (
          <div className="rounded-xl border bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="rounded-2xl border bg-white p-5 space-y-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Store name *</div>
            <input
              className="w-full border rounded-lg p-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aksha Clinic - MG Road"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">City</div>
              <input
                className="w-full border rounded-lg p-2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Bengaluru"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Address</div>
              <input
                className="w-full border rounded-lg p-2"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, area (optional)"
              />
            </div>
          </div>

          <button
            className="w-full bg-black text-white rounded-lg p-2 disabled:opacity-60"
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Creating…" : "Create Store & Continue"}
          </button>

          <div className="text-xs text-gray-500">
            After this, go to <span className="font-medium">Users</span> to add doctors and billing staff.
          </div>
        </div>
      </div>
    </main>
  );
}
