// Service worker for Workflows Task Board PWA.
// Caches application shell assets.
// App shell uses network-first with cache fallback when offline.
// Icons use cache-first with network fallback.
// /api/* and non-GET requests bypass the cache.

var CACHE_VERSION = '1.2.1';
var CACHE_NAME = 'workflows-board-' + CACHE_VERSION;
var SHELL_ASSETS = [
  '/',
  '/index.html',
  '/theme.css',
  '/app.js',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isShellRequest(request, url) {
  if (request.mode === 'navigate') return true;
  var pathname = url.pathname;
  return (
    pathname === '/' ||
    pathname === '/index.html' ||
    pathname === '/app.js' ||
    pathname === '/theme.css' ||
    pathname === '/manifest.json'
  );
}

function isIconRequest(url) {
  var pathname = url.pathname;
  return (
    pathname === '/icon.svg' ||
    pathname === '/icon-192.png' ||
    pathname === '/icon-512.png' ||
    pathname === '/apple-touch-icon.png'
  );
}

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  // Network-first / bypass cache for /api/* and non-GET requests
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // App shell is network-first with cache fallback only when offline
  if (isShellRequest(event.request, url)) {
    event.respondWith(
      fetch(event.request)
        .then(function (networkResponse) {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            var responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(function () {
          return caches.match(event.request).then(function (cachedResponse) {
            if (cachedResponse) {
              return cachedResponse;
            }
            if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
              return caches.match('/').then(function (rootResponse) {
                return rootResponse || caches.match('/index.html');
              });
            }
            return Promise.reject(new Error('offline'));
          });
        })
    );
    return;
  }

  // Icons are cache-first with network fallback
  if (isIconRequest(url)) {
    event.respondWith(
      caches.match(event.request).then(function (cachedResponse) {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(function (networkResponse) {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            var responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Default GET requests: network with cache fallback
  event.respondWith(
    fetch(event.request).catch(function () {
      return caches.match(event.request);
    })
  );
});
