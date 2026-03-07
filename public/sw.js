self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'New Request', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title || 'New Request', {
      body: data.body || 'You have a new request assigned.',
      icon: '/logo_offline_torch.png',
      badge: '/logo_offline_torch.png',
      tag: 'request-store',
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes('/request-store') && 'focus' in c) return c.focus();
      }
      return clients.openWindow('/request-store');
    })
  );
});