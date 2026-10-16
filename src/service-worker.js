// Offline support. This file is a template: at build time vite.config.ts
// fills in PRECACHE (every built file plus everything in public/) and
// CACHE_NAME (unique per build), and emits the result as /sw.js. It is
// registered only in production builds (see main.tsx).
//
// Strategy:
//  - install: download every file of this build, so every game works offline
//    after the first visit.
//  - page navigations: network first (so a new deploy shows up straight
//    away), falling back to the cached app shell when offline.
//  - everything else on this origin: cache first.
//  - activate: delete older builds' caches. A tab still running an older
//    build that then fails to load a game's code reloads itself (see
//    lazyGame() in projects.ts).

const CACHE_NAME = '__CACHE_NAME__'
const PRECACHE = __PRECACHE__

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          if (response.ok) void caches.open(CACHE_NAME).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/').then((cached) => cached ?? Response.error())),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
