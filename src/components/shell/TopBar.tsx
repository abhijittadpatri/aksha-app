"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Me = {
  id: string;
  email: string;
  name?: string | null;
  role: "ADMIN" | "SHOP_OWNER" | "DOCTOR" | "BILLING";
  tenant?: { name?: string | null } | null;
  stores?: { id: string; name: string; city?: string | null }[];
};

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  // Keep local state so UI updates immediately
  const [activeStoreId, setActiveStoreId] = useState<string>("");

  const isOwner = me?.role === "SHOP_OWNER";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        const user: Me | null = data.user ?? null;
        setMe(user);

        if (typeof window === "undefined") return;

        const saved = localStorage.getItem("activeStoreId");

        if (user?.stores?.length) {
          // Default selection
          if (!saved) {
            const def = user.role === "SHOP_OWNER" ? "all" : user.stores[0].id;
            localStorage.setItem("activeStoreId", def);
            setActiveStoreId(def);
          } else {
            // Non-owners cannot stay on "all"
            if (saved === "all" && user.role !== "SHOP_OWNER") {
              const def = user.stores[0].id;
              localStorage.setItem("activeStoreId", def);
              setActiveStoreId(def);
            } else {
              setActiveStoreId(saved);
            }
          }
        } else {
          // No stores yet
          setActiveStoreId(saved ?? "");
        }
      } catch {
        setMe(null);
      }
    })();
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  const activeStoreLabel = useMemo(() => {
    if (!me?.stores?.length) return "";
    if (activeStoreId === "all") return "All Stores";
    const s = me.stores.find((x) => x.id === activeStoreId);
    return s?.name ?? "";
  }, [me?.stores, activeStoreId]);

  // Hide on login-ish routes
  if (pathname.startsWith("/login") || pathname.startsWith("/change-password")) return null;
  // Hide when not logged in
  if (me === null) return null;

  return (
    <header className="md:hidden sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
      {/* Row 1: Brand + Logout */}
      <div className="px-3 pt-3 flex items-center justify-between gap-3">
        <Link href="/dashboard" className="font-semibold text-sm">
          Aksha
        </Link>

        <button
          className="text-xs border rounded-lg px-2 py-1 active:scale-[0.98]"
          onClick={logout}
        >
          Logout
        </button>
      </div>

      {/* Row 2: Store Switcher (full width to avoid overlap) */}
      <div className="px-3 pt-2 pb-3">
        {me?.stores?.length ? (
          <div className="flex items-center gap-2">
            <select
              className="w-full border rounded-lg px-2 py-2 text-xs"
              value={activeStoreId ?? ""}
              onChange={(e) => {
                const v = e.target.value;

                // Only SHOP_OWNER can pick "all"
                if (v === "all" && !isOwner) return;

                localStorage.setItem("activeStoreId", v);
                setActiveStoreId(v);
                router.refresh();
              }}
            >
              {isOwner && <option value="all">All Stores</option>}

              {me.stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {isOwner && activeStoreId === "all" ? (
              <span className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                Consolidated
              </span>
            ) : null}
          </div>
        ) : (
          <div className="text-xs text-gray-500">Loading…</div>
        )}

        {/* Row 3: Tenant + Role + Store label (single line, truncates safely) */}
        {me?.tenant?.name ? (
          <div className="mt-2 text-[11px] text-gray-500 flex items-center justify-between gap-2">
            <span className="truncate">
              {me.tenant.name} • {me.role}
            </span>

            {activeStoreLabel ? (
              <span className="truncate max-w-[45%]">Store: {activeStoreLabel}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
