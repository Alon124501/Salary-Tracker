import { useNavigate, useLocation } from 'react-router-dom';
import { clearCache } from '../hooks/useFetch.js';

const items = [
  { path: '/', icon: 'home', label: 'Home' },
  { path: '/stats', icon: 'insights', label: 'Stats' },
  { path: '/entry', icon: 'add_circle', label: 'Entry' },
  { path: '/screening-locations', icon: 'business', label: 'סקר' },
  { path: '/portal', icon: 'hub', label: 'Portal' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  function logout() {
    clearCache();
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login';
  }

  return (
    <nav className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-2 py-2 bg-white/95 backdrop-blur-2xl rounded-3xl border border-white/80"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}>
      {items.map(item => {
        const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center px-4 py-2 rounded-2xl transition-all duration-200 active:scale-95 ${
              active
                ? 'brand-gradient text-white scale-[1.02]'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
            style={active ? { boxShadow: '0 4px 14px rgba(139,53,217,0.35)' } : {}}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
            >{item.icon}</span>
            <span className="text-[10px] font-semibold tracking-wide mt-0.5">
              {item.label}
            </span>
          </button>
        );
      })}

    </nav>
  );
}
