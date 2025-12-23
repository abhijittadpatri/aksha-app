"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

type MeUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role: "ADMIN" | "SHOP_OWNER" | "DOCTOR" | "BILLING";
  tenant?: { name?: string | null } | null;
  stores?: { id: string; name: string; city?: string | null }[];
} | null;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeUser | undefined>(undefined); // undefined = loading

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        setMe((data.user as MeUser) ?? null);
      } catch {
        setMe(null);
      }
    })();
  }, []);

  // While loading, still render layout shell (no nav flash)
  // Sidebar/TopBar/BottomNav already handle me===null hiding appropriately in your code.
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop sidebar */}
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <TopBar />

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 min-w-0">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <BottomNav />
      </div>
    </div>
  );
}
