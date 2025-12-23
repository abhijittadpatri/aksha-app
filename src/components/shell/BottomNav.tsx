"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type Me = {
  role: "ADMIN" | "SHOP_OWNER" | "DOCTOR" | "BILLING";
};

type TabItem = { href: string; label: string; roles?: Me["role"][] };

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function Tab({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick as any}
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
  const [moreOpen, setMoreOpen] = useState(false);

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

  // Close "More" menu on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Hide on auth routes
  if (pathname.startsWith("/login") || pathname.startsWith("/change-password")) return null;
  if (me === null) return null;

  const tabs = useMemo(() => {
    const role = me?.role;

    const items: TabItem[] = [
      { href: "/dashboard", label: "Home" },
      { href: "/patients", label: "Patients", roles: ["ADMIN", "SHOP_OWNER", "DOCTOR", "BILLING"] },
      { href: "/invoices", label: "Invoices", roles: ["ADMIN", "SHOP_OWNER", "BILLING"] },
      { href: "/insights", label: "Insights", roles: ["ADMIN", "SHOP_OWNER"] },
      { href: "/users", label: "Users", roles: ["ADMIN", "SHOP_OWNER"] },
      { href: "/stores", label: "Stores", roles: ["ADMIN", "SHOP_OWNER"] },
    ];

    return items.filter((it) => !it.roles || (role && it.roles.includes(role)));
  }, [me?.role]);

  // Show at most 3 items on the bar + "More" as 4th when overflow exists.
  const { barTabs, overflowTabs, needsMore } = useMemo(() => {
    const byHref = new Map(tabs.map((t) => [t.href, t]));
    const order = ["/dashboard", "/patients", "/invoices", "/insights"];

    const main: TabItem[] = [];
    for (const href of order) {
      const t = byHref.get(href);
      if (t) main.push(t);
    }

    const remaining = tabs.filter((t) => !main.some((m) => m.href === t.href));
    const _needsMore = remaining.length > 0 || main.length > 4;

    const _barTabs = (() => {
      if (!_needsMore) return main.slice(0, 4);

      // keep 3 on bar; 4th is More
      const firstThree = main.slice(0, 3);
      let i = 0;
      while (firstThree.length < 3 && i < remaining.length) {
        firstThree.push(remaining[i++]);
      }
      return firstThree;
    })();

    const used = new Set(_barTabs.map((t) => t.href));
    const _overflowTabs = _needsMore ? tabs.filter((t) => !used.has(t.href)) : [];

    return { barTabs: _barTabs, overflowTabs: _overflowTabs, needsMore: _needsMore };
  }, [tabs]);

  const moreIsActive = overflowTabs.some((t) => isActivePath(pathname, t.href));

  return (
    <>
      {/* Overlay (tap outside to close) */}
      {needsMore && moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/20"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More Sheet (fixed overlay above the bottom bar) */}
      {needsMore && moreOpen && (
        <div className="md:hidden fixed left-0 right-0 bottom-14 z-50">
          <div className="mx-3 mb-2 rounded-2xl border bg-white shadow-lg overflow-hidden">
            <div className="p-2 grid grid-cols-2 gap-2">
              {overflowTabs.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className={[
                    "border rounded-xl px-3 py-2 text-sm",
                    isActivePath(pathname, t.href)
                      ? "bg-gray-100 font-medium"
                      : "bg-white hover:bg-gray-50",
                  ].join(" ")}
                  onClick={() => setMoreOpen(false)}
                >
                  <div className="truncate">{t.label}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-white/90 backdrop-blur">
        <div className="grid grid-cols-4">
          {barTabs.map((t) => (
            <Tab key={t.href} href={t.href} label={t.label} active={isActivePath(pathname, t.href)} />
          ))}

          {needsMore ? (
            <button
              type="button"
              className={[
                "flex flex-col items-center justify-center px-1 py-2",
                "text-[11px] leading-tight select-none",
                moreIsActive || moreOpen ? "font-semibold text-black" : "text-gray-600",
              ].join(" ")}
              onClick={() => setMoreOpen((v) => !v)}
            >
              <span className="max-w-full truncate">More</span>
              <span
                className={[
                  "mt-1 h-1 w-6 rounded-full transition-opacity",
                  moreIsActive || moreOpen ? "bg-black opacity-100" : "opacity-0",
                ].join(" ")}
              />
            </button>
          ) : (
            <div />
          )}
        </div>
      </nav>

      {/* Spacer so content doesn't hide behind fixed bottom nav */}
      <div className="md:hidden h-14" />
    </>
  );
}
