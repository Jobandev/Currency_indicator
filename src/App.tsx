import { lazy, Suspense, useEffect, useState, useContext, type ReactNode } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Bell, X } from 'lucide-react';
import { auth } from './firebase';
import { Session, Toast } from './ui';
import { publicPage } from '../shared/public-pages';
import Landing from './Landing';
const Unsubscribe = lazy(() => import('./Unsubscribe'));
const CurrencyPair = lazy(() => import('./CurrencyPair'));
const Planner = lazy(() => import('./Planner'));
const Charts = lazy(() => import('./Charts'));
const Dashboard = lazy(() => import('./Dashboard'));
const Account = () => import('./Account');
const AuthPage = lazy(() => Account().then((module) => ({ default: module.AuthPage })));
const Profile = lazy(() => Account().then((module) => ({ default: module.Profile })));
const Legal = lazy(() => Account().then((module) => ({ default: module.Legal })));
const AlertEditor = lazy(() => import('./AlertEditor'));
function Protected({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, loading } = useContext(Session);
  return loading ? (
    <div className="page-loading" role="status">
      Loading your account…
    </div>
  ) : user ? (
    children
  ) : (
    <Navigate
      to={'/login?next=' + encodeURIComponent(location.pathname + location.search)}
      replace
    />
  );
}
export default function App() {
  const location = useLocation();
  useEffect(() => {
    const page = publicPage(location.pathname.replace(/\/$/, '') || '/');
    document.title = page ? page[0] + ' | RateWatch' : 'RateWatch';
  }, [location.pathname]);
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [toast, setToast] = useState('');
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <Session.Provider value={{ user, loading }}>
      <Toast.Provider value={setToast}>
        <a
          className="skip-link"
          href="#main-content"
          onClick={(event) => {
            const main = document.getElementById('main-content');
            if (!main) return;
            event.preventDefault();
            main.focus();
            main.scrollIntoView();
          }}
        >
          Skip to main content
        </a>
        <Suspense
          fallback={
            <div className="page-loading" role="status">
              Loading RateWatch…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/rates/:pair" element={<CurrencyPair />} />
            <Route
              path="/charts"
              element={
                <Suspense fallback={<p role="status">Loading charts?</p>}>
                  <Charts />
                </Suspense>
              }
            />
            <Route
              path="/planner"
              element={
                <Suspense fallback={<p role="status">Loading planner?</p>}>
                  <Planner />
                </Suspense>
              }
            />
            <Route
              path="/unsubscribe"
              element={
                <Suspense fallback={<p>Loading?</p>}>
                  <Unsubscribe />
                </Suspense>
              }
            />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/forgot-password" element={<AuthPage mode="reset" />} />
            <Route path="/legal/:kind" element={<Legal />} />
            <Route
              path="/dashboard"
              element={
                <Protected>
                  <Suspense fallback={<div className="page-loading">Loading dashboard…</div>}>
                    <Dashboard />
                  </Suspense>
                </Protected>
              }
            />
            <Route
              path="/alerts/new"
              element={
                <Protected>
                  <AlertEditor />
                </Protected>
              }
            />
            <Route
              path="/alerts/:id/edit"
              element={
                <Protected>
                  <AlertEditor />
                </Protected>
              }
            />
            <Route
              path="/settings"
              element={
                <Protected>
                  <Profile />
                </Protected>
              }
            />
            <Route
              path="*"
              element={
                <main id="main-content" tabIndex={-1} className="page-loading">
                  <h1>Page not found</h1>
                  <Link to="/">Back home</Link>
                </main>
              }
            />
          </Routes>
        </Suspense>
        {toast && (
          <div className="toast" role="status">
            <Bell size={17} />
            {toast}
            <button aria-label="Dismiss notification" onClick={() => setToast('')}>
              <X size={16} />
            </button>
          </div>
        )}
      </Toast.Provider>
    </Session.Provider>
  );
}
