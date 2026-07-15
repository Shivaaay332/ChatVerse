// frontend/public/sw.js
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      if (windowClients.length > 0) {
        windowClients[0].focus(); 
      } else {
        clients.openWindow('/');
      }
    })
  );
});

// Ye zaroori hai mobile me service worker ko instantly activate karne ke liye
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});