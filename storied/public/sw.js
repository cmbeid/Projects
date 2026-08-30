/**
 * offline.md's "true offline-first": precaches the app shell (this build's
 * JS/CSS/index.html, listed in ./sw-manifest.json, generated at build time
 * by scripts/generate-sw-manifest.ts) so a *returning* visit works with no
 * network at all. Content — content/index.json and any story.json/image a
 * visit actually fetches — is cached separately and deliberately not
 * precached: baking the whole catalog in sight-unseen would defeat "no
 * rebuild to add a story" (PLAN.md §1). A first visit still needs the
 * network either way.
 *
 * Plain, unbundled JS — public/ files are copied by Vite untouched, not
 * run through it, so this can't use the app's own TypeScript/ES modules.
 *
 * Two caches, two lifetimes:
 *  - `storied-shell-<version>`, one per build. `activate` deletes every
 *    other `storied-shell-*` cache, so a redeploy can't leave a stale
 *    shell (an old JS bundle pointing at an asset that no longer exists)
 *    being served forever.
 *  - `storied-content`, unversioned and untouched by a shell update — a
 *    story already read stays readable offline across redeploys of the
 *    *app*; it only refreshes when a later online visit re-fetches it.
 */

const SHELL_CACHE_PREFIX = 'storied-shell-';
const CONTENT_CACHE = 'storied-content';
const MANIFEST_URL = './sw-manifest.json';

/** `no-store`: this file, and the manifest it reads, must never come from a stale cache — that would freeze the app on its first-ever version. */
async function fetchManifest() {
  const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
  return response.json();
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const manifest = await fetchManifest();
      const cache = await caches.open(SHELL_CACHE_PREFIX + manifest.version);
      await cache.addAll(manifest.urls);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const manifest = await fetchManifest();
      const keep = SHELL_CACHE_PREFIX + manifest.version;
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith(SHELL_CACHE_PREFIX) && name !== keep).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * The active shell cache's name — from Cache Storage itself, not a fresh
 * `fetchManifest()` call, which needs the network. `activate` guarantees at
 * most one `storied-shell-*` cache exists at a time, so this needs no
 * network at all for the ordinary case, which matters: this runs on every
 * cache-first request, including the offline ones this whole feature is
 * for. A fetch is only a fallback for the narrow race of a request arriving
 * before `install` has created the shell cache yet.
 */
async function currentShellCacheName() {
  const names = await caches.keys();
  const existing = names.find((name) => name.startsWith(SHELL_CACHE_PREFIX));
  if (existing) return existing;
  const manifest = await fetchManifest();
  return SHELL_CACHE_PREFIX + manifest.version;
}

/** The shell: already precached: this build doesn't change, so a hit is definitive. A miss (something not yet precached) still falls through to the network and gets cached for next time. */
async function cacheFirst(request) {
  const cache = await caches.open(await currentShellCacheName());
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

/** Content: prefer a fresh online copy — a redeploy of a story should show up immediately — falling back to whatever was last fetched successfully when offline. */
async function networkFirst(request) {
  const cache = await caches.open(CONTENT_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw-manifest.json')) return; // never intercept the manifest itself — see fetchManifest's no-store note

  const isContent = url.pathname.includes('/content/');
  event.respondWith(isContent ? networkFirst(request) : cacheFirst(request));
});
