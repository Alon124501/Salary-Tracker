import { useNavigate, useLocation } from 'react-router-dom';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { path: '/', icon: 'home', label: 'Dashboard' },
    { path: '/entry', icon: 'add_circle', label: 'Entry' },
    { path: '/stats', icon: 'insights', label: 'Stats' },
  ];

  return (
    <nav className="lg:hidden fixed bottom-6 left-0 right-0 z-50 flex justify-around items-center px-4 py-3 mx-auto max-w-md bg-white/80 backdrop-blur-xl w-[90%] rounded-2xl border border-white/20 shadow-[0px_20px_40px_rgba(26,28,29,0.06)]">
      {items.map(item => {
        const active = location.pathname === item.path || (item.path === '/' && location.pathname === '/');
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center px-4 py-1 rounded-xl transition-all duration-200 active:scale-90 ${active ? 'text-brand-purple scale-110' : 'text-slate-400 hover:bg-purple-50/50'}`}
          >
            <span
              className="material-symbols-outlined"
              style={active ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {item.icon}
            </span>
            <span className="text-[10px] font-medium tracking-wider uppercase mt-1 font-body">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
