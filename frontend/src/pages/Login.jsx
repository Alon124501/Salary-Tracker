import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';

const PROFESSIONS = ['Doctor', 'Nurse', 'Paramedic', 'Nursing Student', 'Doctor Student', 'Medic', 'Phlebotomist'];
const DISTRICTS = ['גוש דן', 'השפלה', 'השרון', 'צפון', 'באר שבע', 'ערבה'];

const COUNTRY_CODES = [
  { label: '🇮🇱 +972', value: '+972' },
  { label: '🇦🇫 +93',  value: '+93'  },
  { label: '🇦🇱 +355', value: '+355' },
  { label: '🇩🇿 +213', value: '+213' },
  { label: '🇦🇷 +54',  value: '+54'  },
  { label: '🇦🇲 +374', value: '+374' },
  { label: '🇦🇺 +61',  value: '+61'  },
  { label: '🇦🇹 +43',  value: '+43'  },
  { label: '🇦🇿 +994', value: '+994' },
  { label: '🇧🇭 +973', value: '+973' },
  { label: '🇧🇩 +880', value: '+880' },
  { label: '🇧🇪 +32',  value: '+32'  },
  { label: '🇧🇷 +55',  value: '+55'  },
  { label: '🇧🇬 +359', value: '+359' },
  { label: '🇨🇦 +1',   value: '+1'   },
  { label: '🇨🇳 +86',  value: '+86'  },
  { label: '🇨🇴 +57',  value: '+57'  },
  { label: '🇭🇷 +385', value: '+385' },
  { label: '🇨🇾 +357', value: '+357' },
  { label: '🇨🇿 +420', value: '+420' },
  { label: '🇩🇰 +45',  value: '+45'  },
  { label: '🇪🇬 +20',  value: '+20'  },
  { label: '🇫🇮 +358', value: '+358' },
  { label: '🇫🇷 +33',  value: '+33'  },
  { label: '🇩🇪 +49',  value: '+49'  },
  { label: '🇬🇷 +30',  value: '+30'  },
  { label: '🇭🇺 +36',  value: '+36'  },
  { label: '🇮🇳 +91',  value: '+91'  },
  { label: '🇮🇩 +62',  value: '+62'  },
  { label: '🇮🇷 +98',  value: '+98'  },
  { label: '🇮🇶 +964', value: '+964' },
  { label: '🇮🇪 +353', value: '+353' },
  { label: '🇮🇹 +39',  value: '+39'  },
  { label: '🇯🇵 +81',  value: '+81'  },
  { label: '🇯🇴 +962', value: '+962' },
  { label: '🇰🇿 +7',   value: '+7'   },
  { label: '🇰🇪 +254', value: '+254' },
  { label: '🇰🇷 +82',  value: '+82'  },
  { label: '🇰🇼 +965', value: '+965' },
  { label: '🇱🇧 +961', value: '+961' },
  { label: '🇱🇾 +218', value: '+218' },
  { label: '🇲🇾 +60',  value: '+60'  },
  { label: '🇲🇽 +52',  value: '+52'  },
  { label: '🇲🇦 +212', value: '+212' },
  { label: '🇳🇱 +31',  value: '+31'  },
  { label: '🇳🇿 +64',  value: '+64'  },
  { label: '🇳🇬 +234', value: '+234' },
  { label: '🇳🇴 +47',  value: '+47'  },
  { label: '🇴🇲 +968', value: '+968' },
  { label: '🇵🇰 +92',  value: '+92'  },
  { label: '🇵🇭 +63',  value: '+63'  },
  { label: '🇵🇱 +48',  value: '+48'  },
  { label: '🇵🇹 +351', value: '+351' },
  { label: '🇶🇦 +974', value: '+974' },
  { label: '🇷🇴 +40',  value: '+40'  },
  { label: '🇷🇺 +7',   value: '+7'   },
  { label: '🇸🇦 +966', value: '+966' },
  { label: '🇷🇸 +381', value: '+381' },
  { label: '🇸🇬 +65',  value: '+65'  },
  { label: '🇿🇦 +27',  value: '+27'  },
  { label: '🇪🇸 +34',  value: '+34'  },
  { label: '🇸🇩 +249', value: '+249' },
  { label: '🇸🇪 +46',  value: '+46'  },
  { label: '🇨🇭 +41',  value: '+41'  },
  { label: '🇸🇾 +963', value: '+963' },
  { label: '🇹🇼 +886', value: '+886' },
  { label: '🇹🇭 +66',  value: '+66'  },
  { label: '🇹🇳 +216', value: '+216' },
  { label: '🇹🇷 +90',  value: '+90'  },
  { label: '🇺🇦 +380', value: '+380' },
  { label: '🇦🇪 +971', value: '+971' },
  { label: '🇬🇧 +44',  value: '+44'  },
  { label: '🇺🇸 +1',   value: '+1'   },
  { label: '🇾🇪 +967', value: '+967' },
];

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [profession, setProfession] = useState('');
  const [district, setDistrict] = useState('');
  const [shiftsPerWeek, setShiftsPerWeek] = useState('');
  const [professionDoc, setProfessionDoc] = useState(null);
  const [vehicleTypeColor, setVehicleTypeColor] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('+972');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleNext() {
    setError('');
    if (step === 1) {
      if (!username) return setError('Username is required');
      if (!email) return setError('Email is required');
      if (password.length < 6) return setError('Password must be at least 6 characters');
      if (password !== confirm) return setError('Passwords do not match');
      setStep(2);
    } else if (step === 2) {
      if (!firstName || !lastName) return setError('Full name is required');
      if (phoneNumber.length !== 9) return setError('Phone number must be exactly 9 digits');
      setStep(3);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (mode === 'register' && step < 3) {
      handleNext();
      return;
    }
    setError('');
    setLoading(true);
    try {
      let data;
      if (mode === 'register') {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        formData.append('first_name', firstName);
        formData.append('last_name', lastName);
        formData.append('email', email);
        formData.append('profession', profession);
        formData.append('district', district);
        formData.append('shifts_per_week', shiftsPerWeek);
        formData.append('phone', phoneCountry + phoneNumber);
        formData.append('vehicle_type_color', vehicleTypeColor);
        formData.append('vehicle_number', vehicleNumber);
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
    setStep(1);
    setError('');
    setConfirm('');
    setShowPassword(false);
    setShowConfirm(false);
    setFirstName('');
    setLastName('');
    setEmail('');
    setProfession('');
    setDistrict('');
    setShiftsPerWeek('');
    setProfessionDoc(null);
    setVehicleTypeColor('');
    setVehicleNumber('');
    setPhoneCountry('+972');
    setPhoneNumber('');
  }

  const inputBase = "w-full px-5 py-4 bg-cupertino-grey border-none rounded-cupertino focus:ring-1 focus:ring-action-blue transition-all font-medium text-on-surface placeholder:text-cupertino-label/60";
  const selectBase = inputBase + " appearance-none cursor-pointer";

  const stepTitle = step === 1 ? 'Account' : step === 2 ? 'Personal Info' : 'Work & Vehicle';

  return (
    <div className="bg-background font-body text-on-surface antialiased flex flex-col items-center justify-center p-6 min-h-dvh">
      <div className="w-full max-w-[400px] flex flex-col items-center">

        {/* Logo Header */}
        <header className={`text-center ${mode === 'register' ? 'mb-6' : 'mb-12'}`}>
          <div className="inline-flex items-center justify-center mb-4">
            <img
              src="/logo.png"
              alt="Medical Pay"
              className={`object-contain transition-all duration-300 ${mode === 'register' ? 'w-16 h-16' : 'w-28 h-28'}`}
            />
          </div>
          <h1 className="font-headline font-extrabold text-3xl tracking-tight text-black">
            Medical <span className="brand-gradient-text">Pay</span>
          </h1>
          <p className="mt-2 text-cupertino-label font-medium text-sm">Track your medical salary with ease</p>
        </header>

        {/* Form */}
        <div className="w-full space-y-8">
          <form className="space-y-4" onSubmit={handleSubmit}>

            {/* Step progress indicator */}
            {mode === 'register' && (
              <div className="flex flex-col items-center gap-1.5 mb-2">
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3].map(s => (
                    <div
                      key={s}
                      className={`rounded-full transition-all duration-300 ${
                        step === s
                          ? 'w-5 h-2 bg-action-blue'
                          : step > s
                          ? 'w-2 h-2 bg-action-blue/40'
                          : 'w-2 h-2 bg-cupertino-grey'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-cupertino-label font-medium">
                  {stepTitle} · Step {step} of 3
                </p>
              </div>
            )}

            {/* ── STEP 1 (or login): Username + Password ── */}
            {(mode === 'login' || step === 1) && (
              <input
                className={inputBase}
                placeholder="Username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required={mode === 'login'}
                autoFocus
              />
            )}

            {mode === 'register' && step === 1 && (
              <input
                className={inputBase}
                placeholder="Email Address"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            )}

            {(mode === 'login' || step === 1) && (
              <div className="relative">
                <input
                  className={inputBase + ' pr-14'}
                  placeholder="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required={mode === 'login'}
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
            )}

            {mode === 'login' && (
              <div className="text-right -mt-1">
                <span
                  className="text-sm text-action-blue font-medium cursor-pointer hover:opacity-75 transition-opacity"
                  onClick={() => { setShowForgotModal(true); setForgotEmail(''); setForgotStatus(''); }}
                >
                  Forgot Password?
                </span>
              </div>
            )}

            {mode === 'register' && step === 1 && (
              <div className="relative">
                <input
                  className={inputBase + ' pr-14'}
                  placeholder="Confirm Password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
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
            )}

            {/* ── STEP 2: Personal Info ── */}
            {mode === 'register' && step === 2 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={inputBase}
                    placeholder="First Name"
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    autoFocus
                  />
                  <input
                    className={inputBase}
                    placeholder="Last Name"
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-shrink-0" style={{ width: '7.5rem' }}>
                    <select
                      className={selectBase}
                      value={phoneCountry}
                      onChange={e => setPhoneCountry(e.target.value)}
                    >
                      {COUNTRY_CODES.map(c => (
                        <option key={c.label} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-cupertino-label pointer-events-none text-xl">
                      expand_more
                    </span>
                  </div>
                  <input
                    className={inputBase + ' flex-1'}
                    placeholder="Phone (9 digits)"
                    type="tel"
                    inputMode="numeric"
                    maxLength={9}
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  />
                </div>
              </>
            )}

            {/* ── STEP 3: Work & Vehicle ── */}
            {mode === 'register' && step === 3 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <select
                      className={selectBase + (profession ? '' : ' text-cupertino-label/60')}
                      value={profession}
                      onChange={e => setProfession(e.target.value)}
                      autoFocus
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

                <div className="relative">
                  <select
                    className={selectBase + ' text-center' + (district ? '' : ' text-cupertino-label/60')}
                    value={district}
                    onChange={e => setDistrict(e.target.value)}
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

                <div className="relative">
                  <select
                    className={selectBase + (shiftsPerWeek ? '' : ' text-cupertino-label/60')}
                    value={shiftsPerWeek}
                    onChange={e => setShiftsPerWeek(e.target.value)}
                  >
                    <option value="">Shifts Per Week</option>
                    <option value="1-2">1-2</option>
                    <option value="3-4">3-4</option>
                    <option value="5-6">5-6</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-cupertino-label pointer-events-none text-xl">
                    expand_more
                  </span>
                </div>

                <input
                  className={inputBase}
                  placeholder="סוג רכב וצבע"
                  type="text"
                  value={vehicleTypeColor}
                  onChange={e => setVehicleTypeColor(e.target.value)}
                  dir="rtl"
                />

                <input
                  className={inputBase}
                  placeholder="מספר רכב"
                  type="text"
                  value={vehicleNumber}
                  onChange={e => setVehicleNumber(e.target.value)}
                  dir="rtl"
                />
              </>
            )}

            {error && (
              <p className="text-red-500 text-sm font-medium text-center">{error}</p>
            )}

            {/* Buttons */}
            {mode === 'register' ? (
              <div className={`grid gap-3 mt-2 ${step > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => { setError(''); setStep(s => s - 1); }}
                    className="w-full bg-cupertino-grey text-on-surface font-semibold py-4 rounded-cupertino transition-all duration-200 active:scale-[0.98]"
                  >
                    ← Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full brand-gradient text-white font-semibold py-4 rounded-cupertino brand-shadow active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? 'Please wait...' : step < 3 ? 'Next →' : 'Create Account'}
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full brand-gradient text-white font-semibold py-4 rounded-cupertino brand-shadow active:scale-[0.98] transition-all duration-200 text-lg mt-2 disabled:opacity-50"
              >
                {loading ? 'Please wait...' : 'Sign In'}
              </button>
            )}
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

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowForgotModal(false); }}
        >
          <div className="bg-background rounded-cupertino brand-shadow p-8 w-full max-w-[360px] relative">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="absolute right-4 top-4 text-cupertino-label hover:text-on-surface transition-colors outline-none"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            <h2 className="font-headline font-bold text-xl mb-1">Reset Password</h2>
            <p className="text-cupertino-label text-sm mb-6">Enter your email and we'll send you a reset link.</p>

            {forgotStatus === 'sent' ? (
              <div className="text-center space-y-4">
                <span className="material-symbols-outlined text-5xl text-action-blue">mark_email_read</span>
                <p className="font-medium text-on-surface">Check your inbox — a reset link has been sent.</p>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full brand-gradient text-white font-semibold py-4 rounded-cupertino brand-shadow active:scale-[0.98] transition-all duration-200"
                >
                  Done
                </button>
              </div>
            ) : (
              <form
                onSubmit={async e => {
                  e.preventDefault();
                  setForgotStatus('loading');
                  try {
                    await api.post('/auth/forgot-password', { email: forgotEmail });
                    setForgotStatus('sent');
                  } catch {
                    setForgotStatus('error');
                  }
                }}
                className="space-y-4"
              >
                <input
                  className={inputBase}
                  placeholder="Email Address"
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  required
                  autoFocus
                />
                {forgotStatus === 'error' && (
                  <p className="text-red-500 text-sm font-medium text-center">Something went wrong. Try again.</p>
                )}
                <button
                  type="submit"
                  disabled={forgotStatus === 'loading'}
                  className="w-full brand-gradient text-white font-semibold py-4 rounded-cupertino brand-shadow active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                >
                  {forgotStatus === 'loading' ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
