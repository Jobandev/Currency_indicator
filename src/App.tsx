import { lazy, Suspense, useEffect, useState, useContext, type ReactNode } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Bell, X } from 'lucide-react';
import { auth } from './firebase';
import { Session, Toast } from './ui';
import Landing from './Landing';
const Dashboard = lazy(() => import('./Dashboard'));
import { AuthPage, Profile, Legal } from './Account';
import AlertEditor from './AlertEditor';
function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useContext(Session);
  return loading ? (
    <div className="page-loading" role="status">
      Loading your account…
    </div>
  ) : user ? (
    children
  ) : (
    <Navigate to="/login" replace />
  );
}
export default function App() {
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
        <Routes>
          <Route path="/" element={<Landing />} />
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
              <main className="page-loading">
                <h1>Page not found</h1>
                <Link to="/">Back home</Link>
              </main>
            }
          />
        </Routes>
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
