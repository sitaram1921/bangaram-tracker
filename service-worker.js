// ═══════════════════════════════════════════════════════════
// SERVICE WORKER - Enables offline functionality & PWA features
// ═══════════════════════════════════════════════════════════

const CACHE_NAME = 'habit-tracker-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/config.js',
  '/utils.js',
  '/db.js',
  '/ui.js',
  '/trends.js',
  '/app.js',
  '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Some assets failed to cache:', err);
        // Continue even if some assets fail
        return cache.addAll(
          ASSETS_TO_CACHE.filter(url => 
            !url.includes('firebase') && !url.includes('chart.js')
          )
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // For Firebase and CDN requests, use network-first strategy
  if (
    event.request.url.includes('firebase') ||
    event.request.url.includes('googleapis') ||
    event.request.url.includes('cdn.jsdelivr.net') ||
    event.request.url.includes('google-analytics')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          return response;
        })
        .catch(() => {
          // If network fails, try to return from cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // For local assets, use cache-first strategy (faster offline experience)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(event.request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
      .catch(() => {
        // Fallback for offline
        return new Response('Offline - app data cached', {
          status: 200,
          statusText: 'OK'
        });
      })
  );
});

// Background sync for data when coming back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-habits') {
    event.waitUntil(
      // When back online, trigger sync in the app
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_HABITS',
            timestamp: new Date().toISOString()
          });
        });
      })
    );
  }
});

// Message handling for communication with the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── PUSH NOTIFICATIONS ────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { data = { title: '💕', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title || '💕', {
      body: data.body || '',
      vibrate: [200, 100, 200],
      tag: 'bangaram-reminder',
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin)) return c.focus();
      }
      return clients.openWindow('/');
    })
  );
});

console.log('✅ Service Worker registered for Habit Tracker');
