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
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
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
    </div>
  );
}
