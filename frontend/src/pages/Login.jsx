import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../api.js';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-background font-body text-on-surface antialiased flex flex-col items-center justify-center p-6 min-h-dvh">
      <div className="w-full max-w-[400px] flex flex-col items-center">

        {/* Logo Header */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/logo.png" alt="Medical Pay" className="w-28 h-28 object-contain" />
          </div>
          <h1 className="font-headline font-extrabold text-3xl tracking-tight text-black">
            Medical <span className="brand-gradient-text">Pay</span>
          </h1>
          <p className="mt-2 text-cupertino-label font-medium text-sm">Track your medical salary with ease</p>
        </header>

        {/* Form */}
        <div className="w-full space-y-8">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <input
              className="w-full px-5 py-4 bg-cupertino-grey border-none rounded-cupertino focus:ring-1 focus:ring-action-blue transition-all font-medium text-on-surface placeholder:text-cupertino-label/60"
              placeholder="Username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
            />
            <input
              className="w-full px-5 py-4 bg-cupertino-grey border-none rounded-cupertino focus:ring-1 focus:ring-action-blue transition-all font-medium text-on-surface placeholder:text-cupertino-label/60"
              placeholder="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />

            {error && (
              <p className="text-red-500 text-sm font-medium text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full brand-gradient text-white font-semibold py-4 rounded-cupertino brand-shadow active:scale-[0.98] transition-all duration-200 text-lg mt-2 disabled:opacity-50"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-full h-px bg-outline-variant my-2"></div>
            <p className="text-cupertino-label text-sm">
              {mode === 'login' ? "New here?" : 'Already have an account?'}
              <span
                className="font-semibold brand-gradient-text ml-1 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              >
                {mode === 'login' ? 'Create Account' : 'Sign In'}
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-24 text-center">
          <div className="flex items-center justify-center gap-2 mb-4 opacity-30">
            <span className="material-symbols-outlined text-sm">lock</span>
            <span className="text-[10px] font-bold tracking-widest uppercase">End-to-End Encrypted</span>
          </div>
          <p className="text-[10px] text-cupertino-label font-medium tracking-tight">© 2025 SalaryTracker</p>
        </footer>
      </div>

      {/* Background gradient */}
      <div className="fixed top-0 left-0 w-full h-[60vh] bg-gradient-to-b from-action-blue/5 to-transparent -z-10 pointer-events-none"></div>
    </div>
  );
}
