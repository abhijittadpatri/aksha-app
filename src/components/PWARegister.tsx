"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Avoid registering in local dev if you want:
    // if (location.hostname === "localhost") return;

    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {
        // Silent fail (don’t block UI)
      });
  }, []);

  return null;
}
