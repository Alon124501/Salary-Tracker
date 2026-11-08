import { useEffect, useRef, useState } from 'react';
import api from '../api.js';

export default function DeviceChecklist({
  onSubmitted,
  submitLabel = 'שלח',
  source = 'weekly',
  showLastUpdated = false,
}) {
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [lastSubmittedAt, setLastSubmittedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submitLock = useRef(false);

  useEffect(() => {
    Promise.all([api.get('/devices/catalog'), api.get('/devices/mine')])
      .then(([catalogRes, mineRes]) => {
        setCatalog(catalogRes.data || []);
        setSelected(new Set(mineRes.data?.deviceIds || []));
        setLastSubmittedAt(mineRes.data?.lastSubmittedAt || null);
      })
      .catch(() => setError('טעינת רשימת המכשירים נכשלה.'))
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
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/devices/report', { deviceIds: Array.from(selected), source });
      setLastSubmittedAt(res.data?.submittedAt || new Date().toISOString());
      onSubmitted?.(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'השליחה נכשלה. נסה שוב.');
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {showLastUpdated && !loading && (
        <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">schedule</span>
          {lastSubmittedAt
            ? `עודכן לאחרונה: ${new Date(lastSubmittedAt).toLocaleDateString('he-IL')}`
            : 'טרם עודכן'}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span>
        </div>
      ) : catalog.length === 0 ? (
        <div className="bg-slate-50 rounded-2xl py-8 flex flex-col items-center gap-2 text-slate-400">
          <span className="material-symbols-outlined text-3xl opacity-30">devices</span>
          <p className="text-sm">אין עדיין מכשירים בקטלוג.</p>
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
        {submitting ? 'שומר…' : submitLabel}
      </button>
    </div>
  );
}
