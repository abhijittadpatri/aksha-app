// src/components/shell/TopBar.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut } from "lucide-react";

type Me = {
  id: string;
  email: string;
  name?: string | null;
  role: "ADMIN" | "SHOP_OWNER" | "DOCTOR" | "BILLING";
  tenant?: { name?: string | null } | null;
  stores?: { id: string; name: string; city?: string | null; isActive?: boolean }[];
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function pageTitleFromPath(pathname: string) {
  if (pathname === "/dashboard" || pathname === "/") return "Dashboard";
  if (pathname.startsWith("/patients")) return "Patients";
  if (pathname.startsWith("/invoices")) return "Invoices";
  if (pathname.startsWith("/insights")) return "Insights";
  if (pathname.startsWith("/users")) return "Users";
  if (pathname.startsWith("/stores")) return "Stores";
  return "Aksha";
}

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();

  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [activeStoreId, setActiveStoreId] = useState<string>("");

  const isOwner = me?.role === "SHOP_OWNER";

  // Hide on auth routes
  if (pathname.startsWith("/login") || pathname.startsWith("/change-password")) return null;

  // Sync store id from other tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "activeStoreId") setActiveStoreId(String(e.newValue ?? ""));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Load user + normalize active store selection
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });

        // logged out / forbidden
        if (res.status === 401 || res.status === 403) {
          if (typeof window !== "undefined") window.location.href = "/login";
          return;
        }

        const data = await res.json().catch(() => ({}));
        const user: Me | null = data.user ?? null;
        setMe(user);

        if (typeof window === "undefined") return;

        const saved = localStorage.getItem("activeStoreId");
        const allStores = user?.stores ?? [];
        const activeStores = allStores.filter((s) => s?.isActive !== false);

        if (activeStores.length) {
          if (!saved) {
            const def = user?.role === "SHOP_OWNER" ? "all" : activeStores[0].id;
            localStorage.setItem("activeStoreId", def);
            setActiveStoreId(def);
            return;
          }

          // Non-owners cannot stay on "all"
          if (saved === "all" && user?.role !== "SHOP_OWNER") {
            const def = activeStores[0].id;
            localStorage.setItem("activeStoreId", def);
            setActiveStoreId(def);
            return;
          }

          // If saved store is no longer active, fall back
          if (saved !== "all") {
            const stillValid = activeStores.some((s) => s.id === saved);
            if (!stillValid) {
              const def = user?.role === "SHOP_OWNER" ? "all" : activeStores[0].id;
              localStorage.setItem("activeStoreId", def);
              setActiveStoreId(def);
              return;
            }
          }

          setActiveStoreId(saved);
          return;
        }

        setActiveStoreId(saved ?? "");
      } catch {
        setMe(null);
      }
    })();
  }, []);

  const activeStores = useMemo(() => {
    return (me?.stores ?? []).filter((s) => s?.isActive !== false);
  }, [me?.stores]);

  const activeStoreLabel = useMemo(() => {
    if (!activeStores.length) return "";
    if (activeStoreId === "all") return "All Stores";
    const s = activeStores.find((x) => x.id === activeStoreId);
    if (!s) return "";
    return s.city ? `${s.name} • ${s.city}` : s.name;
  }, [activeStores, activeStoreId]);

  const tenantName = me?.tenant?.name ?? "";
  const title = useMemo(() => pageTitleFromPath(pathname), [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  // Hide when not logged in
  if (me === null) return null;

  return (
    <header
      className={cls(
        "md:hidden sticky top-0 z-40 border-b",
        "bg-white/85 backdrop-blur"
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="px-3 pt-3 pb-3">
        {/* Row 1: Title + Role + Logout */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-base font-semibold tracking-tight truncate">{title}</div>
              {me?.role ? <span className="badge">{me.role}</span> : null}
            </div>

            <div className="mt-1 text-[11px] subtle truncate">
              <Link href="/dashboard" className="font-medium">
                Aksha
              </Link>

              {tenantName ? <span className="muted"> • </span> : null}
              {tenantName ? <span className="muted">{tenantName}</span> : null}

              {activeStoreLabel ? <span className="muted"> • </span> : null}
              {activeStoreLabel ? <span className="muted">{activeStoreLabel}</span> : null}
            </div>
          </div>

          {/* Icon-only on mobile keeps it SaaS-clean */}
          <button
            className="btn btn-ghost btn-icon shrink-0"
            onClick={logout}
            title="Logout"
            type="button"
            aria-label="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Row 2: Store Switcher */}
        <div className="mt-3">
          {me === undefined ? (
            <div className="h-10 w-full rounded-xl bg-gray-100 animate-pulse" />
          ) : activeStores.length ? (
            <div className="flex items-center gap-2">
              <div className="relative w-full">
                <select
                  className="input appearance-none pr-10"
                  value={activeStoreId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "all" && !isOwner) return;

                    localStorage.setItem("activeStoreId", v);
                    setActiveStoreId(v);
                    router.refresh();
                  }}
                >
                  {isOwner && <option value="all">All Stores (Consolidated)</option>}
                  {activeStores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.city ? ` (${s.city})` : ""}
                    </option>
                  ))}
                </select>

                <ChevronsUpDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "rgb(var(--fg-muted))" }}
                />
              </div>

              {isOwner && activeStoreId === "all" ? <span className="badge">Consolidated</span> : null}
            </div>
          ) : (
            <div className="text-xs subtle">No active stores…</div>
          )}
        </div>
      </div>
    </header>
  );
}
