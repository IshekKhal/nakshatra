/**
 * Service Worker for Project Scotopic (AstroWhisper).
 * Provides 100% offline rooftop PWA capabilities with Cache-First App Shell caching.
 */

const CACHE_NAME = 'scotopic-shell-v15';

const PRECACHE_RESOURCES = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './vendor/astronomy.js',
  './src/app.js',
  './src/display.js',
  './src/wake_lock.js',
  './src/sensors.js',
  './src/skyline.js',
  './src/ephemeris.js',
  './src/celestial_catalog.js',
  './src/quadrant_selector.js',
  './src/orchestrator_states.js',
  './src/radar_phase_handlers.js',
  './src/acoustic_beacon.js',
  './src/speech_engine.js',
  './src/local_gemma.js',
  './src/gemma_worker.js',
  './src/orchestrator.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_RESOURCES))
      .then(() => self.skipWaiting())
      .catch((err) => {
        // Continue even if some optional asset fails
        console.warn('Scotopic SW: Some pre-cache resources failed:', err);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // V2 is 100% on-device with zero backend API dependencies
  if (requestUrl.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch and update cache in background (Stale-While-Revalidate)
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

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
