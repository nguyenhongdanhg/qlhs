// Service Worker for Push Notifications
self.addEventListener('push', function(event) {
  const data = event.data?.json() || {};
  
  const title = data.title || 'Nhắc nhở báo cơm';
  const options = {
    body: data.body || 'Sắp hết hạn báo cơm!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'meal-reminder',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/meals'
    },
    actions: [
      { action: 'open', title: 'Mở báo cơm' },
      { action: 'dismiss', title: 'Đóng' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/meals';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open a new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
