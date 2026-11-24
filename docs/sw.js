const cacheName = 'rehoboth-pilot-v15';
const assets = ['./', './index.html', './style.css?v=15', './app.js?v=15', './store.mjs', './catalogue.mjs', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('rehoboth-pilot-') && key !== cacheName).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const asset = new URL(event.request.url);
  if (event.request.method !== 'GET' || !assets.some(path => new URL(path, self.registration.scope).href === asset.href)) return;
  event.respondWith(fetch(event.request, {cache:'no-cache'}).then(async response => {
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(event.request, response.clone());
    }
    return response;
  }).catch(async () => (await caches.match(event.request)) || Response.error()));
});
