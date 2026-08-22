// The Ledger — service worker.
// Strategy: network-first with cache fallback for same-app GET requests.
// Online users always get the freshest deploy; offline users still get the app
// shell (which then shows its own "reconnecting" state). Supabase API/realtime
// traffic is never intercepted.
const CACHE = 'ledger-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('.supabase.co')) return; // live data, never cached

  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      // Offline: serve the cached copy. ignoreSearch lets a trip link
      // (…?t=<id>) fall back to the cached app shell.
      const cached = await caches.match(req, { ignoreSearch: url.origin === self.location.origin });
      if (cached) return cached;
      throw err;
    }
  })());
});
