// Folio Trax Service Worker — offline support
var CACHE_NAME = 'foliotrax-v1';
var urlsToCache = [
  './',
  './portfolio.html'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urlsToCache);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

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

self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  if (url.indexOf('finnhub.io') >= 0 || url.indexOf('api.anthropic.com') >= 0) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        fetch(event.request).then(function(fresh) {
          if (fresh && fresh.status === 200) {
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, fresh.clone());
            });
          }
        }).catch(function() {});
        return cached;
      }
      return fetch(event.request).then(function(fresh) {
        if (fresh && fresh.status === 200 && event.request.method === 'GET') {
          var clone = fresh.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return fresh;
      }).catch(function() {
        if (event.request.mode === 'navigate') {
          return caches.match('./portfolio.html');
        }
      });
    })
  );
});
