// src/app/(app)/layout.tsx
import AppShell from "@/components/shell/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {/* Helps prevent odd scroll chaining + keeps app pages consistent */}
      <div className="min-h-[100dvh]">{children}</div>
    </AppShell>
  );
}
