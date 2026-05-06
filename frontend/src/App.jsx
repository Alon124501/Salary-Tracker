import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import EntryPage from './pages/EntryPage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import Navbar from './components/Navbar.jsx';
import BottomNav from './components/BottomNav.jsx';

function PrivateRoute({ session, children }) {
  if (session === undefined) return null;
  return session ? children : <Navigate to="/login" replace />;
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
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute session={session}><AppLayout><Dashboard /></AppLayout></PrivateRoute>} />
        <Route path="/entry/:date?" element={<PrivateRoute session={session}><AppLayout><EntryPage /></AppLayout></PrivateRoute>} />
        <Route path="/stats" element={<PrivateRoute session={session}><AppLayout><StatsPage /></AppLayout></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute session={session}><AppLayout><SettingsPage /></AppLayout></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
