const SHELL_CACHE = 'maporb-shell-v2';
const TILE_CACHE = 'maporb-tiles-v2';
const SHELL_FILES = ['./', './maporb.html', './manifest.json'];

// Hostnames for every map tile / overlay source MapOrb uses. Kept as a list (not a
// single domain) since the app offers 14 base map styles plus several overlays,
// each served from a different free provider.
const TILE_HOSTS = [
  'tile.openstreetmap.org',
  'basemaps.cartocdn.com',
  'server.arcgisonline.com',
  'tile.opentopomap.org',
  'tile-cyclosm.openstreetmap.fr',
  'tile.openstreetmap.fr',
  'maps.wikimedia.org',
  'tilecache.rainviewer.com',
  'tiles.openseamap.org',
  'tiles.openrailwaymap.org',
  'tiles.opensnowmap.org'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== TILE_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  let hostname = '';
  try { hostname = new URL(url).hostname; } catch (e) {}
  const isTile = TILE_HOSTS.some((h) => hostname.endsWith(h));

  if (isTile) {
    // Cache-first for map tiles/overlays so recently viewed areas work offline,
    // across whichever of the 14 base styles or overlays the person is using.
    event.respondWith(
      caches.open(TILE_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request)
            .then((res) => { cache.put(event.request, res.clone()); return res; })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  if (event.request.mode === 'navigate' || SHELL_FILES.some((f) => url.endsWith(f.replace('./', '')))) {
    // Network-first for the app shell, falling back to cache when offline.
    // Network-first (not cache-first) is deliberate here: it keeps MapOrb from
    // ever getting stuck serving a stale, previously-cached version of itself.
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
