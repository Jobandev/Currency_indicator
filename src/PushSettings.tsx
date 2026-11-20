import { useEffect, useRef, useState } from 'react';
import { auth } from './firebase';
import { useLocation } from 'react-router-dom';
import { api } from './api';

export default function PushSettings({
  uid,
  inline = false,
  accountHasPush = true,
  onEnabled,
}: {
  uid: string;
  inline?: boolean;
  accountHasPush?: boolean;
  onEnabled?: () => void;
}) {
  const { hash } = useLocation();
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
    if (hash === '#push-notifications')
      document.getElementById('push-notifications')?.scrollIntoView();
  }, [hash]);

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
    const disabling = enabled && !inline;
    if (disabling) registrationRevision.current++;
    setBusy(true);
    setMessage('');
    try {
      if (!disabling && (await Notification.requestPermission()) !== 'granted') {
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
      if (disabling) await refreshWrite.current?.catch(() => {});
      if (auth.currentUser?.uid !== uid) return;
      await api('/push-device', {
        method: 'PUT',
        body: JSON.stringify({ token, enabled: !disabling }),
      });
      setEnabled(!disabling);
      try {
        localStorage.setItem(key, disabling ? 'disabled' : 'enabled');
      } catch {
        /* Device storage unavailable. */
      }
      if (disabling) await deleteToken(messaging).catch(() => {});
      else onEnabled?.();
      setMessage(disabling ? 'Push disabled on this device.' : 'Push enabled on this device.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update push notifications.');
    } finally {
      setBusy(false);
    }
  }

  async function testDisplay() {
    setMessage('');
    try {
      if (Notification.permission !== 'granted') {
        setMessage('Allow notifications in this browser and device settings, then try again.');
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (!registration?.active) {
        setMessage('Enable push on this device and reload RateWatch before testing.');
        return;
      }
      await registration.showNotification('RateWatch test', {
        body: 'This device can display RateWatch notifications.',
        icon: '/icon-192.png',
        tag: 'ratewatch-device-test',
      });
      setMessage('Test requested. Check your device’s notification centre if no banner appeared.');
    } catch {
      setMessage(
        'This device could not display the test. Check your browser and system notification settings.',
      );
    }
  }

  if (inline) {
    if (supported && enabled && accountHasPush && Notification.permission === 'granted')
      return null;
    return (
      <div className="rw-push-setup">
        {supported ? (
          <>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => void change()}
            >
              {busy ? 'Setting up push...' : 'Enable push on this device'}
            </button>
          </>
        ) : (
          <p>
            Push is unavailable in this browser. On iPhone, add RateWatch to your Home Screen and
            open it there.
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    );
  }

  return (
    <section id="push-notifications" className="card chart-card" aria-labelledby="push-heading">
      <h2 id="push-heading">Push notifications</h2>
      {supported ? (
        <div className="rw-push-actions">
          <button className="button secondary" disabled={busy} onClick={() => void change()}>
            {enabled ? 'Disable push on this device' : 'Enable push on this device'}
          </button>
          {enabled && (
            <button className="button outline" disabled={busy} onClick={() => void testDisplay()}>
              Test notification display
            </button>
          )}
        </div>
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
