"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type Me = {
  role: "ADMIN" | "OWNER" | "DOCTOR" | "BILLING";
};

function Tab({
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
      className={`flex flex-col items-center justify-center py-2 text-xs ${
        active ? "font-semibold" : "text-gray-600"
      }`}
    >
      <span>{label}</span>
      {active && <span className="mt-1 h-1 w-6 rounded-full bg-black" />}
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null | undefined>(undefined);

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

  const tabs = useMemo(() => {
    const role = me?.role;

    const items: { href: string; label: string; roles?: string[] }[] = [
      { href: "/dashboard", label: "Home" },
      { href: "/patients", label: "Patients", roles: ["ADMIN", "OWNER", "DOCTOR", "BILLING"] },
      { href: "/invoices", label: "Invoices", roles: ["ADMIN", "OWNER", "BILLING"] },
      { href: "/users", label: "Users", roles: ["ADMIN", "OWNER"] },
    ];

    return items.filter((it) => !it.roles || (role && it.roles.includes(role)));
  }, [me?.role]);

  // Hide on desktop, hide when not logged in, hide on login routes
  if (pathname.startsWith("/login") || pathname.startsWith("/change-password"))
    return null;
  if (me === null) return null;

  return (
    <nav className="md:hidden sticky bottom-0 z-40 border-t bg-white/90 backdrop-blur">
      <div className="grid grid-cols-4">
        {tabs.map((t) => (
          <Tab
            key={t.href}
            href={t.href}
            label={t.label}
            active={pathname === t.href || pathname.startsWith(t.href + "/")}
          />
        ))}
        {/* If fewer than 4 tabs, grid still ok; empty cells not needed */}
      </div>
    </nav>
  );
}
