import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext.jsx';

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

function AppLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
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
        <Route path="/" element={<PrivateRoute><AppLayout><Dashboard /></AppLayout></PrivateRoute>} />
        <Route path="/entry/:date?" element={<PrivateRoute><AppLayout><EntryPage /></AppLayout></PrivateRoute>} />
        <Route path="/stats" element={<PrivateRoute><AppLayout><StatsPage /></AppLayout></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><AppLayout><SettingsPage /></AppLayout></PrivateRoute>} />
        <Route path="/edit-profile" element={<PrivateRoute><AppLayout><EditProfilePage /></AppLayout></PrivateRoute>} />
        <Route path="/screening-locations" element={<PrivateRoute><AppLayout><ScreeningLocationsPage /></AppLayout></PrivateRoute>} />
        <Route path="/portal" element={<PrivateRoute><AppLayout><PortalPage /></AppLayout></PrivateRoute>} />
        <Route path="/admin" element={<AdminRoute><AppLayout><AdminDashboard /></AppLayout></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  );
}
