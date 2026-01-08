// src/app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: {
    default: "Aksha",
    template: "%s · Aksha",
  },
  applicationName: "Aksha",
  manifest: "public/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Aksha",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        {children}

        {/* Register Service Worker (safe, non-blocking) */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ("serviceWorker" in navigator) {
              window.addEventListener("load", async () => {
                try {
                  const reg = await navigator.serviceWorker.register("/sw.js");
                  reg.update?.();
                } catch {}
              });
            }
          `}
        </Script>

      </body>
    </html>
  );
}
