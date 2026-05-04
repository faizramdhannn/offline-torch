// public/sw.js — Web Push service worker

self.addEventListener('install', (e) => {
  console.log('[SW] Installing sw.js');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[SW] Activating sw.js');
  e.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event.data ? event.data.text() : 'no data');

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
      console.log('[SW] Push data parsed as JSON:', JSON.stringify(data));
    } catch {
      console.log('[SW] Push data is not JSON, using as text');
      data = { title: 'New Request', body: event.data.text() };
    }
  }

  const notifTag = 'offline-torch-notif';

  event.waitUntil(
    (async () => {
      // 1. Tampilkan notifikasi
      await self.registration.showNotification(data.title || 'New Request', {
        body: data.body || 'You have a new request assigned.',
        icon: '/logo_offline_torch.png',
        badge: '/logo_offline_torch.png',
        tag: notifTag,
        renotify: true,           // tetap muncul meski tag sama
        requireInteraction: false, // boleh auto-dismiss
        vibrate: [200, 100, 200],
        data: { url: data.url || '/request-store' },
      });
      console.log('[SW] Notification shown, tag:', notifTag);

      // 2. Kirim pesan ke semua tab agar memutar suara
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        client.postMessage({ type: 'PLAY_NOTIFICATION_SOUND' });
      }

      // 3. Auto-close setelah 10 detik
      await new Promise((resolve) => setTimeout(resolve, 10000));
      const notifs = await self.registration.getNotifications({ tag: notifTag });
      notifs.forEach((n) => n.close());
      console.log('[SW] Notification auto-closed after 10s');
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/request-store';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if (c.url.includes(self.location.origin) && 'focus' in c) {
            c.navigate(targetUrl);
            return c.focus();
          }
        }
        return clients.openWindow(targetUrl);
      })
  );
});