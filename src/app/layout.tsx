import type { Metadata } from "next";
import "./globals.css";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "Aksha",
  applicationName: "Aksha",
  manifest: "/manifest.webmanifest",
  themeColor: "#1456D8",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Aksha",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}

