// Firebase Messaging Service Worker
// This file MUST live at /public/firebase-messaging-sw.js so the browser can
// register it at the root scope (/firebase-messaging-sw.js).

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// These values are safe to embed — they are already public in the browser bundle.
firebase.initializeApp({
  apiKey: 'AIzaSyD8IGV0HYQkkglzRp7bsSccZAk7XOOnfvo',
  authDomain: 'netcare-5dd8e.firebaseapp.com',
  projectId: 'netcare-5dd8e',
  messagingSenderId: '501595052211',
  appId: '1:501595052211:web:b342977843e429febdb8c6',
});

const messaging = firebase.messaging();

// A service worker update otherwise sits "waiting" until every tab open on
// this origin is fully closed — a plain reload does not activate it, so a
// stale worker (e.g. one still expecting the removed `payload.notification`
// field) can keep running indefinitely across code deploys. Force every new
// version to take over immediately instead.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Handle background messages (app is closed or in another tab). Reads from
// `data`, not `payload.notification` — the backend sends data-only messages
// on purpose (see notify.py): a message with a top-level `notification` field
// gets auto-displayed by the browser's own internal FCM handling, bypassing
// this handler entirely, which means the notification actually shown would
// never carry the `data.url` the click handler below depends on.
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  self.registration.showNotification(data.title || 'NetCare', {
    body: data.body || '',
    icon: '/logo/logo-icon.png',
    badge: '/logo/logo-icon.png',
    data,
  });
});

// Every notification we show — foreground (useNotifications.ts) or background
// (above) — goes through this same registration, so one handler covers both.
// `data.url` is set per-event by the backend (see notify_patient/notify_doctor
// call sites) to the screen relevant to whichever role is receiving it; absent
// for events with no dedicated screen to land on.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) return client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
