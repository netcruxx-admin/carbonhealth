'use client';

import { useEffect, useRef } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { getFirebaseMessaging } from '@/lib/firebase';
import { useRegisterFcmTokenMutation, useUnregisterFcmTokenMutation } from '@/store/api';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/**
 * getToken() fails with messaging/token-subscribe-failed ("Internal error
 * encountered") when the browser already holds a push subscription for this
 * service worker under a *different* applicationServerKey — the Push API
 * refuses to change the key on an existing subscription rather than erroring
 * usefully about it. This happens in practice: a VAPID key added or rotated
 * after a browser already subscribed once, or a subscription left over from
 * an earlier register/unregister cycle. Self-heal by dropping the stale
 * subscription and retrying once, rather than leaving the device silently
 * unregistered until someone notices and manually clears site data.
 */
async function getTokenResilient(
  messaging: Awaited<ReturnType<typeof getFirebaseMessaging>>,
  registration: ServiceWorkerRegistration
): Promise<string | null> {
  if (!messaging) return null;
  try {
    return await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== 'messaging/token-subscribe-failed') throw err;

    const existing = await registration.pushManager.getSubscription();
    await existing?.unsubscribe();
    return await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  }
}

/**
 * Requests notification permission, obtains an FCM token, and registers it
 * with the backend.  Cleans up (unregisters) when the component unmounts —
 * in practice that only happens on logout, which is exactly when we want to
 * stop delivering pushes to this browser.
 *
 * Mount this hook once, inside DashboardShell, so it runs for every
 * authenticated user automatically.
 */
export function useNotifications() {
  const [registerToken] = useRegisterFcmTokenMutation();
  const [unregisterToken] = useUnregisterFcmTokenMutation();
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    async function setup() {
      // Service workers require HTTPS (or localhost).
      if (typeof window === 'undefined' || !('Notification' in window)) return;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const messaging = await getFirebaseMessaging();
      if (!messaging) return;

      // Register the service worker explicitly so Firebase uses our file.
      await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });

      // register() resolves as soon as the worker exists, which can still be
      // "installing" — pushManager.subscribe() (what getToken does under the
      // hood) needs an *active* worker, so wait for that specifically.
      const registration = await navigator.serviceWorker.ready;

      const token = await getTokenResilient(messaging, registration);
      if (!token) return;

      tokenRef.current = token;
      await registerToken({ token, device_label: navigator.userAgent.slice(0, 200) });

      // Handle foreground messages (app is open and focused). Routed through
      // the service worker's showNotification rather than `new Notification`:
      // Chrome on Android throws "Illegal constructor" on the page-script
      // constructor and requires ServiceWorkerRegistration.showNotification()
      // — this path works identically on desktop too, so one code path covers
      // both foreground and background delivery.
      unsubscribe = onMessage(messaging, (payload) => {
        // Read from `data`, not `payload.notification` — the backend sends
        // data-only messages on purpose (see notify.py) so this handler is
        // guaranteed to run and always has the click-routing `data` attached.
        const data = payload.data ?? {};
        if (Notification.permission === 'granted') {
          registration.showNotification(data.title ?? 'NetCare', {
            body: data.body ?? '',
            icon: '/logo/logo-icon.png',
            data,
          });
        }
      });
    }

    setup().catch(console.error);

    return () => {
      unsubscribe?.();
      // Unregister on unmount (logout) so pushes stop.
      if (tokenRef.current) {
        unregisterToken({ token: tokenRef.current, device_label: '' }).catch(() => {});
        tokenRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
