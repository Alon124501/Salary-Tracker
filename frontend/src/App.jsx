import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useOutlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ToastProvider } from './context/ToastContext.jsx';
import api from './api.js';
import DeviceRecapModal from './components/DeviceRecapModal.jsx';
import { registerAndSubscribe } from './push.js';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import EntryPage from './pages/EntryPage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import EditProfilePage from './pages/EditProfilePage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import ScreeningLocationsPage from './pages/ScreeningLocationsPage.jsx';
import PortalPage from './pages/PortalPage.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Navbar from './components/Navbar.jsx';
import BottomNav from './components/BottomNav.jsx';

function PrivateRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  if (!localStorage.getItem('token')) return <Navigate to="/login" replace />;
  // Full admin check happens server-side; the page itself won't load data if not admin (403)
  return children;
}

// Snapshots the matched route element once per keyed mount, so the *exiting*
// copy (still mounted during its AnimatePresence exit animation) keeps
// rendering the old page instead of re-resolving to whatever now matches —
// a plain <Outlet/> would show the new route in both the exiting and
// entering panel simultaneously (double-mounting the new page).
function AnimatedOutlet() {
  const outlet = useOutlet();
  const [element] = useState(outlet);
  return element;
}

function AppLayout() {
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => { registerAndSubscribe(); }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get('/auth/me'), api.get('/devices/mine')])
      .then(([meRes, mineRes]) => {
        if (cancelled) return;
        const clear = !!meRes.data.is_admin || (!!mineRes.data.everSubmitted && !!mineRes.data.submittedThisWeek);
        setBlocked(!clear);
      })
      .catch(() => {}) // fail open — don't lock employees out on a transient network error
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, []);

  if (checking) return null;

  if (blocked) {
    return (
      <DeviceRecapModal
        title="בחר את הציוד שלך"
        subtitle="אנא אשר אילו מכשירים ברשותך כעת כדי להמשיך."
        submitLabel="המשך"
        onSubmitted={() => setBlocked(false)}
      />
    );
  }

  return (
    <>
      <Navbar />
      <AnimatePresence initial={false}>
        <motion.div
          key={location.pathname}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: reducedMotion ? 0.1 : 0.18 }}
        >
          <AnimatedOutlet />
        </motion.div>
      </AnimatePresence>
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/entry/:date?" element={<EntryPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/edit-profile" element={<EditProfilePage />} />
          <Route path="/screening-locations" element={<ScreeningLocationsPage />} />
          <Route path="/portal" element={<PortalPage />} />
        </Route>
        <Route element={<AdminRoute><AppLayout /></AdminRoute>}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  );
}
