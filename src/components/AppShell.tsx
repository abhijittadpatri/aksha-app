import Link from "next/link";
import { LayoutDashboard, Users, Receipt } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/invoices", label: "Invoices", icon: Receipt },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl">
        <div className="flex">
          {/* Sidebar (desktop) */}
          <aside className="hidden md:flex md:w-64 md:flex-col md:gap-2 md:border-r md:bg-white md:px-4 md:py-4">
            <div className="px-2 text-lg font-semibold">Aksha</div>
            <nav className="mt-2 flex flex-col gap-1">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main */}
          <main className="flex-1 px-4 py-4 md:px-6">
            <div className="rounded-2xl bg-white p-4 shadow-sm md:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Bottom nav (mobile) */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-white md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-around py-2">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 px-3 py-1 text-xs text-gray-700"
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Spacer for mobile bottom nav */}
      <div className="h-14 md:hidden" />
    </div>
  );
}
