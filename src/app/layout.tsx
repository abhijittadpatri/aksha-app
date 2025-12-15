import "./globals.css";
import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import AppShell from "@/components/AppShell";



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
