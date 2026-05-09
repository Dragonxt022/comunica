// Service Worker — Push Notifications

self.addEventListener('install', function(event) {
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
    var data = {};
    try { data = event.data ? event.data.json() : {}; } catch(e) {}

    var title   = data.title || 'Comunica';
    var options = {
        body:    data.body    || '',
        icon:    data.icon    || '/icon.svg',
        badge:   '/icon.svg',
        tag:     data.tag     || 'comunica-' + Date.now(),
        renotify: true,
        data:    { url: data.url || '/' },
        vibrate: [100, 50, 100],
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    var url = (event.notification.data && event.notification.data.url) || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
            for (var i = 0; i < list.length; i++) {
                if (list[i].url.includes(self.location.origin)) {
                    return list[i].focus().then(function(c) { return c.navigate(url); });
                }
            }
            return clients.openWindow(url);
        })
    );
});
