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

  // Local state for activeStoreId so UI updates immediately on change
  const [activeStoreId, setActiveStoreId] = useState<string>("");

  const isOwner = me?.role === "SHOP_OWNER";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        const user: Me | null = data.user ?? null;
        setMe(user);

        if (typeof window !== "undefined") {
          const saved = localStorage.getItem("activeStoreId");

          if (user?.stores?.length) {
            // ✅ Default selection
            if (!saved) {
              const def = user.role === "SHOP_OWNER" ? "all" : user.stores[0].id;
              localStorage.setItem("activeStoreId", def);
              setActiveStoreId(def);
            } else {
              // ✅ Non-owners cannot stay on "all"
              if (saved === "all" && user.role !== "SHOP_OWNER") {
                const def = user.stores[0].id;
                localStorage.setItem("activeStoreId", def);
                setActiveStoreId(def);
              } else {
                setActiveStoreId(saved);
              }
            }
          } else {
            // no stores yet
            setActiveStoreId(saved ?? "");
          }
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

  // no topbar on login-ish routes
  if (pathname.startsWith("/login") || pathname.startsWith("/change-password")) return null;
  if (me === null) return null;

  return (
    <header className="md:hidden sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
      <div className="p-3 flex items-center justify-between gap-2">
        <Link href="/dashboard" className="font-semibold">
          Aksha
        </Link>

        <div className="flex items-center gap-2">
          {me?.stores?.length ? (
            <>
              <select
                className="border rounded-lg px-2 py-1 text-xs max-w-[160px]"
                value={activeStoreId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;

                  // ✅ Only SHOP_OWNER can pick "all"
                  if (v === "all" && !isOwner) return;

                  localStorage.setItem("activeStoreId", v);
                  setActiveStoreId(v);
                  router.refresh();
                }}
              >
                {/* ✅ Owner-only consolidated option */}
                {isOwner && <option value="all">All Stores (Consolidated)</option>}

                {me.stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* ✅ Small indicator pill when consolidated */}
              {isOwner && activeStoreId === "all" ? (
                <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                  All Stores
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-xs text-gray-500">Loading…</span>
          )}

          <button className="text-xs underline" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {me?.tenant?.name && (
        <div className="px-3 pb-2 text-[11px] text-gray-500 flex items-center justify-between">
          <span>
            {me.tenant.name} • {me.role}
          </span>
          {activeStoreLabel ? <span className="truncate">Store: {activeStoreLabel}</span> : null}
        </div>
      )}
    </header>
  );
}
