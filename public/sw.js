// Service Worker para BioBitácora CR - Canopy Field Log
// Cache offline de fotos y recursos para trabajo en campo sin internet en Costa Rica

const CACHE_NAME = 'biobitacora-media-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Interceptar imágenes (/uploads/, .jpg, .png, .webp, fotos de especímenes)
  if (
    event.request.destination === 'image' ||
    url.pathname.startsWith('/uploads/') ||
    /\.(jpg|jpeg|png|webp|svg|gif|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Si está en caché, devolver de inmediato (ideal para modo offline en campo)
          // Y actualizar en segundo plano si hay red
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse);
                });
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        // Si no está en caché, intentar red y luego cachear
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(async () => {
            // Si la red falla y no estaba en CacheStorage, intentar fallback a /isthmohyla_nacientes.jpg
            const fallback = await caches.match('/isthmohyla_nacientes.jpg');
            if (fallback) return fallback;
            return new Response('', { status: 404, statusText: 'Offline image not cached' });
          });
      })
    );
  }
});
