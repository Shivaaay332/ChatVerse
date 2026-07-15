// frontend/public/sw.js
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // Notification pe click karte hi usko band karo
  
  // Click karne par App open karo (WhatsApp jaisa behavior)
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      if (windowClients.length > 0) {
        windowClients[0].focus(); // Agar app background me hai toh aage le aao
      } else {
        clients.openWindow('/'); // Agar puri tarah band hai toh naya open karo
      }
    })
  );
});