// Folio Trax Service Worker — offline support
var CACHE_NAME = 'foliotrax-v1';
var urlsToCache = [
  './',
  './portfolio.html'
];

// Install — cache the app shell
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urlsToCache);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate — clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch — network-first for API calls, cache-first for app shell
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // API calls (Finnhub, OANDA prices) — always try network, don't cache stale prices
  if (url.indexOf('finnhub.io') >= 0 || url.indexOf('api.anthropic.com') >= 0) {
    event.respondWith(
      fetch(event.request).catch(function() {
        // Offline — return empty so app uses last-known values from localStorage
        return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }

  // App shell & assets — cache-first, fall back to network
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // Return cached, but also update cache in background
        fetch(event.request).then(function(fresh) {
          if (fresh && fresh.status === 200) {
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, fresh.clone());
            });
          }
        }).catch(function() {});
        return cached;
      }
      // Not cached — fetch and cache
      return fetch(event.request).then(function(fresh) {
        if (fresh && fresh.status === 200 && event.request.method === 'GET') {
          var clone = fresh.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return fresh;
      }).catch(function() {
        // Fully offline and not cached — return the app shell for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./portfolio.html');
        }
      });
    })
  );
});
