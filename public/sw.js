// public/sw.js — Pure Web Push service worker, tanpa Firebase SDK

self.addEventListener('install', (e) => {
  console.log('[SW] Installing sw.js');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[SW] Activating sw.js');
  e.waitUntil(
    // Claim semua clients agar SW langsung aktif tanpa tunggu refresh
    clients.claim()
  );
});

self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event.data ? event.data.text() : 'no data');

  if (!event.data) {
    console.log('[SW] No data in push event, showing default notification');
    const tag = `request-${Date.now()}`;
    event.waitUntil(
      self.registration.showNotification('New Request', {
        body: 'You have a new request.',
        icon: '/logo_offline_torch.png',
        badge: '/logo_offline_torch.png',
        tag: tag,
        requireInteraction: false,
      }).then(() => {
        console.log('[SW] Default notification shown, tag:', tag);
      }).catch((err) => {
        console.error('[SW] showNotification failed:', err.name, err.message);
      })
    );
    return;
  }

  let data = {};
  try {
    data = event.data.json();
    console.log('[SW] Push data parsed as JSON:', JSON.stringify(data));
  } catch {
    console.log('[SW] Push data is not JSON, using as text');
    data = { title: 'New Request', body: event.data.text() };
  }

  const notifTag = `request-${Date.now()}`;
  console.log('[SW] Showing notification, tag:', notifTag);

  event.waitUntil(
    self.registration.showNotification(data.title || 'New Request', {
      body: data.body || 'You have a new request assigned.',
      icon: '/logo_offline_torch.png',
      badge: '/logo_offline_torch.png',
      tag: notifTag,
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: { url: data.url || '/request-store' },
    }).then(() => {
      console.log('[SW] Notification shown successfully, tag:', notifTag);
    }).catch((err) => {
      console.error('[SW] showNotification failed:', err.name, err.message);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/request-store';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if (c.url.includes('/request-store') && 'focus' in c) return c.focus();
        }
        return clients.openWindow(targetUrl);
      })
  );
});