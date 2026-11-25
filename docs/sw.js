const cacheName = 'rehoboth-pilot-v20';
const assets = ['./', './index.html', './style.css?v=20', './app.js?v=20', './store.mjs?v=20', './catalogue.mjs?v=20', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(
    assets.map(path => new Request(new URL(path, self.registration.scope), {cache:'reload'}))
  )).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('rehoboth-pilot-') && key !== cacheName).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const root = new URL('./', self.registration.scope);
  const index = new URL('./index.html', root);
  const entry = event.request.mode === 'navigate' && url.origin === root.origin
    && (url.pathname === root.pathname || url.pathname === index.pathname);
  if (!entry && !assets.some(path => new URL(path, root).href === url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(event.request, {cache:'no-cache'});
      if (response.ok) return response;
      if (response.status < 500 && response.status !== 404) return response;
      return (await cache.match(entry ? root.href : event.request)) || response;
    } catch {
      return (await cache.match(entry ? root.href : event.request)) || Response.error();
    }
  })());
});
