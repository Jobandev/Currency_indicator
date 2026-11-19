import { useContext, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { ArrowRight, Check, Globe2, Mail, Trash2, Bell } from 'lucide-react';
import PushSettings from './PushSettings';
import InstallAction from './InstallAction';
import { auth } from './firebase';
import { api } from './api';
import { Footer, friendly, PublicHeader, Session, Shell, Toast } from './ui';
export function AuthPage({ mode }: { mode: 'login' | 'register' | 'reset' }) {
  const [params] = useSearchParams();
  const next = params.get('next') || '';
  const destination = /^\/(?:dashboard|settings|alerts\/(?:new|[\w-]+\/edit))(?:[?#]|$)/.test(next)
    ? next
    : '/dashboard';
  const { user } = useContext(Session),
    toast = useContext(Toast),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function finish(u: User) {
    await api('/profile', { method: 'POST' });
    if (mode === 'register') await sendEmailVerification(u);
    toast(
      mode === 'register'
        ? 'Account created. Check your inbox to verify your email.'
        : 'Welcome back.',
    );
    navigate(destination);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!auth) {
      setError('Firebase is not configured. Follow README.md to enable accounts.');
      return;
    }
    const f = new FormData(e.currentTarget),
      email = String(f.get('email'));
    setBusy(true);
    setError('');
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email);
        toast('If this account exists, a password reset link has been sent.');
      } else if (mode === 'register') {
        const c = await createUserWithEmailAndPassword(auth, email, String(f.get('password')));
        await updateProfile(c.user, { displayName: String(f.get('name')) });
        await finish(c.user);
      } else
        await finish(
          (await signInWithEmailAndPassword(auth, email, String(f.get('password')))).user,
        );
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    if (!auth) {
      setError('Firebase is not configured. See README.md.');
      return;
    }
    setBusy(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      await api('/profile', { method: 'POST' });
      navigate(destination);
      toast('Signed in with Google.');
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  if (user && mode !== 'reset' && !busy && !error) return <Navigate to={destination} />;
  return (
    <>
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="auth-page">
        <aside>
          <span className="eyebrow">GOOD TIMING STARTS HERE</span>
          <h1>
            A little patience.
            <br />
            <em>A better possibility.</em>
          </h1>
          <p>Let your next exchange rate come to you.</p>
          <div className="auth-quote">
            <Bell size={30} />
            <h3>
              Less checking.
              <br />
              More living.
            </h3>
            <span>
              Free email alerts. Three active targets.
              <br />
              No card, no commitment.
            </span>
          </div>
        </aside>
        <section className="auth-form card">
          <span className="eyebrow">WELCOME TO RATEWATCH</span>
          <h2>
            {mode === 'register'
              ? 'Make yourself at home.'
              : mode === 'reset'
                ? 'Let’s get you back in.'
                : 'Good to see you again.'}
          </h2>
          <p className="muted">
            {mode === 'register'
              ? 'Create an account to start watching your rates.'
              : mode === 'reset'
                ? 'We’ll email you a secure password reset link.'
                : 'Your next good moment could be just around the corner.'}
          </p>
          {!auth && (
            <div className="info">
              Setup required: add your Firebase web configuration to .env to enable sign-in.
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={submit}>
            {mode === 'register' && (
              <label>
                Your name
                <input
                  name="name"
                  required
                  maxLength={80}
                  autoComplete="name"
                  placeholder="Alex Taylor"
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            {mode !== 'reset' && (
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  placeholder="At least 8 characters"
                />
              </label>
            )}
            {mode === 'login' && (
              <Link className="forgot" to="/forgot-password">
                Forgot password?
              </Link>
            )}
            <button
              disabled={busy}
              className="button full"
              aria-describedby={mode === 'register' ? 'registration-policies' : undefined}
            >
              {busy
                ? 'Please wait…'
                : mode === 'register'
                  ? 'Create free account'
                  : mode === 'reset'
                    ? 'Send reset link'
                    : 'Log in'}
              <ArrowRight size={17} />
            </button>
          </form>
          {mode !== 'reset' && (
            <>
              <div className="divider">
                <span>or continue with</span>
              </div>
              <button
                disabled={busy}
                onClick={google}
                className="button outline full"
                aria-describedby={mode === 'register' ? 'registration-policies' : undefined}
              >
                <Globe2 size={18} />
                Google
              </button>
            </>
          )}
          <p className="auth-bottom">
            {mode === 'register' ? 'Already have an account?' : 'New to RateWatch?'}{' '}
            <Link
              to={
                (mode === 'register' ? '/login' : '/register') +
                (next ? '?next=' + encodeURIComponent(next) : '')
              }
            >
              {mode === 'register' ? 'Log in' : 'Join for free'}
            </Link>
          </p>
          {mode === 'register' && (
            <small id="registration-policies" className="muted">
              By creating an account, you agree to the <Link to="/terms">Terms of Service</Link>.
              Read the <Link to="/privacy">Privacy Policy</Link> to learn how RateWatch uses your
              information.
            </small>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
export function Profile() {
  const { user } = useContext(Session),
    toast = useContext(Toast),
    navigate = useNavigate(),
    [name, setName] = useState(user?.displayName || ''),
    [email, setEmail] = useState(true),
    [digestFrequency, setDigestFrequency] = useState<'off' | 'weekly' | 'monthly'>('off'),
    [digestPair, setDigestPair] = useState('NZD/INR'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api<{
      name: string;
      notificationPreferences?: { email: boolean };
      digestFrequency?: 'off' | 'weekly' | 'monthly';
      digestPair?: string;
    }>('/profile')
      .then((p) => {
        setName(p.name || user?.displayName || '');
        setEmail(p.notificationPreferences?.email !== false);
        setDigestFrequency(p.digestFrequency || 'off');
        setDigestPair(p.digestPair || 'NZD/INR');
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, [user]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name, email, digestFrequency, digestPair }),
      });
      await user?.reload();
      toast('Preferences saved.');
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h1>Your account.</h1>
          <p>A few details to make RateWatch yours.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="card editor">
          <h2>Profile & preferences</h2>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={save}>
            <label>
              Name
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Email address
              <input value={user?.email || ''} disabled />
              <small>
                {user?.emailVerified ? 'Verified email address' : 'Email verification required'}
              </small>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
              Email rate notifications
            </label>
            <p className="muted">Turning this off pauses new email triggers.</p>
            <label>
              Currency summaries
              <select
                value={digestFrequency}
                onChange={(event) =>
                  setDigestFrequency(event.target.value as typeof digestFrequency)
                }
              >
                <option value="off">Off</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            {digestFrequency !== 'off' && (
              <label>
                Summary currency pair
                <input
                  maxLength={7}
                  required
                  pattern="[A-Z]{3}/[A-Z]{3}"
                  value={digestPair}
                  onChange={(event) => setDigestPair(event.target.value.toUpperCase())}
                />
              </label>
            )}
            <button className="button" disabled={busy || !loaded}>
              Save changes <Check size={16} />
            </button>
          </form>
        </section>
        <section className="card editor">
          <h2>Account security</h2>
          <p className="muted">Request a secure email link to set a new password.</p>
          <button
            className="button outline"
            onClick={async () => {
              try {
                if (auth && user?.email) await sendPasswordResetEmail(auth, user.email);
                toast('Password reset email requested.');
              } catch (e) {
                toast(friendly(e));
              }
            }}
          >
            Reset password <Mail size={16} />
          </button>
          <hr />
          <h3 className="danger-text">Delete account</h3>
          <p className="muted">
            Permanently delete your account, alerts, and notification history. Sign in again first
            if your session is older than five minutes.
          </p>
          <button
            className="button danger"
            disabled={busy}
            onClick={async () => {
              if (
                !window.confirm(
                  'Permanently delete your account and all associated data? This cannot be undone.',
                )
              )
                return;
              setBusy(true);
              try {
                await api('/account', { method: 'DELETE' });
                if (auth) await signOut(auth);
                navigate('/');
                toast('Account and associated data deleted.');
              } catch (e) {
                setError(friendly(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 size={16} />
            Delete my account
          </button>
        </section>
      </div>
      {user && <PushSettings key={user.uid} uid={user.uid} />}
      <InstallAction />
    </Shell>
  );
}
export function Legal({ kind }: { kind: 'privacy' | 'terms' | 'disclaimer' }) {
  const titles = {
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    disclaimer: 'Financial information disclaimer',
  };
  return (
    <>
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="legal section">
        <h1>{titles[kind]}</h1>
        {kind !== 'disclaimer' && (
          <p>
            Jobanpreet Singh operates <a href="https://currencyindicators.vercel.app/">RateWatch</a>{' '}
            as an individual based in New Zealand.
          </p>
        )}
        {kind === 'privacy' ? (
          <>
            <h2>Information we use</h2>
            <p>
              RateWatch stores your account identifier, name, email address and verification status.
              If you create alerts or save transfer plans, RateWatch stores the currency pairs,
              targets, planned amounts, any linked alerts, and alert and notification history.
              RateWatch also stores your notification preferences and a registration token for each
              device you enable for push.
            </p>
            <h2>Purpose and sharing</h2>
            <p>
              We use this information to operate your account, save your plans, monitor your
              targets, send notifications you request, and investigate delivery and service
              failures. Vercel hosts the site and API, and a Cloudflare Worker calls the monitoring
              endpoint. Firebase Authentication handles sign-in, including optional Google sign-in.
              Cloud Firestore stores application records, and Firebase Cloud Messaging delivers push
              where enabled. RateWatch uses the configured email provider for alerts and summaries.
              The application supports Brevo, Gmail and Resend. Frankfurter supplies daily reference
              rates, and exchangerate.dev supplies delayed observations where enabled.
            </p>
            <p>
              RateWatch does not execute transfers or collect payment details. If you follow a link
              to a transfer provider, its terms and privacy policy apply on its site.
            </p>
            <h2>Browser storage</h2>
            <p>
              RateWatch uses browser storage to keep you signed in, remember your favourite pairs,
              and first-alert guide preferences, and record push preferences on this device. The
              service worker stores an offline fallback page. Google sign-in may use browser storage
              as part of the sign-in flow.
            </p>
            <p>
              RateWatch currently serves no ads and sets no advertising cookies. If advertising is
              introduced, RateWatch will update this policy and keep optional advertising storage
              disabled until an appropriate consent mechanism is in place.
            </p>
            <h2>Notification controls and deletion</h2>
            <p>
              You can change email settings, turn off summaries in Settings or through each
              summary’s unsubscribe link, and disable push on each registered device. You can delete
              alerts and saved plans individually.
            </p>
            <p>
              Account deletion in Settings requires a recent sign-in. It removes your RateWatch
              profile, sign-in account, alerts, saved plans, notification records and device
              registrations. Emails already delivered remain in recipients’ inboxes. Application
              deletion does not remove provider logs or backups directly.
            </p>
          </>
        ) : kind === 'terms' ? (
          <>
            <h2>Using RateWatch</h2>
            <p>
              Use this service lawfully, keep credentials secure, and use an email you control. The
              free plan allows three active alerts. Do not abuse the API or access another user’s
              information.
            </p>
            <h2>Availability and notifications</h2>
            <p>
              Alerts compare your target with observations from the selected source. A rate between
              observations may pass your target without triggering an alert. Provider outages,
              source update schedules, delivery failures, spam filtering and device permissions can
              delay or prevent notifications. An email provider’s acceptance does not establish
              inbox delivery.
            </p>
            <h2>External transfer providers</h2>
            <p>
              Links to Wise, Remitly and other transfer providers are direct links without referral
              tracking or commission. Each provider sets its own rates, fees, eligibility and terms.
            </p>
            <h2>Service scope</h2>
            <p>
              RateWatch supplies reference information and estimates before any fees or spreads
              charged by your transfer provider. Confirm its final quote, fees and delivery terms
              before sending money. RateWatch does not hold funds, execute transfers or provide
              financial advice.
            </p>
            <h2>Closing your account</h2>
            <p>
              You can stop using RateWatch, delete saved plans and alerts individually, or delete
              your account from Settings. The <Link to="/privacy">Privacy Policy</Link> describes
              what account deletion removes.
            </p>
          </>
        ) : (
          <>
            <h2>Reference information only</h2>
            <p>
              Frankfurter publishes daily reference rates. When available, exchangerate.dev provides
              delayed intraday observations. RateWatch shows when the underlying rate was observed.
              The rates are indicative and may differ from bank or remittance quotes.
            </p>
            <h2>Make your own comparison</h2>
            <p>
              Conversion amounts depend on provider spreads, fees, timing, and eligibility.
              RateWatch does not hold money or process transfers. Verify the final quote with your
              provider before acting.
            </p>
            <h2>No financial advice</h2>
            <p>
              Alerts are informational, not financial, investment, tax, or legal advice. No outcome
              or savings are guaranteed.
            </p>
          </>
        )}
        {kind !== 'disclaimer' && (
          <section aria-labelledby="policy-contact">
            <h2 id="policy-contact">Contact</h2>
            <p>
              {kind === 'privacy'
                ? 'For privacy questions or requests about your information, contact '
                : 'For questions about these terms or using RateWatch, contact '}
              Jobanpreet Singh at <a href="mailto:joban978jk@gmail.com">joban978jk@gmail.com</a>.
            </p>
          </section>
        )}
        <Link className="button outline" to="/">
          Back to RateWatch <ArrowRight size={17} />
        </Link>
      </main>
      <Footer />
    </>
  );
}
