import { useNavigate, useLocation } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const username = localStorage.getItem('username') || '?';

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login';
  }

  const navItems = [
    { path: '/', label: 'Dashboard', icon: 'dashboard' },
    { path: '/entry', label: 'New Entry', icon: 'edit_note' },
    { path: '/stats', label: 'Stats', icon: 'insights' },
  ];

  const navLink = (path, label, icon) => (
    <button
      onClick={() => navigate(path)}
      className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-all ${
        location.pathname === path
          ? 'brand-gradient-text bg-purple-50'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
      }`}
    >
      <span className="material-symbols-outlined text-base" style={location.pathname === path ? {} : {}}>{icon}</span>
      {label}
    </button>
  );

  return (
    <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-[0px_20px_40px_rgba(26,28,29,0.04)]">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 w-full max-w-6xl mx-auto">

        {/* Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl brand-gradient flex items-center justify-center brand-shadow flex-shrink-0">
            <span className="text-white font-extrabold text-xs sm:text-sm font-headline">MP</span>
          </div>
          <span className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tighter font-headline">
            Medical <span className="brand-gradient-text">Pay</span>
          </span>
        </div>

        {/* Desktop nav links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map(({ path, label, icon }) => navLink(path, label, icon))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-slate-500 font-medium">Hi, {username}</span>
          <button
            onClick={logout}
            className="hidden lg:flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Logout
          </button>
          <div
            className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white text-sm font-bold cursor-pointer active:scale-95 transition-transform brand-shadow lg:hidden"
            onClick={logout}
            title="Tap to logout"
          >
            {username.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
      <div className="bg-slate-100/50 h-px w-full" />
    </header>
  );
}
