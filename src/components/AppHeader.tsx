"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AppHeader() {
  const router = useRouter();
  const [me, setMe] = useState<any>(undefined); // undefined = loading, null = not logged in

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });

        // Read as text first so we never crash on invalid JSON
        const text = await res.text();
        let data: any = { user: null };

        try {
          data = text ? JSON.parse(text) : { user: null };
        } catch {
          // If server returned HTML/error page, ignore
          data = { user: null };
        }

        setMe(data.user ?? null);

        if (data.user?.mustChangePassword) {
          router.push("/change-password");
          return;
        }

        // ensure active store selected
        if (data.user?.stores?.length) {
          const saved = localStorage.getItem("activeStoreId");
          if (!saved) localStorage.setItem("activeStoreId", data.user.stores[0].id);
        }
      } catch (e) {
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

  // Always render something (never disappear)
  return (
    <header className="border-b p-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link className="font-bold" href="/dashboard">
          Aksha
        </Link>
        <nav className="text-sm flex gap-3">
          <Link className="underline" href="/patients">
            Patients
          </Link>

          {(me?.role === "ADMIN" || me?.role === "OWNER") && (
            <Link className="underline" href="/users">
              Users
            </Link>
          )}
        </nav>

      </div>

      {me === undefined ? (
        <span className="text-sm text-gray-500">Loading…</span>
      ) : me ? (
        <div className="flex items-center gap-3">
          <span className="text-xs px-2 py-1 rounded bg-gray-100">
            {me.tenant?.name} • {me.role}
          </span>

          <select
            className="border rounded px-2 py-1 text-sm"
            value={activeStoreId ?? ""}
            onChange={(e) => {
              localStorage.setItem("activeStoreId", e.target.value);
              router.refresh();
            }}
          >
            {me.stores?.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.city ? `(${s.city})` : ""}
              </option>
            ))}
          </select>

          <button className="text-sm underline" onClick={logout}>
            Logout
          </button>
        </div>
      ) : (
        <Link className="underline text-sm" href="/login">
          Login
        </Link>
      )}
    </header>
  );
}
