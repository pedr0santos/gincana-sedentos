const CACHE_NAME = "gincana-sedentos-shell-v2";
const CORE_ASSETS = ["/", "/manifest.webmanifest"];
const STATIC_DESTINATIONS = new Set(["script", "style", "image", "font"]);

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith("gincana-sedentos-") && key !== CACHE_NAME)
          .map(key => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => response)
        .catch(() => caches.match("/")),
    );
    return;
  }

  if (STATIC_DESTINATIONS.has(request.destination) || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.match(request).then(cached =>
        cached ||
        fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        }),
      ),
    );
  }
});
