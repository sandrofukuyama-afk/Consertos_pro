// v2: deixa de guardar paginas e dados (RSC) em cache; so arquivos estaticos.
const CACHE_NAME = "consertospro-pwa-v2";
const APP_SHELL_CACHE = [
  "/offline",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
  "/apple-icon",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_CACHE)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(async () => {
          return caches.match("/offline");
        }),
    );
    return;
  }

  // Paginas e dados do Next (RSC) sempre vem da rede: servir do cache
  // mostrava telas antigas (ex.: a tela de login depois de ja ter entrado).
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    APP_SHELL_CACHE.includes(url.pathname) ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(url.pathname);

  if (!isStaticAsset || url.searchParams.has("_rsc") || request.headers.get("RSC")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    }),
  );
});
