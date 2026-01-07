// src/app/(app)/layout.tsx
import AppShell from "@/components/shell/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div
        className="
          min-h-[100dvh]
          pt-[calc(env(safe-area-inset-top)+64px)]
          pb-[calc(72px+env(safe-area-inset-bottom))]
          md:pt-0 md:pb-0
        "
        style={{ background: "rgb(var(--bg))", color: "rgb(var(--fg))" }}
      >
        {children}
      </div>
    </AppShell>
  );
}
