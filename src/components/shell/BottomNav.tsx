"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type Me = {
  role: "ADMIN" | "SHOP_OWNER" | "DOCTOR" | "BILLING";
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
      className={[
        "flex flex-col items-center justify-center px-1 py-2",
        "text-[11px] leading-tight select-none",
        active ? "font-semibold text-black" : "text-gray-600",
      ].join(" ")}
    >
      <span className="max-w-full truncate">{label}</span>
      <span
        className={[
          "mt-1 h-1 w-6 rounded-full transition-opacity",
          active ? "bg-black opacity-100" : "opacity-0",
        ].join(" ")}
      />
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

    const items: { href: string; label: string; roles?: Me["role"][] }[] = [
      { href: "/dashboard", label: "Home" },
      { href: "/insights", label: "Insights", roles: ["ADMIN", "SHOP_OWNER"] },
      { href: "/patients", label: "Patients", roles: ["ADMIN", "SHOP_OWNER", "DOCTOR", "BILLING"] },
      { href: "/invoices", label: "Invoices", roles: ["ADMIN", "SHOP_OWNER", "BILLING"] },
      { href: "/users", label: "Users", roles: ["ADMIN", "SHOP_OWNER"] },
    ];

    return items.filter((it) => !it.roles || (role && it.roles.includes(role)));
  }, [me?.role]);

  // Hide on login-ish routes
  if (pathname.startsWith("/login") || pathname.startsWith("/change-password")) return null;
  // Hide when not logged in
  if (me === null) return null;

  // Use 5 columns when we actually have 5 tabs; otherwise fall back to 4.
  const colClass =
    tabs.length >= 5 ? "grid-cols-5" : "grid-cols-4";

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-white/90 backdrop-blur">
      <div className={`grid ${colClass}`}>
        {tabs.map((t) => (
          <Tab
            key={t.href}
            href={t.href}
            label={t.label}
            active={pathname === t.href || pathname.startsWith(t.href + "/")}
          />
        ))}
      </div>
    </nav>
  );
}
