import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { isValidIsraeliId } from '../utils/israeliId.js';

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

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
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [email, setEmail] = useState('');
  const [shirtSize, setShirtSize] = useState('');
  const [pantsSize, setPantsSize] = useState('');
  const [vehicleTypeColor, setVehicleTypeColor] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('+972');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Wake up the backend while the user reads/types the login form
  useEffect(() => { api.get('/health').catch(() => {}); }, []);

  function handleNext() {
    setError('');
    if (step === 1) {
      if (!email) return setError('נדרשת כתובת אימייל');
      if (password.length < 6) return setError('הסיסמה חייבת לכלול לפחות 6 תווים');
      if (password !== confirm) return setError('הסיסמאות אינן תואמות');
      setStep(2);
    } else if (step === 2) {
      if (!firstName || !lastName) return setError('נדרש שם מלא');
      if (!isValidIsraeliId(idNumber)) return setError('תעודת זהות לא תקינה');
      if (phoneNumber.length !== 9) return setError('מספר הטלפון חייב לכלול 9 ספרות בדיוק');
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
        ({ data } = await api.post('/auth/register', {
          password,
          first_name: firstName,
          last_name: lastName,
          email,
          id_number: idNumber,
          phone: phoneCountry + phoneNumber,
          address,
          shirt_size: shirtSize,
          pants_size: pantsSize,
          vehicle_type_color: vehicleTypeColor,
          vehicle_number: vehicleNumber,
        }));
      } else {
        ({ data } = await api.post('/auth/login', { email, password }));
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.username);
      navigate('/');
    } catch (err) {
      const raw = err.response?.data?.error;
      setError(typeof raw === 'string' ? raw : raw?.message || 'משהו השתבש');
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
    setIdNumber('');
    setEmail('');
    setShirtSize('');
    setPantsSize('');
    setVehicleTypeColor('');
    setVehicleNumber('');
    setPhoneCountry('+972');
    setPhoneNumber('');
    setAddress('');
  }

  const inputBase = "w-full px-5 py-4 bg-cupertino-grey border-none rounded-cupertino focus:ring-1 focus:ring-action-blue transition-all font-medium text-on-surface placeholder:text-cupertino-label/60";
  const selectBase = inputBase + " appearance-none cursor-pointer";

  const stepTitle = step === 1 ? 'חשבון' : step === 2 ? 'פרטים אישיים' : 'רכב ומידות';

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
          <p className="mt-2 text-cupertino-label font-medium text-sm">מעקב קל אחר השכר שלך</p>
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
                  {stepTitle} · שלב {step} מתוך 3
                </p>
              </div>
            )}

            {/* ── STEP 1 (or login): Email + Password ── */}
            {(mode === 'login' || step === 1) && (
              <input
                className={inputBase}
                placeholder="כתובת אימייל"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            )}

            {(mode === 'login' || step === 1) && (
              <div className="relative">
                <input
                  className={inputBase + ' pl-14'}
                  placeholder="סיסמה"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-cupertino-label hover:text-on-surface transition-colors outline-none"
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
                  שכחת סיסמה?
                </span>
              </div>
            )}

            {mode === 'register' && step === 1 && (
              <div className="relative">
                <input
                  className={inputBase + ' pl-14'}
                  placeholder="אימות סיסמה"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
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
            )}

            {/* ── STEP 2: Personal Info ── */}
            {mode === 'register' && step === 2 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={inputBase}
                    placeholder="שם פרטי"
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    autoFocus
                  />
                  <input
                    className={inputBase}
                    placeholder="שם משפחה"
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                  />
                </div>

                <input
                  className={inputBase}
                  placeholder="תעודת זהות"
                  type="text"
                  inputMode="numeric"
                  value={idNumber}
                  onChange={e => setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  dir="rtl"
                />

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
                    <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-cupertino-label pointer-events-none text-xl">
                      expand_more
                    </span>
                  </div>
                  <input
                    className={inputBase + ' flex-1'}
                    placeholder="טלפון (9 ספרות)"
                    type="tel"
                    inputMode="numeric"
                    maxLength={9}
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  />
                </div>

                <input
                  className={inputBase}
                  placeholder="כתובת מגורים"
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  dir="rtl"
                />
              </>
            )}

            {/* ── STEP 3: Vehicle & Sizes ── */}
            {mode === 'register' && step === 3 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <select
                      className={selectBase + (shirtSize ? '' : ' text-cupertino-label/60')}
                      value={shirtSize}
                      onChange={e => setShirtSize(e.target.value)}
                      autoFocus
                    >
                      <option value="">מידת חולצה</option>
                      {SIZES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-cupertino-label pointer-events-none text-xl">
                      expand_more
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      className={selectBase + (pantsSize ? '' : ' text-cupertino-label/60')}
                      value={pantsSize}
                      onChange={e => setPantsSize(e.target.value)}
                    >
                      <option value="">מידת מכנסיים</option>
                      {SIZES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-cupertino-label pointer-events-none text-xl">
                      expand_more
                    </span>
                  </div>
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
                  maxLength={8}
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
                    → חזרה
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full brand-gradient text-white font-semibold py-4 rounded-cupertino brand-shadow active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? 'רגע בבקשה...' : step < 3 ? '← הבא' : 'צור חשבון'}
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full brand-gradient text-white font-semibold py-4 rounded-cupertino brand-shadow active:scale-[0.98] transition-all duration-200 text-lg mt-2 disabled:opacity-50"
              >
                {loading ? 'רגע בבקשה...' : 'התחברות'}
              </button>
            )}
          </form>

          {/* Toggle mode */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-full h-px bg-outline-variant my-2"></div>
            <p className="text-cupertino-label text-sm">
              {mode === 'login' ? "חדש כאן?" : 'כבר יש לך חשבון?'}
              <span
                className="font-semibold brand-gradient-text mr-1 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? 'צור חשבון' : 'התחברות'}
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-24 text-center">
          <div className="flex items-center justify-center gap-2 mb-4 opacity-30">
            <span className="material-symbols-outlined text-sm">lock</span>
            <span className="text-[10px] font-bold tracking-widest uppercase">הצפנה מקצה לקצה</span>
          </div>
          <p className="text-[10px] text-cupertino-label font-medium tracking-tight">© 2025 Medical Pay</p>
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
              className="absolute left-4 top-4 text-cupertino-label hover:text-on-surface transition-colors outline-none"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            <h2 className="font-headline font-bold text-xl mb-1">איפוס סיסמה</h2>
            <p className="text-cupertino-label text-sm mb-6">הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס.</p>

            {forgotStatus === 'sent' ? (
              <div className="text-center space-y-4">
                <span className="material-symbols-outlined text-5xl text-action-blue">mark_email_read</span>
                <p className="font-medium text-on-surface">בדוק את תיבת הדואר שלך — קישור לאיפוס נשלח.</p>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full brand-gradient text-white font-semibold py-4 rounded-cupertino brand-shadow active:scale-[0.98] transition-all duration-200"
                >
                  סיום
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
                  placeholder="כתובת אימייל"
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  required
                  autoFocus
                />
                {forgotStatus === 'error' && (
                  <p className="text-red-500 text-sm font-medium text-center">משהו השתבש. נסה שוב.</p>
                )}
                <button
                  type="submit"
                  disabled={forgotStatus === 'loading'}
                  className="w-full brand-gradient text-white font-semibold py-4 rounded-cupertino brand-shadow active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                >
                  {forgotStatus === 'loading' ? 'שולח...' : 'שלח קישור לאיפוס'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
