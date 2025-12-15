import "./globals.css";
import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import AppShell from "@/components/AppShell";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Aksha",
  description: "Ophthalmology Clinic & Optical Store Operations",
  manifest: "/manifest.webmanifest",
  themeColor: "#111111",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <AppHeader />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
