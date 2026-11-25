// Retire the previous offline worker and its app-shell caches.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.allSettled(keys.filter(key => key.startsWith('rehoboth-pilot-')).map(key => caches.delete(key)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
