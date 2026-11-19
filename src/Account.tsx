import { useContext, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
            <button disabled={busy} className="button full">
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
              <button disabled={busy} onClick={google} className="button outline full">
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
          <small className="muted">
            By continuing, you accept our <Link to="/legal/terms">draft terms</Link> and{' '}
            <Link to="/legal/privacy">privacy policy</Link>.
          </small>
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
export function Legal() {
  const { kind } = useParams(),
    titles: Record<string, string> = {
      privacy: 'Privacy policy',
      terms: 'Terms of service',
      disclaimer: 'Financial information disclaimer',
    };
  return (
    <>
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="legal section">
        <span className="eyebrow">TRANSPARENCY MATTERS</span>
        <h1>{titles[kind || ''] || 'Legal information'}</h1>
        {kind !== 'disclaimer' && (
          <div className="info">
            <strong>DRAFT — for review before public launch.</strong>
            <p>
              Not legally reviewed. The operator must add their legal identity, contact details,
              jurisdiction, retention periods, and applicable user rights.
            </p>
          </div>
        )}
        {kind === 'privacy' ? (
          <>
            <h2>Information we use</h2>
            <p>
              RateWatch stores your account identifier, name, email address, verification state,
              alert preferences, currency targets, and notification records. If you enable push,
              RateWatch stores a device registration token. Firebase handles authentication and push
              delivery. Cloud Firestore stores application data. Depending on configuration, Brevo,
              Gmail or Resend delivers email. Frankfurter supplies daily reference rates and
              exchangerate.dev supplies delayed intraday observations.
            </p>
            <h2>Purpose and sharing</h2>
            <p>
              We use this data to operate your account, monitor targets, send requested
              notifications, and investigate service failures. Service providers process data for
              these functions. We do not execute transfers or collect payment information.
            </p>
            <h2>Browser storage</h2>
            <p>
              RateWatch uses browser storage to keep you signed in, remember your favourite pairs,
              and record push preferences on this device. The service worker stores an offline
              fallback page. Optional summaries can be turned off in Settings or from the
              unsubscribe link in each summary.
            </p>
            <h2>Retention and deletion</h2>
            <p>
              Delete your account and application records in Settings. Sent emails and provider
              security logs may remain subject to provider retention policies. Before launch, the
              operator must document backup deletion, cross-border processing, a support contact,
              and legal rights for markets served.
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
              Provider outages, source update schedules, email failures, and spam filtering can
              delay or prevent alerts. Email provider acceptance does not establish inbox delivery.
              Availability and timing are not guaranteed.
            </p>
            <h2>External transfer providers</h2>
            <p>
              Links to Wise, Remitly and other transfer providers are direct links without referral
              tracking or commission. Each provider sets its own rates, fees, eligibility and terms.
            </p>
            <h2>Service scope</h2>
            <p>
              RateWatch supplies reference information, not transfers or financial advice. Payments
              and WhatsApp are not enabled. Future paid services require separate terms. Liability,
              governing law, dispute procedures, operator identity, and consumer protections require
              legal review before launch.
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
        <Link className="button outline" to="/">
          Back to RateWatch <ArrowRight size={17} />
        </Link>
      </main>
      <Footer />
    </>
  );
}
