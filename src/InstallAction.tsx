import { useEffect, useState } from 'react';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export default function InstallAction() {
  const [prompt, setPrompt] = useState<InstallEvent>();
  const [installed, setInstalled] = useState(
    () =>
      matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  );
  const [update, setUpdate] = useState<ServiceWorker>();
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(undefined);
    };
    let active = true;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null | undefined;
    const checkWaiting = () => {
      if (active && registration?.waiting && navigator.serviceWorker.controller)
        setUpdate(registration.waiting);
    };
    const watchInstall = () => {
      installing?.removeEventListener('statechange', checkWaiting);
      installing = registration?.installing;
      installing?.addEventListener('statechange', checkWaiting);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((worker) => {
          if (!active) return;
          registration = worker;
          checkWaiting();
          watchInstall();
          worker.addEventListener('updatefound', watchInstall);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      registration?.removeEventListener('updatefound', watchInstall);
      installing?.removeEventListener('statechange', checkWaiting);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    try {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === 'accepted') setInstalled(true);
    } finally {
      setPrompt(undefined);
    }
  }

  return (
    <div className="install-actions">
      {!installed &&
        (prompt ? (
          <button className="button secondary" onClick={() => void install()}>
            Install RateWatch
          </button>
        ) : ios ? (
          <p>Open in Safari → Share → Add to Home Screen → Add.</p>
        ) : null)}
      {update && (
        <button
          className="button secondary"
          onClick={() => {
            navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
              once: true,
            });
            update.postMessage('ACTIVATE_UPDATE');
          }}
        >
          Update RateWatch
        </button>
      )}
    </div>
  );
}
