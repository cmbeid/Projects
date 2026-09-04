// Minimal app-shell service worker. Goal: a reload after a flaky
// connection (or an offline reload) still boots to the main menu — not
// offline gameplay, not a full precache manifest (the /src tree is ~80
// files and changes independently of this file).
//
// Strategy: network-first for same-origin static assets (JS modules, CSS,
// manifest, icons, index.html), falling back to cache only when the
// network request actually fails. This site has no build-driven cache
// version to bump on deploy, so cache-first would keep serving stale code
// indefinitely after every update — network-first costs nothing when
// online (the normal case) and only matters when it's needed, which is
// exactly the resilience this exists for.
//
// The precache list holds only files whose names are stable. The CSS and JS
// bundles are content-hashed by the build, so they cannot be named ahead of
// time; they enter the cache on first visit through the fetch handler below,
// which is enough for the reload-after-a-flaky-connection case this exists for.

const CACHE_NAME = "opensky-shell-v1";

// Everything below is relative to the worker's own scope rather than the origin
// root. On GitHub Pages the site lives at /Projects/simtowerweb/, so an
// origin-rooted "/index.html" would cache the wrong document — and on a shared
// Pages site it would reach into a sibling project's files.
const SCOPE = new URL("./", self.location).pathname;
const scoped = (p) => SCOPE + p;

const SHELL_URLS = [
  SCOPE,
  scoped("index.html"),
  scoped("manifest.webmanifest"),
  scoped("icons/icon-192.png"),
  scoped("icons/icon-512.png"),
  scoped("icons/icon-180.png"),
  scoped("icons/icon-maskable-512.png"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function isCacheable(url) {
  if (url.origin !== self.location.origin) return false;
  if (!url.pathname.startsWith(SCOPE)) return false;
  return (
    url.pathname === SCOPE ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.startsWith(scoped("icons/"))
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (!isCacheable(url)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      } catch (_) {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        throw _;
      }
    })
  );
});
