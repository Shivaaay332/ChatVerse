// frontend/public/sw.js

self.addEventListener('push', function(event) {
  let data = { title: 'ChatVerse', body: 'New message received', url: '/' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('Push data parsing error:', e);
    }
  }

  const options = {
    body: data.body,
    icon: '/logo.png', // Logo folder me hona chahiye
    badge: '/logo.png', // Red dot ke liye zaroori
    vibrate: [300, 100, 300, 100, 300], // WhatsApp jaisi strong vibration
    data: { url: data.url || '/' },
    requireInteraction: true // Screen par ruka rahega
  };

  // APP BADGE (RED DOT) SET KARNE KA CODE
  if ('setAppBadge' in navigator) {
    navigator.setAppBadge(1).catch(err => console.log('Badge error:', err));
  }

  // GUARANTEED NOTIFICATION SHOW KAREGA
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  // Click karne par badge (red dot) hata do
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }
  
  // App ko usi chat par open karega
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('install', (event) => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));