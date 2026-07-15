// frontend/public/sw.js
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/logo.png',
      badge: '/logo.png',
      vibrate: [200, 100, 200, 100, 200], // Phone Vibrate Karega
      data: { url: data.url || '/' },
      requireInteraction: true // Screen par ruka rahega
    };
    
    // FIX: Red Dot (App Badge) set karna
    if ('setAppBadge' in navigator) {
      navigator.setAppBadge(1).catch(() => {});
    }

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // Click karte hi popup band hoga
  const urlToOpen = event.notification.data?.url || '/';

  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }
  
  // Direct app khol dega usi chat par
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});


self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
// frontend/public/sw.js ke sabse aakhir me ye lagayein

self.addEventListener('message', (event) => {
  // Jab app se SKIP_WAITING ka message aaye, tabhi naya update apply karo
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});