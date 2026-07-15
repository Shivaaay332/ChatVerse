self.addEventListener('push', function(event) {
  if (!event.data) return;
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: data.icon || '/logo.png',
    badge: '/logo.png',
    vibrate: [300, 100, 300, 100, 300], // Strong Vibration for WhatsApp feel
    data: { url: data.url || '/' },
    requireInteraction: true // Screen pe ruka rahega
  };

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      let isFocused = false;
      
      // Check karo ki kya app abhi screen par chalu (focused) hai?
      for (let client of windowClients) {
        if (client.focused) {
          isFocused = true;
          break;
        }
      }

      // AGAR APP BAND HAI YA PHONE LOCKED HAI, TABHI POPUP & RED DOT DIKHAO
      if (!isFocused) {
        if ('setAppBadge' in navigator) navigator.setAppBadge(1).catch(() => {});
        return self.registration.showNotification(data.title, options);
      }
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});
  
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