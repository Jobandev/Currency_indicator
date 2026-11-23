import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { signOut, sendEmailVerification, type User } from 'firebase/auth';
import {
  ArrowUpRight,
  Bell,
  ChartNoAxesCombined,
  CheckCheck,
  CircleHelp,
  House,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { auth } from './firebase';
import { api } from './api';
import PublicNavigation, { RateWatchMark } from './PublicNavigation';
import { fresh, type Rate } from '../shared/domain';
export const Session = createContext<{ user: User | null; loading: boolean }>({
  user: null,
  loading: true,
});
export const Toast = createContext<(m: string) => void>(() => {});
export const format = (n: number, d = 4) =>
  n.toLocaleString('en-NZ', { maximumFractionDigits: d, minimumFractionDigits: 2 });
export function Brand() {
  return (
    <Link className="brand" to="/">
      <RateWatchMark />
      RateWatch
    </Link>
  );
}
export function Currency({ pair }: { pair: string }) {
  const [base, quote] = pair.split('/');
  return (
    <span className="currency">
      <span>
        <strong>
          {base} <span className="muted">/</span> {quote}
        </strong>
        <small>
          {new Intl.DisplayNames(['en'], { type: 'currency' }).of(base) || base} to {quote}
        </small>
      </span>
    </span>
  );
}
export function useRates() {
  const [rates, set] = useState<Rate[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    setError('');
    api<Rate[]>('/rates')
      .then(set)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  return { rates, error, loading, load };
}
export function PublicHeader() {
  const { user } = useContext(Session);
  return <PublicNavigation signedIn={Boolean(user)} />;
}
export function Footer() {
  return (
    <footer>
      <Brand />
      <span>Good timing. Better possibilities.</span>
      <div>
        <Link to="/rates/nzd-inr">Currency pairs</Link>
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms of Service</Link>
        <Link to="/legal/disclaimer">Disclaimer</Link>
      </div>
      <small>© {new Date().getFullYear()} RateWatch. Reference rates only.</small>
    </footer>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const { user } = useContext(Session),
    [open, setOpen] = useState(false),
    navigate = useNavigate();
  return (
    <div className="app-shell">
      <aside className={'sidebar ' + (open ? 'is-open' : '')}>
        <Brand />
        <span className="nav-label">YOUR WORKSPACE</span>
        <nav>
          <NavLink to="/dashboard" onClick={() => setOpen(false)}>
            <LayoutDashboard size={19} />
            Overview
          </NavLink>
          <NavLink to="/alerts/new" onClick={() => setOpen(false)}>
            <Bell size={19} />
            Create an alert
          </NavLink>
          <NavLink to="/settings" onClick={() => setOpen(false)}>
            <Settings size={19} />
            Settings
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="free-plan">
            <Sparkles size={18} />
            <strong>A little peace of mind.</strong>
            <p>Three alerts. Always free.</p>
            <span className="pill">FREE PLAN</span>
          </div>
          <Link className="help" to="/legal/disclaimer">
            <CircleHelp size={17} />
            About our rates <ArrowUpRight size={14} />
          </Link>
          <button
            className="user-menu"
            onClick={async () => {
              if (auth) await signOut(auth);
              navigate('/');
            }}
          >
            <span className="avatar">
              {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
            </span>
            <span>
              <strong>{user?.displayName || 'Your account'}</strong>
              <small>Log out</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="app-header">
          <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Toggle menu">
            <Menu />
          </button>
          <div className="breadcrumb">
            Your workspace <span>/</span> <strong>Overview</strong>
          </div>
          <div className="header-right">
            <span className="header-status">
              <span className="green-dot" /> Market rates
            </span>
            <Link aria-label="Notification history" to="/dashboard#notifications">
              <Bell size={19} />
            </Link>
            <span className="avatar">
              {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
            </span>
          </div>
        </header>
        <nav className="mobile-bottom-nav" aria-label="Workspace navigation">
          <NavLink to="/" end>
            <House size={18} aria-hidden="true" />
            Home
          </NavLink>
          <NavLink to="/dashboard" end>
            <LayoutDashboard size={18} aria-hidden="true" />
            Overview
          </NavLink>
          <NavLink to="/charts" end>
            <ChartNoAxesCombined size={18} aria-hidden="true" />
            Chart
          </NavLink>
          <NavLink to="/alerts/new" end>
            <Bell size={18} aria-hidden="true" />
            Alert
          </NavLink>
          <NavLink to="/settings">
            <Settings size={18} aria-hidden="true" />
            Settings
          </NavLink>
        </nav>
        <main id="main-content" tabIndex={-1} className="workspace-main">
          {children}
        </main>
        <div className="app-footer">
          <nav aria-label="Policies">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </nav>
          <span>
            Reference rates only · <Link to="/legal/disclaimer">View disclaimer</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
export function Verification() {
  const { user } = useContext(Session),
    toast = useContext(Toast);
  if (user?.emailVerified) return null;
  return (
    <div className="verification">
      <Mail size={19} />
      <div>
        <strong>One quick step before we start watching.</strong>
        <span>Verify your email to create alerts.</span>
      </div>
      <button
        onClick={async () => {
          try {
            if (user) await sendEmailVerification(user);
            toast('Verification email sent.');
          } catch (e) {
            toast(friendly(e));
          }
        }}
      >
        Resend email
      </button>
      <button
        onClick={async () => {
          await user?.reload();
          await user?.getIdToken(true);
          window.location.reload();
        }}
      >
        I’ve verified
      </button>
    </div>
  );
}
export function friendly(e: unknown) {
  const m = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
  if (m.includes('invalid-credential')) return 'Email or password was incorrect.';
  if (m.includes('email-already-in-use'))
    return 'This email already has an account. Try logging in.';
  if (m.includes('popup-closed')) return 'Sign-in window closed. Try again.';
  if (m.includes('popup-blocked'))
    return 'Your browser blocked the Google sign-in window. You can continue in this tab.';
  if (m.includes('web-storage-unsupported'))
    return 'Google sign-in needs browser storage. Open RateWatch in a regular browser tab or sign in with email.';
  if (m.includes('too-many-requests')) return 'Too many attempts. Please wait and try again.';
  return m;
}
export function SecurityNote() {
  return (
    <div className="panel-footer">
      <ShieldCheck size={14} /> Monitoring runs on the server. Each alert uses the rate source you
      selected.
    </div>
  );
}
export function HeroNote() {
  return (
    <div className="hero-note">
      <span className="success-icon">
        <CheckCheck size={19} />
      </span>
      <div>
        <strong>Your rate. Your moment.</strong>
        <small>One email when your target is reached.</small>
      </div>
      <Sparkles size={18} />
    </div>
  );
}

export function displayRateLabel(rate: Rate) {
  return rate.kind === 'intraday'
    ? (fresh(rate) ? 'Market rate' : 'Last recorded market rate') + ' by Exchangerate.dev'
    : 'Daily reference rate by Frankfurter';
}
