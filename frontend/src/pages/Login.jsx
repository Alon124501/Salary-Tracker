import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';

const PROFESSIONS = ['Doctor', 'Nurse', 'Paramedic', 'Nursing Student', 'Doctor Student', 'Medic', 'Phlebotomist'];
const DISTRICTS = ['גוש דן', 'השפלה', 'השרון', 'צפון', 'באר שבע', 'ערבה'];

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profession, setProfession] = useState('');
  const [district, setDistrict] = useState('');
  const [professionDoc, setProfessionDoc] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (mode === 'register' && password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      let data;
      if (mode === 'register') {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        formData.append('first_name', firstName);
        formData.append('last_name', lastName);
        formData.append('profession', profession);
        formData.append('district', district);
        if (professionDoc) formData.append('profession_document', professionDoc);
        ({ data } = await api.post('/auth/register', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        }));
      } else {
        ({ data } = await api.post('/auth/login', { username, password }));
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.username);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(newMode) {
    setMode(newMode);
    setError('');
    setConfirm('');
    setShowPassword(false);
    setShowConfirm(false);
    setFirstName('');
    setLastName('');
    setProfession('');
    setDistrict('');
    setProfessionDoc(null);
  }

  const inputBase = "w-full px-5 py-4 bg-cupertino-grey border-none rounded-cupertino focus:ring-1 focus:ring-action-blue transition-all font-medium text-on-surface placeholder:text-cupertino-label/60";
  const selectBase = inputBase + " appearance-none cursor-pointer";

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
              className={inputBase}
              placeholder="Username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
            />

            {/* First Name & Last Name — register only, above password */}
            {mode === 'register' && (
              <div className="grid grid-cols-2 gap-3">
                <input
                  className={inputBase}
                  placeholder="First Name"
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                />
                <input
                  className={inputBase}
                  placeholder="Last Name"
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Password field */}
            <div className="relative">
              <input
                className={inputBase + ' pr-14'}
                placeholder="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-cupertino-label hover:text-on-surface transition-colors outline-none"
              >
                <span className="material-symbols-outlined text-xl">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>

            {/* Register-only fields */}
            {mode === 'register' && (
              <>
                {/* Confirm password */}
                <div className="relative">
                  <input
                    className={inputBase + ' pr-14'}
                    placeholder="Confirm Password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-cupertino-label hover:text-on-surface transition-colors outline-none"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showConfirm ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>

                {/* Profession dropdown + upload icon */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <select
                      className={selectBase}
                      value={profession}
                      onChange={e => setProfession(e.target.value)}
                      required
                    >
                      <option value="">Select Profession</option>
                      {PROFESSIONS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-cupertino-label pointer-events-none text-xl">
                      expand_more
                    </span>
                  </div>

                  {/* Upload icon button */}
                  <label
                    className={`flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-cupertino cursor-pointer transition-all ${professionDoc ? 'bg-action-blue/10 text-action-blue' : 'bg-cupertino-grey text-cupertino-label hover:brightness-95'}`}
                    title={professionDoc ? professionDoc.name : 'Upload profession document'}
                  >
                    <span className="material-symbols-outlined text-2xl">upload_file</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={e => setProfessionDoc(e.target.files[0] || null)}
                    />
                  </label>
                </div>

                {/* District dropdown */}
                <div className="relative">
                  <select
                    className={selectBase + ' text-center'}
                    value={district}
                    onChange={e => setDistrict(e.target.value)}
                    required
                  >
                    <option value="">Select District</option>
                    {DISTRICTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-cupertino-label pointer-events-none text-xl">
                    expand_more
                  </span>
                </div>
              </>
            )}

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
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
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
