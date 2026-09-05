import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { isValidIsraeliId } from '../utils/israeliId.js';

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const inputBase = "w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30";
const selectBase = inputBase + " appearance-none cursor-pointer bg-white";

export default function EditProfilePage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [email, setEmail] = useState('');
  const [shirtSize, setShirtSize] = useState('');
  const [pantsSize, setPantsSize] = useState('');
  const [vehicleTypeColor, setVehicleTypeColor] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const [pwModal, setPwModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => {
    api.get('/auth/me').then(res => {
      setFirstName(res.data.first_name || '');
      setLastName(res.data.last_name || '');
      setIdNumber(res.data.id_number || '');
      setEmail(res.data.email || '');
      setShirtSize(res.data.shirt_size || '');
      setPantsSize(res.data.pants_size || '');
      setVehicleTypeColor(res.data.vehicle_type_color || '');
      setVehicleNumber(res.data.vehicle_number || '');
      setAddress(res.data.address || '');
    }).finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValidIsraeliId(idNumber)) {
      setMsg('Error: Invalid Israeli ID number');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      await api.patch('/auth/profile', {
        first_name: firstName,
        last_name: lastName,
        email,
        id_number: idNumber,
        vehicle_type_color: vehicleTypeColor,
        vehicle_number: vehicleNumber,
        shirt_size: shirtSize,
        pants_size: pantsSize,
        address,
      });
      setMsg('Profile updated successfully.');
    } catch (err) {
      setMsg('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  }

  function openPwModal() {
    setNewPassword('');
    setConfirmPassword('');
    setPwMsg('');
    setPwModal(true);
  }

  function closePwModal() {
    setPwModal(false);
    setNewPassword('');
    setConfirmPassword('');
    setPwMsg('');
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwMsg('Error: Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg('Error: Password must be at least 6 characters');
      return;
    }
    setPwSaving(true);
    setPwMsg('');
    try {
      await api.patch('/auth/password', { newPassword, confirmPassword });
      setPwMsg('Password changed successfully.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => { setPwModal(false); setPwMsg(''); }, 1500);
    } catch (err) {
      setPwMsg('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <main className="w-full max-w-lg mx-auto px-4 sm:px-6 pb-32 lg:pb-24 pt-24 flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-on-background tracking-tight font-headline">
          <span className="material-symbols-outlined text-brand-purple" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
          Edit Profile
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="material-symbols-outlined text-brand-purple animate-spin text-3xl">progress_activity</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <section className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 p-6 flex flex-col gap-5">
            <div>
              <h2 className="text-sm font-bold text-slate-700 mb-1">Personal Info</h2>
              <p className="text-xs text-slate-400">Your name as it appears in reports.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">First Name</label>
                <input
                  className={inputBase}
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="First Name"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Last Name</label>
                <input
                  className={inputBase}
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Last Name"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Email Address</label>
              <input
                className={inputBase}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">תעודת זהות</label>
              <input
                className={inputBase}
                type="text"
                inputMode="numeric"
                value={idNumber}
                onChange={e => setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="תעודת זהות"
                dir="rtl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Shirt Size</label>
                <div className="relative">
                  <select
                    className={selectBase}
                    value={shirtSize}
                    onChange={e => setShirtSize(e.target.value)}
                  >
                    <option value="">Select Size</option>
                    {SIZES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Pants Size</label>
                <div className="relative">
                  <select
                    className={selectBase}
                    value={pantsSize}
                    onChange={e => setPantsSize(e.target.value)}
                  >
                    <option value="">Select Size</option>
                    {SIZES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">כתובת מגורים</label>
              <input
                className={inputBase}
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="רחוב, עיר"
                dir="rtl"
              />
            </div>

            <button
              type="button"
              onClick={openPwModal}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-slate-200 hover:border-brand-purple/40 hover:bg-purple-50/50 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-brand-purple text-base" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Change Password</p>
                <p className="text-xs text-slate-400">Update your login password</p>
              </div>
              <span className="material-symbols-outlined text-slate-300 ml-auto">chevron_right</span>
            </button>
          </section>

          <section className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 p-6 flex flex-col gap-5">
            <div>
              <h2 className="text-sm font-bold text-slate-700 mb-1">פרטי רכב</h2>
              <p className="text-xs text-slate-400">Vehicle details.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">סוג רכב וצבע</label>
              <input
                className={inputBase}
                type="text"
                value={vehicleTypeColor}
                onChange={e => setVehicleTypeColor(e.target.value)}
                placeholder="סוג רכב וצבע"
                dir="rtl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">מספר רכב</label>
              <input
                className={inputBase}
                type="text"
                value={vehicleNumber}
                onChange={e => setVehicleNumber(e.target.value)}
                placeholder="מספר רכב"
                dir="rtl"
              />
            </div>
          </section>

          {msg && (
            <div className={`text-sm font-medium px-3 py-2 rounded-xl ${msg.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
              {msg}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-1.5 text-sm font-semibold text-white brand-gradient px-4 py-2.5 rounded-full brand-shadow disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">{saving ? 'hourglass_top' : 'save'}</span>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      )}

      {/* Change Password Modal */}
      {pwModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) closePwModal(); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800">Change Password</h2>
                <p className="text-xs text-slate-400 mt-0.5">Enter and confirm your new password</p>
              </div>
              <button
                type="button"
                onClick={closePwModal}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">New Password</label>
                <input
                  className={inputBase}
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Confirm New Password</label>
                <input
                  className={inputBase}
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                />
              </div>

              {pwMsg && (
                <div className={`text-sm font-medium px-3 py-2 rounded-xl ${pwMsg.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                  {pwMsg}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closePwModal}
                  className="flex-1 text-sm font-semibold text-slate-600 border border-slate-200 px-4 py-2.5 rounded-full hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-white brand-gradient px-4 py-2.5 rounded-full brand-shadow disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">{pwSaving ? 'hourglass_top' : 'lock'}</span>
                  {pwSaving ? 'Saving...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
