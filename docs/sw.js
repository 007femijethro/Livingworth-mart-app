const cacheName = 'rehoboth-pilot-v8';
const assets = ['./', './index.html', './style.css', './app.js', './store.mjs', './catalogue.mjs', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('rehoboth-pilot-') && key !== cacheName).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const asset = new URL(event.request.url);
  if (event.request.method !== 'GET' || !assets.some(path => new URL(path, self.registration.scope).href === asset.href)) return;
  event.respondWith(fetch(event.request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(event.request, response.clone());
    }
    return response;
  }).catch(async () => (await caches.match(event.request)) || Response.error()));
});
