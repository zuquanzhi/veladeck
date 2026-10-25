/* Only the public app shell is cached. API responses and personal files never enter Cache Storage. */
const shell = self.__WB_MANIFEST;
const cacheName = 'veladeck-shell-v1';
self.addEventListener('install', (event) =>
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) =>
        cache.addAll(shell.map((item) => (typeof item === 'string' ? item : item.url))),
      )
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                (k.startsWith('veladeck-shell-') || k.startsWith('runotter-shell-')) &&
                k !== cacheName,
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.includes('/api/') ||
    !/\.(js|css|png|svg|woff2)$/.test(url.pathname)
  )
    return;
  event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request)));
});
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'VelaDeck', {
      body: payload.body || '打开查看新进展',
      icon: 'icon-192.png',
      tag: payload.tag,
      data: { url: payload.deep_link || './' },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data.url, self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(self.clients.openWindow(url.href));
});
