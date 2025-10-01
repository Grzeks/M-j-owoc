// ====== OWOC – Service Worker ======

const CACHE_NAME = "owoc-cache-v1";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./main.js",
  "./manifest.json",
  "./icon-32.png",
  "./icon-192.png",
  "./icon-512.png",
];

// Instalacja SW – cache statycznych plików
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Aktywacja – czyszczenie starych cache
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Fetch – tylko GET, ignoruj POST (np. do backendu)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ignoruj POST – nie przechwytuj zapisów do backendu
  if (req.method !== "GET") return;

  // statyczne pliki (offline-first)
  if (STATIC_ASSETS.some((asset) => url.pathname.endsWith(asset) || url.pathname === "/")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // API Google Apps Script (network-first)
  if (url.href.includes("script.google.com/macros/s/")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // domyślnie – fallback
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

// strategia cache-first
async function cacheFirst(req) {
  const cached = await caches.match(req);
  return cached || fetch(req);
}

// strategia network-first
async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(req);
    return cached || new Response("Offline", { status: 503 });
  }
}
