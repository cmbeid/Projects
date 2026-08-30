/**
 * Registers `public/sw.js` (offline.md's "true offline-first") so a
 * *returning* visit — the app shell already precached, plus whatever
 * content a prior visit actually fetched — works with no network at all.
 * A first visit still needs the network; nothing here changes that.
 *
 * Best-effort and silent on failure: an older browser with no service
 * worker support, or a registration that fails for some other reason,
 * leaves the app exactly as capable as it was without this — every feature
 * up to this point works with no service worker whatsoever.
 */
export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
  } catch {
    /* offline support just doesn't activate this visit — nothing else depends on it */
  }
}
