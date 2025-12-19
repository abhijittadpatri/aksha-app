import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aksha",
    short_name: "Aksha",
    description: "Clinic chain operations: patients, orders, invoices, WhatsApp receipts",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F6F8FC",
    theme_color: "#1456D8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
