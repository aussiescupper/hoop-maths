/* Service worker — offline support with an update-friendly strategy.
   App shell (HTML/JS/CSS/manifest): network-first, falling back to cache when
   offline — so a plain deploy reaches installed iPads on their next online
   launch, no cache-name bump required. Icons/static: cache-first.
   Uses RELATIVE paths so it works from any GitHub Pages subfolder. */
const CACHE = "hoop-maths-v8";

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
  "audio/coach-0.m4a",
  "audio/coach-1.m4a",
  "audio/coach-2.m4a",
  "audio/coach-3.m4a",
  "audio/coach-4.m4a",
  "audio/coach-5.m4a",
  "audio/coach-6.m4a",
  "audio/coach2-0.m4a",
  "audio/coach2-1.m4a",
  "audio/coach2-2.m4a",
  "audio/coach2-3.m4a",
  "audio/coach2-4.m4a",
  "audio/coach2-5.m4a",
  "audio/coach2-6.m4a",
  "img/player-1s.png",
  "img/player-10s.png",
  "img/player-100s.png",
].map((p) => new URL(p, SCOPE).toString());

self.addEventListener("install", (event) => {
  // No .catch here: if precaching fails, the install fails atomically and the
  // previous worker + its intact cache stay in charge.
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
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

function putInCache(req, res) {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // let cross-origin requests pass through

  const isShell =
    req.mode === "navigate" ||
    url.pathname.endsWith("/") ||
    /(?:^|\/)(index\.html|app\.js|styles\.css|manifest\.webmanifest)$/.test(url.pathname);

  if (isShell) {
    // network-first: fresh code whenever online, cached shell when offline
    event.respondWith(
      fetch(req)
        .then((res) => putInCache(req, res))
        .catch(() =>
          caches.match(req).then((cached) => {
            if (cached) return cached;
            if (req.mode === "navigate") return caches.match(new URL("index.html", SCOPE).toString());
            return new Response("", { status: 504, statusText: "offline" });
          })
        )
    );
  } else {
    // cache-first for icons and other static bits
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req)
          .then((res) => putInCache(req, res))
          .catch(() => new Response("", { status: 504, statusText: "offline" }))
      )
    );
  }
});
