import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api.js';

const navItems = [
  { path: '/', icon: 'home', label: 'Home' },
  { path: '/stats', icon: 'insights', label: 'Stats' },
  { path: '/entry', icon: 'add_circle', label: 'Entry' },
  { path: '/screening-locations', icon: 'business', label: 'סקר' },
  { path: '/faq', icon: 'quiz', label: 'FAQ' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => {
      const first = data.first_name || '';
      const last = data.last_name || '';
      setDisplayName(first || last ? `${first} ${last}`.trim() : data.username || '');
    }).catch(() => {
      setDisplayName(localStorage.getItem('username') || '');
    });
  }, []);

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login';
  }

  return (
    <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-2xl border-b border-slate-100/80"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <div className="flex items-center px-4 sm:px-6 py-2">

        {/* Left: Logo + MPCHECK */}
        <div className="flex items-center gap-2.5 cursor-pointer flex-shrink-0" onClick={() => navigate('/')}>
          <img src="/logo.png" alt="MPCHECK" className="w-9 h-9 rounded-xl object-contain" />
          <span className="text-base font-extrabold tracking-tight font-headline brand-gradient-text">MPCHECK</span>
        </div>

        {/* Center: nav items — desktop only */}
        <div className="hidden lg:flex flex-1 items-center justify-center gap-2">
          {navItems.map(item => {
            const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center px-5 py-2 rounded-2xl transition-all duration-200 active:scale-95 ${
                  active
                    ? 'brand-gradient text-white scale-[1.02]'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
                style={active ? { boxShadow: '0 4px 14px rgba(139,53,217,0.35)' } : {}}
              >
                <span
                  className="material-symbols-outlined text-[26px]"
                  style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                >{item.icon}</span>
                <span className="text-[10px] font-bold tracking-wide mt-0.5">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: greeting + settings + logout */}
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          {displayName && (
            <span className="text-sm font-semibold text-slate-600 hidden sm:block">
              Hi, <span className="brand-gradient-text">{displayName}</span>
            </span>
          )}
          <button
            onClick={() => navigate('/settings')}
            className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 active:scale-95 ${
              location.pathname === '/settings'
                ? 'brand-gradient text-white'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
            title="Settings"
            style={location.pathname === '/settings' ? { boxShadow: '0 4px 14px rgba(139,53,217,0.35)' } : {}}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: location.pathname === '/settings' ? "'FILL' 1" : "'FILL' 0" }}
            >manage_accounts</span>
          </button>
          <button
            onClick={logout}
            className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 active:scale-95"
            title="Log out"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
