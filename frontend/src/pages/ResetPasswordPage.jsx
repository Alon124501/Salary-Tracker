import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api.js';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const inputBase = "w-full px-5 py-4 bg-cupertino-grey border-none rounded-cupertino focus:ring-1 focus:ring-action-blue transition-all font-medium text-on-surface placeholder:text-cupertino-label/60";

  if (!token) {
    return (
      <div className="bg-background font-body text-on-surface antialiased flex flex-col items-center justify-center p-6 min-h-dvh text-center">
        <span className="material-symbols-outlined text-5xl text-red-400 mb-4">link_off</span>
        <h1 className="font-headline font-bold text-xl mb-2">קישור לא תקין</h1>
        <p className="text-cupertino-label text-sm mb-6">לקישור זה חסר אסימון. אנא בקש איפוס סיסמה חדש.</p>
        <button
          onClick={() => navigate('/login')}
          className="brand-gradient text-white font-semibold px-8 py-4 rounded-cupertino brand-shadow active:scale-[0.98] transition-all duration-200"
        >
          חזרה להתחברות
        </button>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="bg-background font-body text-on-surface antialiased flex flex-col items-center justify-center p-6 min-h-dvh text-center">
        <span className="material-symbols-outlined text-5xl text-action-blue mb-4">check_circle</span>
        <h1 className="font-headline font-bold text-xl mb-2">הסיסמה עודכנה!</h1>
        <p className="text-cupertino-label text-sm mb-6">כעת תוכל להתחבר עם הסיסמה החדשה שלך.</p>
        <button
          onClick={() => navigate('/login')}
          className="brand-gradient text-white font-semibold px-8 py-4 rounded-cupertino brand-shadow active:scale-[0.98] transition-all duration-200"
        >
          חזרה להתחברות
        </button>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError('הסיסמאות אינן תואמות');
      return;
    }
    if (newPassword.length < 6) {
      setError('הסיסמה חייבת לכלול לפחות 6 תווים');
      return;
    }
    setStatus('loading');
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setStatus('done');
    } catch (err) {
      setError(err.response?.data?.error || 'משהו השתבש');
      setStatus('');
    }
  }

  return (
    <div className="bg-background font-body text-on-surface antialiased flex flex-col items-center justify-center p-6 min-h-dvh">
      <div className="w-full max-w-[400px] flex flex-col items-center">
        <header className="mb-10 text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/logo.png" alt="Medical Pay" className="w-20 h-20 object-contain" />
          </div>
          <h1 className="font-headline font-extrabold text-3xl tracking-tight text-black">
            Medical <span className="brand-gradient-text">Pay</span>
          </h1>
          <p className="mt-3 font-semibold text-lg">הגדרת סיסמה חדשה</p>
          <p className="mt-1 text-cupertino-label text-sm">הזן סיסמה חדשה עבור החשבון שלך.</p>
        </header>

        <form className="w-full space-y-4" onSubmit={handleSubmit}>
          <div className="relative">
            <input
              className={inputBase + ' pl-14'}
              placeholder="סיסמה חדשה"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowNew(v => !v)}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-cupertino-label hover:text-on-surface transition-colors outline-none"
            >
              <span className="material-symbols-outlined text-xl">
                {showNew ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>

          <div className="relative">
            <input
              className={inputBase + ' pl-14'}
              placeholder="אימות סיסמה"
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-cupertino-label hover:text-on-surface transition-colors outline-none"
            >
              <span className="material-symbols-outlined text-xl">
                {showConfirm ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>

          {error && (
            <p className="text-red-500 text-sm font-medium text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full brand-gradient text-white font-semibold py-4 rounded-cupertino brand-shadow active:scale-[0.98] transition-all duration-200 text-lg mt-2 disabled:opacity-50"
          >
            {status === 'loading' ? 'מעדכן...' : 'עדכן סיסמה'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-6 text-sm text-cupertino-label hover:text-on-surface transition-colors"
        >
          חזרה להתחברות
        </button>
      </div>

      <div className="fixed top-0 left-0 w-full h-[60vh] bg-gradient-to-b from-action-blue/5 to-transparent -z-10 pointer-events-none"></div>
    </div>
  );
}
