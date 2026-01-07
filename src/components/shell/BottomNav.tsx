"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Receipt,
  BarChart3,
  Store,
  Settings,
  ChevronDown,
  X,
} from "lucide-react";

type Me = {
  role: "ADMIN" | "SHOP_OWNER" | "DOCTOR" | "BILLING";
};

type TabItem = {
  href: string;
  label: string;
  roles?: Me["role"][];
  icon: React.ReactNode;
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Dark SaaS mobile bottom nav:
 * - Uses tokens (no white/gray hardcoding)
 * - Brand-accented active state
 * - More sheet uses modal-backdrop + modal styles from global.css
 */
function Tab({
  href,
  label,
  icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick as any}
      aria-current={active ? "page" : undefined}
      className={cls(
        "flex flex-col items-center justify-center gap-1 py-2 select-none",
        "text-[11px] leading-tight"
      )}
      style={{
        color: active ? "rgb(var(--fg))" : "rgb(var(--fg-muted))",
      }}
    >
      <div
        className="h-9 w-14 rounded-2xl flex items-center justify-center transition border"
        style={{
          background: active ? "rgba(var(--brand),0.10)" : "transparent",
          borderColor: active ? "rgba(var(--brand),0.25)" : "transparent",
        }}
      >
        <span className={cls("transition", active ? "opacity-100" : "opacity-80")}>
          {icon}
        </span>
      </div>

      <div className={cls("max-w-full truncate", active ? "font-semibold" : "font-medium")}>
        {label}
      </div>
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

  // Close More sheet on route change
  useEffect(() => setMoreOpen(false), [pathname]);

  // Hide on auth routes
  if (pathname.startsWith("/login") || pathname.startsWith("/change-password")) return null;
  if (me === null) return null;

  const tabs = useMemo(() => {
    const role = me?.role;

    const items: TabItem[] = [
      {
        href: "/dashboard",
        label: "Home",
        icon: <Home size={18} />,
        roles: ["ADMIN", "SHOP_OWNER", "DOCTOR", "BILLING"],
      },
      {
        href: "/patients",
        label: "Patients",
        icon: <Users size={18} />,
        roles: ["ADMIN", "SHOP_OWNER", "DOCTOR", "BILLING"],
      },
      {
        href: "/invoices",
        label: "Invoices",
        icon: <Receipt size={18} />,
        roles: ["ADMIN", "SHOP_OWNER", "BILLING"],
      },
      {
        href: "/insights",
        label: "Insights",
        icon: <BarChart3 size={18} />,
        roles: ["ADMIN", "SHOP_OWNER"],
      },
      {
        href: "/stores",
        label: "Stores",
        icon: <Store size={18} />,
        roles: ["ADMIN", "SHOP_OWNER"],
      },
      {
        href: "/users",
        label: "Users",
        icon: <Settings size={18} />,
        roles: ["ADMIN", "SHOP_OWNER"],
      },
    ];

    return items.filter((it) => !it.roles || (role && it.roles.includes(role)));
  }, [me?.role]);

  // Prefer showing these on bar (if available)
  const { barTabs, overflowTabs, needsMore } = useMemo(() => {
    const byHref = new Map(tabs.map((t) => [t.href, t]));
    const preferred = ["/dashboard", "/patients", "/invoices", "/insights"];

    const main: TabItem[] = [];
    for (const href of preferred) {
      const t = byHref.get(href);
      if (t) main.push(t);
    }

    const remaining = tabs.filter((t) => !main.some((m) => m.href === t.href));
    const _needsMore = remaining.length > 0 || main.length > 4;

    const _barTabs = (() => {
      if (!_needsMore) return main.slice(0, 4);

      // keep 3 primary on bar; 4th is More
      const firstThree = main.slice(0, 3);
      let i = 0;
      while (firstThree.length < 3 && i < remaining.length) firstThree.push(remaining[i++]);
      return firstThree;
    })();

    const used = new Set(_barTabs.map((t) => t.href));
    const _overflowTabs = _needsMore ? tabs.filter((t) => !used.has(t.href)) : [];

    return { barTabs: _barTabs, overflowTabs: _overflowTabs, needsMore: _needsMore };
  }, [tabs]);

  const moreIsActive = overflowTabs.some((t) => isActivePath(pathname, t.href));

  return (
    <>
      {/* Backdrop (Dark SaaS) */}
      {needsMore && moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 modal-backdrop"
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* More Bottom Sheet */}
      {needsMore && moreOpen && (
        <div className="md:hidden fixed left-0 right-0 bottom-0 z-50">
          <div
            id="bottomnav-more-sheet"
            className={cls(
              "mx-3 overflow-hidden",
              "mb-[calc(72px+env(safe-area-inset-bottom))]"
            )}
          >
            <div className="modal">
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="text-sm font-semibold">More</div>

                <button
                  className="btn btn-ghost btn-icon-sm"
                  onClick={() => setMoreOpen(false)}
                  aria-label="Close"
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-3 grid grid-cols-2 gap-2">
                {overflowTabs.map((t) => {
                  const active = isActivePath(pathname, t.href);

                  return (
                    <Link
                      key={t.href}
                      href={t.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cls("btn btn-secondary justify-start gap-2 w-full")}
                      style={
                        active
                          ? {
                              background: "rgba(var(--brand),0.12)",
                              borderColor: "rgba(var(--brand),0.25)",
                            }
                          : undefined
                      }
                    >
                      <span className={cls(active ? "opacity-100" : "opacity-80")}>{t.icon}</span>
                      <span className="truncate">{t.label}</span>
                    </Link>
                  );
                })}
              </div>

              <div className="px-4 pb-3 text-[11px] subtle">
                Tip: Use this menu for admin screens.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Bar */}
      <nav
        className={cls("md:hidden fixed bottom-0 left-0 right-0 z-50")}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          background: "rgba(var(--sidebar), 0.92)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(10px)",
        }}
        aria-label="Bottom navigation"
      >
        <div className="grid grid-cols-4 px-2">
          {barTabs.map((t) => (
            <Tab
              key={t.href}
              href={t.href}
              label={t.label}
              icon={t.icon}
              active={isActivePath(pathname, t.href)}
            />
          ))}

          {needsMore ? (
            <button
              type="button"
              className={cls(
                "flex flex-col items-center justify-center gap-1 py-2 select-none transition",
                "text-[11px] leading-tight"
              )}
              style={{
                color: moreIsActive || moreOpen ? "rgb(var(--fg))" : "rgb(var(--fg-muted))",
              }}
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-controls="bottomnav-more-sheet"
            >
              <div
                className="h-9 w-14 rounded-2xl flex items-center justify-center transition border"
                style={{
                  background: moreIsActive || moreOpen ? "rgba(var(--brand),0.10)" : "transparent",
                  borderColor: moreIsActive || moreOpen ? "rgba(var(--brand),0.25)" : "transparent",
                }}
              >
                <ChevronDown
                  size={18}
                  className={cls("transition-transform", moreOpen ? "rotate-180" : "rotate-0")}
                />
              </div>

              <div
                className={cls(
                  "max-w-full truncate",
                  moreIsActive || moreOpen ? "font-semibold" : "font-medium"
                )}
              >
                More
              </div>
            </button>
          ) : (
            <div />
          )}
        </div>
      </nav>
    </>
  );
}
