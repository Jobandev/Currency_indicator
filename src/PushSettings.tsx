import { useEffect, useRef, useState } from 'react';
import { auth } from './firebase';
import { api } from './api';

export default function PushSettings({ uid }: { uid: string }) {
  const key = 'ratewatch:push:' + uid;
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(key) === 'enabled';
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const registrationRevision = useRef(0);
  const refreshWrite = useRef<Promise<unknown> | null>(null);
  const supported = Boolean(
    auth &&
    import.meta.env.VITE_FIREBASE_VAPID_KEY &&
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID &&
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'PushManager' in window,
  );

  useEffect(() => {
    if (!supported || !enabled || Notification.permission !== 'granted' || !auth) return;
    const app = auth.app;
    const revision = registrationRevision.current;
    let cancelled = false;
    void import('firebase/messaging')
      .then(async ({ getMessaging, getToken, isSupported }) => {
        if (!(await isSupported())) return;
        const registration = await navigator.serviceWorker.getRegistration('/');
        if (!registration?.active || auth?.currentUser?.uid !== uid) return;
        const token = await getToken(getMessaging(app), {
          serviceWorkerRegistration: registration,
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        });
        if (
          cancelled ||
          revision !== registrationRevision.current ||
          auth?.currentUser?.uid !== uid
        )
          return;
        const write = api('/push-device', {
          method: 'PUT',
          body: JSON.stringify({ token, enabled: true }),
        });
        refreshWrite.current = write;
        try {
          await write;
        } finally {
          if (refreshWrite.current === write) refreshWrite.current = null;
        }
      })
      .catch(() => {
        if (!cancelled && revision === registrationRevision.current)
          setMessage('Could not refresh push registration.');
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, supported, uid]);

  async function change() {
    if (!auth || busy) return;
    // Invalidate pending token refreshes before an opt-out can remove the device.
    if (enabled) registrationRevision.current++;
    setBusy(true);
    setMessage('');
    try {
      if (!enabled && (await Notification.requestPermission()) !== 'granted') {
        setMessage('Allow notifications in your browser or device settings to continue.');
        return;
      }
      const { getMessaging, getToken, deleteToken, isSupported } =
        await import('firebase/messaging');
      if (!(await isSupported())) throw new Error('Push is unavailable in this browser.');
      const registration = await navigator.serviceWorker.register('/sw.js');
      const worker = registration.active ? registration : await navigator.serviceWorker.ready;
      const messaging = getMessaging(auth.app);
      const token = await getToken(messaging, {
        serviceWorkerRegistration: worker,
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      });
      if (enabled) await refreshWrite.current?.catch(() => {});
      if (auth.currentUser?.uid !== uid) return;
      await api('/push-device', {
        method: 'PUT',
        body: JSON.stringify({ token, enabled: !enabled }),
      });
      setEnabled(!enabled);
      try {
        localStorage.setItem(key, enabled ? 'disabled' : 'enabled');
      } catch {
        /* Device storage unavailable. */
      }
      if (enabled) await deleteToken(messaging).catch(() => {});
      setMessage(enabled ? 'Push disabled on this device.' : 'Push enabled on this device.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update push notifications.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card chart-card">
      <h2>Push notifications</h2>
      {supported ? (
        <button className="button secondary" disabled={busy} onClick={() => void change()}>
          {enabled ? 'Disable push on this device' : 'Enable push on this device'}
        </button>
      ) : (
        <p>
          Push is unavailable here. On iPhone, install RateWatch from Safari and open it from your
          home screen.
        </p>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
