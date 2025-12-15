self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Minimal fetch handler to satisfy PWA installability on desktop.
// We are NOT caching API responses yet (safer for Week 0).
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
  // Default: just pass-through
});
