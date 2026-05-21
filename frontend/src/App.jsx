import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import EntryPage from './pages/EntryPage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import EditProfilePage from './pages/EditProfilePage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import ScreeningLocationsPage from './pages/ScreeningLocationsPage.jsx';
import FAQPage from './pages/FAQPage.jsx';
import Navbar from './components/Navbar.jsx';
import BottomNav from './components/BottomNav.jsx';

function PrivateRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />;
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
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<PrivateRoute><AppLayout><Dashboard /></AppLayout></PrivateRoute>} />
        <Route path="/entry/:date?" element={<PrivateRoute><AppLayout><EntryPage /></AppLayout></PrivateRoute>} />
        <Route path="/stats" element={<PrivateRoute><AppLayout><StatsPage /></AppLayout></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><AppLayout><SettingsPage /></AppLayout></PrivateRoute>} />
        <Route path="/edit-profile" element={<PrivateRoute><AppLayout><EditProfilePage /></AppLayout></PrivateRoute>} />
        <Route path="/screening-locations" element={<PrivateRoute><AppLayout><ScreeningLocationsPage /></AppLayout></PrivateRoute>} />
        <Route path="/faq" element={<PrivateRoute><AppLayout><FAQPage /></AppLayout></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
