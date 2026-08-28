import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [backupMsg, setBackupMsg] = useState('');
  const [restoring, setRestoring] = useState(false);

  return (
    <main className="w-full max-w-lg mx-auto px-4 sm:px-6 pb-32 lg:pb-24 pt-24 flex flex-col gap-8">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold text-on-background tracking-tight font-headline">
        <span className="material-symbols-outlined text-brand-purple" style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
        Settings
      </h1>

      {/* Edit Profile */}
      <section className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 p-5">
        <button
          type="button"
          onClick={() => navigate('/edit-profile')}
          className="w-full flex items-center gap-4 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-brand-purple" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-800">My Profile</p>
            <p className="text-xs text-slate-400">Edit your name, profession &amp; district</p>
          </div>
          <span className="material-symbols-outlined text-slate-400">chevron_right</span>
        </button>
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
                const { data } = await api.get('/entries/backup');
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `salary-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                setBackupMsg(`Exported ${data.entries.length} entries.`);
              } catch (err) {
                setBackupMsg('Export failed: ' + (err.response?.data?.error || err.message));
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
                  const { data } = await api.post('/entries/restore', { entries });
                  setBackupMsg(`Successfully imported ${data.imported} entries.`);
                } catch (err) {
                  setBackupMsg('Import failed: ' + (err.response?.data?.error || err.message));
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
