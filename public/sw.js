// ============================================================
// PWA Service Worker — App-level caching & offline support
//
// This is SEPARATE from firebase-messaging-sw.js (which
// handles FCM push). This SW handles:
//   - App shell caching
//   - Static asset caching
//   - Offline fallback
//   - Update management
// ============================================================

const APP_VERSION = 'mwpos-v3'
const CACHE_NAMES = {
  static: `${APP_VERSION}-static`,
  pages: `${APP_VERSION}-pages`,
  assets: `${APP_VERSION}-assets`
}

// ── Assets to pre-cache on install ────────────────────────
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.json',
  '/MW_POS.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
]

// ── Install — pre-cache app shell ─────────────────────────
self.addEventListener('install', event => {
  console.log(`[PWA-SW ${APP_VERSION}] Installing`)
  event.waitUntil(
    caches
      .open(CACHE_NAMES.static)
      .then(cache => {
        console.log('[PWA-SW] Pre-caching app shell')
        return cache.addAll(PRECACHE_URLS)
      })
      .catch(err => console.error('[PWA-SW] Pre-cache error:', err))
  )
  // NOTE: NOT calling skipWaiting() — avoids infinite reload loops.
})

// ── Activate — clean old caches ───────────────────────────
self.addEventListener('activate', event => {
  console.log(`[PWA-SW ${APP_VERSION}] Activating`)
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => !Object.values(CACHE_NAMES).includes(key))
            .map(key => {
              console.log('[PWA-SW] Deleting old cache:', key)
              return caches.delete(key)
            })
        )
      )
      .then(() => self.clients.claim())
  )
})

// ── Fetch — network-first for pages, cache-first for static ──
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests, Firebase RTDB, and chrome-extension
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname === '/firebase-messaging-sw.js') return

  // ── Navigation requests (HTML pages) — network first ────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful page loads
          const cloned = response.clone()
          caches.open(CACHE_NAMES.pages).then(cache => {
            cache.put(request, cloned)
          })
          return response
        })
        .catch(() => {
          // Offline — serve cached page or fallback
          return caches
            .match(request)
            .then(cached => cached || caches.match('/offline'))
            .then(
              fallback =>
                fallback ||
                new Response('You are offline', {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'text/plain' }
                })
            )
        })
    )
    return
  }

  // ── Static assets — cache first ─────────────────────────
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached

      return fetch(request)
        .then(response => {
          // Only cache successful responses
          if (!response.ok) return response

          const cloned = response.clone()
          caches.open(CACHE_NAMES.assets).then(cache => {
            cache.put(request, cloned)
          })
          return response
        })
        .catch(() => {
          // Return a placeholder for images
          if (request.destination === 'image') {
            return new Response('', { status: 204 })
          }
          throw new Error('Network unavailable')
        })
    })
  )
})

// ── Message handling ──────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

console.log(`[PWA-SW ${APP_VERSION}] Ready`)
