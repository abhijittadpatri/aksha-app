"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Me = {
  id: string;
  name?: string | null;
  email: string;
  role: "ADMIN" | "SHOP_OWNER" | "DOCTOR" | "BILLING";
  tenant?: { name?: string | null } | null;
  stores?: { id: string; name: string; city?: string | null }[];
};

function NavItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
        active ? "bg-gray-100 font-medium" : "hover:bg-gray-50"
      }`}
    >
      <span>{label}</span>
      {active && <span className="text-xs text-gray-500">●</span>}
    </Link>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        setMe(data.user ?? null);

        // ensure active store selected
        if (data.user?.stores?.length) {
          const saved = localStorage.getItem("activeStoreId");
          if (!saved) localStorage.setItem("activeStoreId", data.user.stores[0].id);
        }
      } catch {
        setMe(null);
      }
    })();
  }, []);

  const nav = useMemo(() => {
    const role = me?.role;

    // NOTE: schema uses SHOP_OWNER (not OWNER)
    const items: { href: string; label: string; roles?: Me["role"][] }[] = [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/patients", label: "Patients", roles: ["ADMIN", "SHOP_OWNER", "DOCTOR", "BILLING"] },
      { href: "/invoices", label: "Invoices", roles: ["ADMIN", "SHOP_OWNER", "BILLING"] },
      { href: "/users", label: "Users", roles: ["ADMIN", "SHOP_OWNER"] },
    ];

    return items.filter((it) => !it.roles || (role ? it.roles.includes(role) : false));
  }, [me?.role]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  const activeStoreId =
    typeof window !== "undefined" ? localStorage.getItem("activeStoreId") : "";

  // Hide sidebar while not logged in
  if (me === null) return null;

  return (
    <aside className="hidden md:flex w-72 border-r bg-white p-4 flex-col gap-4">
      {/* Brand */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold leading-tight">Aksha</div>
          <div className="text-xs text-gray-500">{me?.tenant?.name ?? "Clinic Chain"}</div>
        </div>

        {me?.role && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            {me.role}
          </span>
        )}
      </div>

      {/* Store Switcher */}
      {me?.stores?.length ? (
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Active Store</div>
          <select
            className="w-full border rounded-xl px-3 py-2 text-sm"
            value={activeStoreId ?? ""}
            onChange={(e) => {
              localStorage.setItem("activeStoreId", e.target.value);
              router.refresh();
            }}
          >
            {me.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.city ? `(${s.city})` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="text-xs text-gray-500">Loading stores…</div>
      )}

      {/* Nav */}
      <div className="flex-1 space-y-1">
        <div className="text-xs text-gray-500 px-1">Menu</div>
        <div className="space-y-1">
          {nav.map((it) => (
            <NavItem
              key={it.href}
              href={it.href}
              label={it.label}
              active={pathname === it.href || pathname.startsWith(it.href + "/")}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      {me ? (
        <div className="border-t pt-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{me.name || me.email}</div>
            <div className="text-xs text-gray-500 truncate">{me.email}</div>
          </div>

          <button className="text-sm underline" onClick={logout}>
            Logout
          </button>
        </div>
      ) : (
        <div className="text-sm text-gray-500">Loading…</div>
      )}
    </aside>
  );
}
