// src/components/shell/AppShell.tsx
"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

/**
 * AppShell (SaaS polish)
 * Goals:
 * - Use design tokens from global.css (bg/panel/border) instead of hardcoded gray-50/white
 * - Make the main content feel like a “workspace”: padded page + centered container
 * - Keep mobile safe-area spacing consistent
 * - Keep skeleton aligned with the real shell
 */

function ShellSkeleton() {
  return (
    <div className="min-h-[100dvh] flex overflow-hidden">
      {/* Desktop sidebar placeholder */}
      <div className="hidden md:flex w-72 border-r bg-white">
        <div className="p-4 w-full space-y-3">
          <div className="h-8 w-32 rounded-xl bg-gray-100 animate-pulse" />
          <div className="h-10 w-full rounded-xl bg-gray-100 animate-pulse" />
          <div className="h-10 w-full rounded-xl bg-gray-100 animate-pulse" />
          <div className="h-10 w-full rounded-xl bg-gray-100 animate-pulse" />
          <div className="h-10 w-full rounded-xl bg-gray-100 animate-pulse" />
        </div>
      </div>

      {/* Content placeholder */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b bg-white" />
        <div className="flex-1 p-4 md:p-6">
          <div className="page space-y-3">
            <div className="h-7 w-56 rounded-xl bg-gray-100 animate-pulse" />
            <div className="h-24 w-full rounded-2xl bg-gray-100 animate-pulse" />
            <div className="h-24 w-full rounded-2xl bg-gray-100 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <ShellSkeleton />;

  return (
    <div
      className="min-h-[100dvh] flex overflow-hidden"
      style={{
        background: "rgb(var(--bg))",
        color: "rgb(var(--fg))",
      }}
    >
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile TopBar is already sticky inside itself,
            but we keep a consistent “app chrome” wrapper */}
        <div
          className="sticky top-0 z-40 border-b"
          style={{
            background: "rgba(var(--panel), 0.85)",
            backdropFilter: "blur(10px)",
            borderColor: "rgb(var(--border))",
          }}
        >
          <TopBar />
        </div>

        {/* Main scrolling content area */}
        <main
          className={[
            "flex-1 min-w-0 overflow-y-auto overscroll-contain",
            "p-4 md:p-6",
            // space for bottom nav + safe area on mobile
            "pb-[calc(72px+env(safe-area-inset-bottom)+16px)] md:pb-6",
          ].join(" ")}
        >
          {/* Consistent SaaS page container */}
          <div className="page w-full">{children}</div>
        </main>

        {/* Mobile bottom nav */}
        <div className="md:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}
