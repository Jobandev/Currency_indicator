import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

const dismissedKey = 'ratewatch-install-popup-dismissed';

export default function InstallAction() {
  const [prompt, setPrompt] = useState<InstallEvent>();
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(dismissedKey) !== 'true';
    } catch {
      return true;
    }
  });
  const [manual, setManual] = useState(false);
  const [installing, setInstalling] = useState(false);
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

  function dismiss() {
    setOpen(false);
    try {
      sessionStorage.setItem(dismissedKey, 'true');
    } catch {
      // The popup still stays closed while the app is open.
    }
  }

  async function install() {
    if (!prompt || installing) return;
    setInstalling(true);
    try {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === 'accepted') setInstalled(true);
      dismiss();
    } catch {
      // Keep the popup open so the visitor can use the browser's install menu.
    } finally {
      setManual(true);
      setInstalling(false);
      setPrompt(undefined);
    }
  }

  if (installed || (!prompt && !ios && !manual)) return null;

  return (
    <div className="install-widget">
      <button
        className="button install-trigger"
        aria-expanded={open}
        aria-controls={open ? 'install-popup' : undefined}
        onClick={open ? dismiss : () => setOpen(true)}
      >
        <Download size={15} aria-hidden="true" /> Install
      </button>
      {open && (
        <section id="install-popup" className="install-popup" aria-labelledby="install-title">
          <div className="install-popup-heading">
            <h2 id="install-title">Install RateWatch</h2>
            <button type="button" aria-label="Close install popup" onClick={dismiss}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {prompt ? (
            <>
              <p>Open RateWatch directly from your device.</p>
              <button
                className="button primary"
                disabled={installing}
                onClick={() => void install()}
              >
                Install app
              </button>
            </>
          ) : (
            <p>
              {ios
                ? 'In Safari, tap Share, then Add to Home Screen and Add.'
                : 'Open your browser menu and look for the option to install RateWatch.'}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
