import { useEffect, useState } from 'react';
import api from '../api.js';

export default function DeviceRecapModal({
  onSubmitted,
  title = 'Monthly Equipment Recap',
  subtitle = 'Please confirm which devices you currently have before downloading your report.',
  submitLabel = 'Submit & Download',
}) {
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/devices/catalog'), api.get('/devices/mine')])
      .then(([catalogRes, mineRes]) => {
        setCatalog(catalogRes.data || []);
        setSelected(new Set(mineRes.data?.deviceIds || []));
      })
      .catch(() => setError('Failed to load device list.'))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/devices/report', { deviceIds: Array.from(selected) });
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-5">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 font-headline">{title}</h3>
          <p className="text-sm text-slate-500 mt-1">
            {subtitle}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span>
          </div>
        ) : catalog.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl py-8 flex flex-col items-center gap-2 text-slate-400">
            <span className="material-symbols-outlined text-3xl opacity-30">devices</span>
            <p className="text-sm">No devices in the catalog yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
            {catalog.map(device => (
              <label
                key={device.id}
                className="flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-3 cursor-pointer border border-transparent has-[:checked]:border-action-blue has-[:checked]:bg-blue-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(device.id)}
                  onChange={() => toggle(device.id)}
                  className="w-4 h-4 accent-action-blue"
                />
                <span className="text-sm font-semibold text-slate-800">{device.name}</span>
              </label>
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm font-medium px-3 py-2 rounded-xl bg-red-50 text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting || loading}
          className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-white brand-gradient px-4 py-3 rounded-full brand-shadow disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm">{submitting ? 'hourglass_top' : 'check_circle'}</span>
          {submitting ? 'Submitting…' : submitLabel}
        </button>
      </div>
    </div>
  );
}
