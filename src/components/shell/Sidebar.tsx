// src/components/shell/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Receipt,
  UserCog,
  Store,
  LogOut,
  ChevronsUpDown,
} from "lucide-react";

type Me = {
  id: string;
  name?: string | null;
  email: string;
  role: "ADMIN" | "SHOP_OWNER" | "DOCTOR" | "BILLING";
  tenant?: { name?: string | null } | null;
  stores?: { id: string; name: string; city?: string | null; isActive?: boolean }[];
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function NavItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cls(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
        "focus-visible:outline-none focus-visible:ring-2",
        active ? "font-semibold" : "font-medium"
      )}
      style={{
        // token-aware
        color: active ? "rgb(var(--fg))" : "rgb(var(--fg-muted))",
        background: active ? "rgba(var(--brand),0.14)" : "transparent",
        border: active ? "1px solid rgba(var(--brand),0.22)" : "1px solid transparent",
        boxShadow: active ? "0 14px 34px rgba(var(--brand),0.10)" : "none",
      }}
    >
      {/* Active rail */}
      <span
        className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full"
        style={{
          background: active ? "rgb(var(--brand))" : "transparent",
          boxShadow: active ? "0 0 0 1px rgba(var(--brand),0.25), 0 10px 24px rgba(var(--brand),0.25)" : "none",
        }}
        aria-hidden="true"
      />

      <span
        className={cls(
          "shrink-0 transition-opacity",
          active ? "opacity-100" : "opacity-80 group-hover:opacity-100"
        )}
        aria-hidden="true"
      >
        {icon}
      </span>

      <span className="truncate">{label}</span>

      {/* Hover wash (only when not active) */}
      <span
        className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition"
        style={{
          background: active ? "transparent" : "rgba(255,255,255,0.05)",
        }}
        aria-hidden="true"
      />
    </Link>
  );
}

function SidebarSkeleton() {
  return (
    <aside
      className="hidden md:block w-72"
      style={{
        background: "rgb(var(--sidebar))",
        borderRight: "1px solid rgba(var(--border),0.08)",
      }}
    >
      <div className="h-[100dvh] sticky top-0 flex flex-col">
        <div
          className="p-4"
          style={{ borderBottom: "1px solid rgba(var(--border),0.08)" }}
        >
          <div className="space-y-2">
            <div className="h-6 w-28 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
            <div className="h-4 w-44 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>
          <div className="mt-4 h-10 w-full rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
        </div>

        <div className="flex-1 p-4 space-y-2">
          <div className="h-4 w-16 rounded-xl animate-pulse mb-2" style={{ background: "rgba(255,255,255,0.07)" }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 w-full rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
          ))}
        </div>

        <div className="p-4" style={{ borderTop: "1px solid rgba(var(--border),0.08)" }}>
          <div className="h-4 w-44 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="mt-2 h-3 w-56 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
        </div>
      </div>
    </aside>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [activeStoreId, setActiveStoreId] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });

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
        const isOwner = user?.role === "SHOP_OWNER";

        if (activeStores.length) {
          if (!saved) {
            const def = isOwner ? "all" : activeStores[0].id;
            localStorage.setItem("activeStoreId", def);
            setActiveStoreId(def);
            return;
          }

          if (saved === "all" && !isOwner) {
            const def = activeStores[0].id;
            localStorage.setItem("activeStoreId", def);
            setActiveStoreId(def);
            return;
          }

          if (saved !== "all") {
            const stillValid = activeStores.some((s) => s.id === saved);
            if (!stillValid) {
              const def = isOwner ? "all" : activeStores[0].id;
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

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "activeStoreId") setActiveStoreId(String(e.newValue ?? ""));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isOwner = me?.role === "SHOP_OWNER";

  const activeStores = useMemo(() => {
    return (me?.stores ?? []).filter((s) => s?.isActive !== false);
  }, [me?.stores]);

  const nav = useMemo(() => {
    const role = me?.role;

    const items: Array<{
      href: string;
      label: string;
      icon: React.ReactNode;
      roles?: Array<Me["role"]>;
    }> = [
      { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
      { href: "/insights", label: "Insights", icon: <BarChart3 size={18} />, roles: ["ADMIN", "SHOP_OWNER"] },
      { href: "/patients", label: "Patients", icon: <Users size={18} />, roles: ["ADMIN", "SHOP_OWNER", "DOCTOR", "BILLING"] },
      { href: "/invoices", label: "Invoices", icon: <Receipt size={18} />, roles: ["ADMIN", "SHOP_OWNER", "BILLING"] },
      { href: "/users", label: "Users", icon: <UserCog size={18} />, roles: ["ADMIN", "SHOP_OWNER"] },
      { href: "/stores", label: "Stores", icon: <Store size={18} />, roles: ["ADMIN", "SHOP_OWNER"] },
    ];

    return items.filter((it) => !it.roles || (role && it.roles.includes(role)));
  }, [me?.role]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  if (me === null) return null;
  if (me === undefined) return <SidebarSkeleton />;

  const tenantName = me?.tenant?.name ?? "Clinic Chain";

  return (
    <aside
      className="hidden md:block w-72"
      style={{
        background: "rgb(var(--sidebar))",
        borderRight: "1px solid rgba(var(--border),0.08)",
      }}
    >
      <div className="h-[100dvh] sticky top-0 flex flex-col">
        {/* subtle top glow like SaaS dashboards */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 140,
            background:
              "radial-gradient(900px 180px at 20% -20%, rgba(var(--brand),0.28), transparent 55%)",
            pointerEvents: "none",
          }}
        />

        {/* Header */}
        <div className="p-4 relative" style={{ borderBottom: "1px solid rgba(var(--border),0.08)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg font-semibold leading-tight truncate" style={{ color: "rgb(var(--fg))" }}>
                Aksha
              </div>
              <div className="text-xs subtle truncate">{tenantName}</div>
            </div>

            {me?.role ? <span className="badge">{me.role}</span> : null}
          </div>

          {/* Store Switcher */}
          {activeStores.length ? (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs subtle">Active store</div>
                {isOwner && activeStoreId === "all" ? <span className="badge">Consolidated</span> : null}
              </div>

              <div className="relative">
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
                      {s.name} {s.city ? `(${s.city})` : ""}
                    </option>
                  ))}
                </select>

                <ChevronsUpDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "rgb(var(--fg-muted))" }}
                />
              </div>

              {isOwner ? (
                <div className="text-[11px] subtle leading-snug">
                  Use <span style={{ color: "rgb(var(--fg))", fontWeight: 600 }}>All Stores</span> for consolidated totals.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 text-xs subtle">No active stores…</div>
          )}
        </div>

        {/* Nav */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 relative">
          <div className="text-xs subtle px-1 mb-2">Menu</div>

          <div className="space-y-1">
            {nav.map((it) => {
              const active = pathname === it.href || pathname.startsWith(it.href + "/");
              return <NavItem key={it.href} href={it.href} label={it.label} icon={it.icon} active={active} />;
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 relative" style={{ borderTop: "1px solid rgba(var(--border),0.08)" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: "rgb(var(--fg))" }}>
                {me.name || me.email}
              </div>
              <div className="text-xs subtle truncate">{me.email}</div>
            </div>

            <button className="btn btn-ghost shrink-0" onClick={logout} title="Logout" type="button">
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>

          <div className="mt-3 text-[11px] subtle">v0.1 • SaaS shell polish</div>
        </div>
      </div>
    </aside>
  );
}
