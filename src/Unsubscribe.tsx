import { useState } from 'react';
import { api } from './api';
import { Footer, PublicHeader } from './ui';

export default function Unsubscribe() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [value, signature] = window.location.hash.slice(1).split('.');
  async function submit() {
    setBusy(true);
    try {
      await api('/digests/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ value, signature }),
      });
      window.history.replaceState(null, '', '/unsubscribe');
      setStatus('Weekly and monthly summaries are turned off.');
    } catch {
      setStatus('This link could not be verified. You can turn off summaries in your settings.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="section">
        <h1>Unsubscribe from summaries</h1>
        {value && signature && (
          <button className="button" disabled={busy} onClick={() => void submit()}>
            Turn off summaries
          </button>
        )}
        <p role="status">
          {status || (!signature ? 'Open the unsubscribe link from your email to continue.' : '')}
        </p>
      </main>
      <Footer />
    </>
  );
}
