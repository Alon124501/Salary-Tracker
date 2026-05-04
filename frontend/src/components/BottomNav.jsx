import { useNavigate, useLocation } from 'react-router-dom';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { path: '/', icon: 'home', label: 'Dashboard' },
    { path: '/entry', icon: 'add_circle', label: 'Entry' },
    { path: '/stats', icon: 'insights', label: 'Stats' },
    { path: '/settings', icon: 'manage_accounts', label: 'Settings' },
  ];

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login';
  }

  return (
    <nav className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-3 py-2.5 bg-white/90 backdrop-blur-xl rounded-2xl shadow-float border border-slate-100/80">
      {items.map(item => {
        const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center min-w-[60px] px-3 py-1.5 rounded-xl transition-all duration-200 active:scale-90 ${
              active
                ? 'text-brand-purple bg-purple-50'
                : 'text-slate-400'
            }`}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={active ? { fontVariationSettings: "'FILL' 1" } : {}}
            >{item.icon}</span>
            <span className={`text-[9px] font-bold tracking-wide uppercase mt-0.5 ${active ? 'text-brand-purple' : 'text-slate-400'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
      <div className="w-px h-6 bg-slate-100 mx-1" />
      <button
        onClick={logout}
        className="flex flex-col items-center justify-center min-w-[48px] px-3 py-1.5 rounded-xl transition-all duration-200 active:scale-90 text-slate-400 hover:text-red-500 hover:bg-red-50"
      >
        <span className="material-symbols-outlined text-[22px]">logout</span>
        <span className="text-[9px] font-bold tracking-wide uppercase mt-0.5">Out</span>
      </button>
    </nav>
  );
}
