// src/components/shell/AppShell.tsx
"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // prevent hydration weirdness
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop sidebar */}
      <Sidebar />

      <div className="flex-1 flex flex-col">
        {/* Mobile top bar */}
        <TopBar />

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</main>
        {/* Mobile bottom nav */}
        <BottomNav />
      </div>
    </div>
  );
}
