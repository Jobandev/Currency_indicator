import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

declare global {
  interface Window {
    rateWatchInstallPrompt?: InstallEvent;
  }
}

const dismissedKey = 'ratewatch-install-popup-dismissed';

export default function InstallAction() {
  const [prompt, setPrompt] = useState(() => window.rateWatchInstallPrompt);
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

  const android = /Android/i.test(navigator.userAgent);
  const androidChrome = android && /\bChrome\//.test(navigator.userAgent);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      delete window.rateWatchInstallPrompt;
      setPrompt(undefined);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (window.rateWatchInstallPrompt) setPrompt(window.rateWatchInstallPrompt);
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
      setOpen(true);
    } finally {
      setManual(true);
      setInstalling(false);
      if (window.rateWatchInstallPrompt === prompt) delete window.rateWatchInstallPrompt;
      setPrompt(window.rateWatchInstallPrompt);
    }
  }

  if (installed) return null;

  return (
    <div className="install-widget" data-mobile-only={!prompt && !ios && !android && !manual}>
      <button
        type="button"
        className="button install-trigger"
        disabled={installing}
        aria-expanded={prompt ? undefined : open}
        aria-controls={!prompt && open ? 'install-popup' : undefined}
        onClick={() => {
          if (prompt) {
            void install();
          } else if (open && (!androidChrome || manual)) {
            dismiss();
          } else {
            setOpen(true);
          }
        }}
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
          ) : androidChrome && !manual ? (
            <>
              <p>
                Chrome is checking whether RateWatch can be installed. The install confirmation will
                be available here when Chrome is ready.
              </p>
              <details>
                <summary>Install manually</summary>
                <p>Open the Chrome menu and choose Add to Home screen or Install app.</p>
              </details>
            </>
          ) : (
            <p>
              {ios
                ? 'In Safari, tap Share, then Add to Home Screen. Turn on Open as Web App if shown, then tap Add.'
                : android
                  ? 'In Chrome, open the three-dot menu and choose Add to Home screen or Install app.'
                  : 'Open your browser menu and look for the option to install RateWatch.'}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
