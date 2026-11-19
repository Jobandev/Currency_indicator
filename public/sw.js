const cacheName = 'ratewatch-offline-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.add('/offline.html')));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('ratewatch-offline-') && key !== cacheName)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('message', (event) => {
  if (event.data === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.mode !== 'navigate' ||
    url.origin !== self.location.origin ||
    url.pathname === '/api' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/__/')
  )
    return;
  event.respondWith(
    fetch(event.request).catch(
      async () => (await caches.match('/offline.html', { cacheName })) || Response.error(),
    ),
  );
});

self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data?.json()?.data;
  } catch {
    return;
  }
  if (!data || !/^\/dashboard#alert-[\w-]+$/.test(data.path) || !/^alert-[\w-]+$/.test(data.tag))
    return;
  event.waitUntil(
    self.registration.showNotification('RateWatch', {
      body: 'Your exchange-rate target was reached. Open RateWatch to view your alert.',
      icon: '/icon-192.png',
      tag: data.tag,
      data: { path: data.path },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data?.path;
  if (typeof path === 'string' && /^\/dashboard#alert-[\w-]+$/.test(path)) {
    event.waitUntil(self.clients.openWindow(path));
  }
});
