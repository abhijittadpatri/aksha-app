/* public/sw.js */
const CACHE_NAME = "aksha-static-v2";

// Only cache truly-static assets.
// Avoid caching app routes like /dashboard, /login (HTML) to prevent stale auth/UI.
const CORE_ASSETS = [
  "/",
  "/manifest.json",

  // icons (add any that exist)
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png"
];

// Install: pre-cache a tiny shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Fetch:
// - Never cache API
// - Network-first for navigations (HTML pages) to avoid stale pages/auth state
// - Cache-first for static assets (same-origin)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET
  if (req.method !== "GET") return;

  // Never cache API calls
  if (url.pathname.startsWith("/api/")) return;

  // For document navigations, prefer network (fresh auth/redirects), fallback to cache.
  // This avoids "stuck on old dashboard/login" issues.
  const isNavigation =
    req.mode === "navigate" ||
    (req.destination === "document" && req.headers.get("accept")?.includes("text/html"));

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => res)
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Static assets: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;

        return fetch(req)
          .then((res) => {
            // Cache only successful same-origin basic responses
            if (res && res.status === 200 && res.type === "basic") {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
      })
    );
  }
});
