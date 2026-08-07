/* Service worker — caches the app shell so it loads fast and works offline.
   Uses RELATIVE paths so it works from any GitHub Pages subfolder. */
const CACHE = "hoop-maths-v1";

// Resolve the scope so cached URLs match however the app is hosted.
const SCOPE = self.registration ? self.registration.scope : "./";
const ASSETS = [
  "",                       // the directory itself (start_url "./")
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-180.png",
  "icons/icon-maskable-512.png",
].map((p) => new URL(p, SCOPE).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .catch(() => {})       // don't fail install if one asset is missing
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Cache-first for our own assets; fall back to network, then cache.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // cache same-origin successful responses for next time
          if (res && res.ok && new URL(req.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          // offline fallback: serve the app shell for navigations
          if (req.mode === "navigate") return caches.match(new URL("index.html", SCOPE).toString());
          return new Response("", { status: 504, statusText: "offline" });
        });
    })
  );
});
