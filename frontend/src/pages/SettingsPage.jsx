import { useState, useEffect } from 'react';
import { getMe, saveSettings, getBackup, restoreEntries } from '../api.js';

export default function SettingsPage() {
  const [gmailUser, setGmailUser] = useState('');
  const [gmailPass, setGmailPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [paymentType, setPaymentType] = useState('');
  const [globalSalary, setGlobalSalary] = useState('');
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [globalInput, setGlobalInput] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    getMe().then(data => {
      setGmailUser(data.gmail_user || '');
      setPaymentType(data.payment_type || '');
      setGlobalSalary(data.global_salary != null ? String(data.global_salary) : '');
    }).catch(() => {});
  }, []);

  function handlePaymentTypeClick(value) {
    if (value === 'global') {
      setGlobalInput(globalSalary);
      setShowGlobalModal(true);
    } else {
      setPaymentType(value);
      doSaveSettings({ payment_type: value });
    }
  }

  async function doSaveSettings(updates) {
    setSaving(true);
    setMsg('');
    try {
      await saveSettings(updates);
      setMsg('Saved successfully.');
    } catch (err) {
      setMsg('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmGlobal() {
    const num = parseFloat(globalInput);
    if (isNaN(num) || num <= 0) return;
    setPaymentType('global');
    setGlobalSalary(String(num));
    setShowGlobalModal(false);
    await doSaveSettings({ payment_type: 'global', global_salary: num });
  }

  async function save(e) {
    e.preventDefault();
    await doSaveSettings({
      gmail_user: gmailUser,
      ...(gmailPass ? { gmail_app_password: gmailPass } : {}),
    });
    setGmailPass('');
  }

  return (
    <main className="w-full max-w-lg mx-auto px-4 sm:px-6 pb-32 lg:pb-24 pt-24 flex flex-col gap-8">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold text-on-background tracking-tight font-headline">
        <span className="material-symbols-outlined text-brand-purple" style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
        Settings
      </h1>

      {/* Payment Type */}
      <section className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-700 mb-1">Payment Type</h2>
          <p className="text-xs text-slate-400">Choose how your salary is calculated.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'per_test', label: 'Per Test', icon: 'biotech' },
            { value: 'per_hour', label: 'Per Hour', icon: 'schedule' },
            { value: 'global',   label: 'Global',   icon: 'public'   },
          ].map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => handlePaymentTypeClick(value)}
              className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all duration-200 ${
                paymentType === value
                  ? 'border-brand-purple bg-purple-50 text-brand-purple brand-shadow'
                  : 'border-slate-100 text-slate-400 hover:border-slate-300 hover:text-slate-600'
              }`}
            >
              <span
                className="material-symbols-outlined text-2xl"
                style={paymentType === value ? { fontVariationSettings: "'FILL' 1" } : {}}
              >{icon}</span>
              <span className="text-xs font-bold">{label}</span>
            </button>
          ))}
        </div>

        {paymentType === 'per_test' && (
          <div className="bg-purple-50 rounded-xl px-4 py-3 text-xs text-brand-purple font-medium flex flex-col gap-1">
            <p className="font-bold mb-0.5">Price per test type:</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <span>Insurance test — <strong>80 ₪</strong></span>
              <span>Screening test — <strong>105 ₪</strong></span>
              <span>Mixed screening — <strong>120 ₪</strong></span>
              <span>Partial test — <strong>50 ₪</strong></span>
            </div>
            <p className="text-purple-400 mt-1">Minimum 240 ₪ if fewer than 3 tests.</p>
          </div>
        )}
        {paymentType === 'per_hour' && (
          <div className="bg-purple-50 rounded-xl px-4 py-3 text-xs text-brand-purple font-medium">
            <span className="font-bold">90 ₪</span> per hour worked.
          </div>
        )}
        {paymentType === 'global' && globalSalary && (
          <div className="bg-purple-50 rounded-xl px-4 py-3 text-brand-purple flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl">₪</span>
              <span className="font-extrabold text-xl">{Number(globalSalary).toLocaleString()}</span>
              <span className="text-xs font-medium text-purple-400">/ month</span>
            </div>
            <button
              type="button"
              onClick={() => { setGlobalInput(globalSalary); setShowGlobalModal(true); }}
              className="flex items-center gap-1 text-xs font-semibold text-brand-purple hover:underline outline-none focus:outline-none"
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              Change
            </button>
          </div>
        )}

        {msg && (
          <div className={`text-sm font-medium px-3 py-2 rounded-xl ${msg.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
            {msg}
          </div>
        )}
      </section>

      {/* Global Salary Modal */}
      {showGlobalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border-2 border-slate-300 p-6 flex flex-col items-center gap-5">
            <div className="w-full flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900 font-headline">Set Global Salary</h3>
              <button onClick={() => setShowGlobalModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="w-full text-xs text-slate-400 text-center">Enter your fixed monthly salary in ₪.</p>
            <div className="w-full flex items-center gap-3 bg-slate-100 rounded-xl px-4 py-4">
              <span className="text-slate-800 font-extrabold text-3xl flex-shrink-0">₪</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={globalInput === '' ? '' : globalInput}
                onChange={e => setGlobalInput(e.target.value)}
                className="flex-1 border-none outline-none focus:outline-none ring-0 focus:ring-0 text-3xl font-bold text-slate-900 bg-transparent"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && confirmGlobal()}
              />
            </div>
            <div className="w-full flex gap-3">
              <button
                type="button"
                onClick={() => setShowGlobalModal(false)}
                className="flex-1 text-sm font-semibold text-slate-600 bg-slate-100 px-4 py-2.5 rounded-full hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmGlobal}
                disabled={!globalInput || parseFloat(globalInput) <= 0 || saving}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-white brand-gradient px-4 py-2.5 rounded-full brand-shadow disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">{saving ? 'hourglass_top' : 'save'}</span>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 p-6 flex flex-col gap-5">
        <div>
          <h2 className="text-sm font-bold text-slate-700 mb-1">Email Sender (Gmail)</h2>
          <p className="text-xs text-slate-400">Reports will be sent from this Gmail account. Use an App Password — not your regular password.</p>
        </div>

        <form onSubmit={save} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Gmail Address</label>
            <input
              type="email"
              value={gmailUser}
              onChange={e => setGmailUser(e.target.value)}
              placeholder="you@gmail.com"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest">App Password</label>
              <button
                type="button"
                onClick={() => setShowInstructions(v => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-action-blue hover:underline"
              >
                <span className="material-symbols-outlined text-sm">help</span>
                How to get one
              </button>
            </div>

            {showInstructions && (
              <div className="mb-3 bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col gap-2">
                <p className="text-xs font-bold text-blue-700 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">info</span>
                  How to create a Gmail App Password
                </p>
                <ol className="text-xs text-blue-800 flex flex-col gap-1.5 list-decimal list-inside leading-relaxed">
                  <li>Go to your Google Account at <span className="font-semibold">myaccount.google.com</span></li>
                  <li>Click <span className="font-semibold">Security</span> in the left sidebar</li>
                  <li>Under "How you sign in to Google", enable <span className="font-semibold">2-Step Verification</span> if not already on</li>
                  <li>Search for <span className="font-semibold">"App passwords"</span> in the search bar at the top</li>
                  <li>Enter an app name (e.g. <span className="font-semibold">Salary Tracker</span>) and click <span className="font-semibold">Create</span></li>
                  <li>Copy the 16-character password shown and paste it in the field below</li>
                </ol>
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-action-blue hover:underline"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  Open Google App Passwords
                </a>
              </div>
            )}

            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={gmailPass}
                onChange={e => setGmailPass(e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-base">{showPass ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

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
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </section>

      {/* Backup & Restore */}
      <section className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 p-6 flex flex-col gap-5">
        <div>
          <h2 className="text-sm font-bold text-slate-700 mb-1">Backup & Restore</h2>
          <p className="text-xs text-slate-400">Export all your entries to a file, then import them on any device or after redeployment.</p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Export */}
          <button
            type="button"
            onClick={async () => {
              setBackupMsg('');
              try {
                const data = await getBackup();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `salary-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                setBackupMsg(`Exported ${data.entries.length} entries.`);
              } catch (err) {
                setBackupMsg('Export failed: ' + err.message);
              }
            }}
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center flex-shrink-0 transition-colors">
              <span className="material-symbols-outlined text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-800">Export Backup</p>
              <p className="text-xs text-slate-400">Download all entries as a JSON file</p>
            </div>
          </button>

          {/* Import */}
          <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 hover:border-brand-purple/40 hover:bg-purple-50 transition-all group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-purple-50 group-hover:bg-purple-100 flex items-center justify-center flex-shrink-0 transition-colors">
              {restoring
                ? <span className="material-symbols-outlined text-brand-purple animate-spin">progress_activity</span>
                : <span className="material-symbols-outlined text-brand-purple" style={{ fontVariationSettings: "'FILL' 1" }}>upload</span>
              }
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-800">Import Backup</p>
              <p className="text-xs text-slate-400">Restore entries from a JSON backup file</p>
            </div>
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBackupMsg('');
                setRestoring(true);
                try {
                  const text = await file.text();
                  const json = JSON.parse(text);
                  const entries = json.entries ?? json;
                  const { imported } = await restoreEntries(entries);
                  setBackupMsg(`Successfully imported ${imported} entries.`);
                } catch (err) {
                  setBackupMsg('Import failed: ' + err.message);
                } finally {
                  setRestoring(false);
                  e.target.value = '';
                }
              }}
            />
          </label>
        </div>

        {backupMsg && (
          <div className={`text-sm font-medium px-3 py-2 rounded-xl ${backupMsg.startsWith('Export failed') || backupMsg.startsWith('Import failed') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
            {backupMsg}
          </div>
        )}
      </section>
    </main>
  );
}
