"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Me = {
  id: string;
  email: string;
  name?: string | null;
  role: "ADMIN" | "OWNER" | "DOCTOR" | "BILLING";
  tenant?: { name?: string | null } | null;
  stores?: { id: string; name: string; city?: string | null }[];
};

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        setMe(data.user ?? null);

        if (data.user?.stores?.length) {
          const saved = localStorage.getItem("activeStoreId");
          if (!saved) localStorage.setItem("activeStoreId", data.user.stores[0].id);
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

  const activeStoreId =
    typeof window !== "undefined" ? localStorage.getItem("activeStoreId") : "";

  // no topbar on login-ish routes (extra safety)
  if (pathname.startsWith("/login") || pathname.startsWith("/change-password"))
    return null;

  // if not logged in, no topbar
  if (me === null) return null;

  return (
    <header className="md:hidden sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
      <div className="p-3 flex items-center justify-between gap-2">
        <Link href="/dashboard" className="font-semibold">
          Aksha
        </Link>

        <div className="flex items-center gap-2">
          {me?.stores?.length ? (
            <select
              className="border rounded-lg px-2 py-1 text-xs"
              value={activeStoreId ?? ""}
              onChange={(e) => {
                localStorage.setItem("activeStoreId", e.target.value);
                router.refresh();
              }}
            >
              {me.stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-gray-500">Loading…</span>
          )}

          <button className="text-xs underline" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {me?.tenant?.name && (
        <div className="px-3 pb-2 text-[11px] text-gray-500">
          {me.tenant.name} • {me.role}
        </div>
      )}
    </header>
  );
}
