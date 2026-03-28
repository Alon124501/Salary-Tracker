import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month) {
  const [y, m] = month.split('-');
  return new Date(y, m - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function totalTests(e) {
  return (e.insurance_tests || 0) + (e.screening_tests || 0) + (e.mixed_screening_tests || 0) + (e.partial_tests || 0);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');

  useEffect(() => { loadData(); }, [month]);

  async function loadData() {
    try {
      const [entriesRes, summaryRes] = await Promise.all([
        api.get(`/entries?month=${month}`),
        api.get(`/entries/summary?month=${month}`)
      ]);
      setEntries(entriesRes.data);
      setSummary(summaryRes.data);
    } catch {}
  }

  async function sendReport() {
    setSending(true);
    setSendMsg('');
    try {
      const { data } = await api.post(`/report?month=${month}`);
      setSendMsg(`Sent: "${data.subject}"`);
    } catch (err) {
      setSendMsg('Failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSending(false);
    }
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this entry?')) return;
    await api.delete(`/entries/${id}`);
    loadData();
  }

  const s = summary || {};

  return (
    <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 lg:pb-16 pt-24 flex flex-col gap-8">

      {/* Month picker row */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-400 text-lg">calendar_month</span>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider border-none focus:ring-1 focus:ring-action-blue w-auto"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/entry')}
            className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-white brand-gradient px-4 py-2 rounded-full brand-shadow"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            New Entry
          </button>
          <button
            onClick={sendReport}
            disabled={sending}
            className="flex items-center gap-1.5 text-xs font-semibold text-action-blue bg-blue-50 px-3 py-1.5 rounded-full disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">{sending ? 'hourglass_top' : 'send'}</span>
            {sending ? 'Sending...' : 'Send Report'}
          </button>
        </div>
      </div>

      {sendMsg && (
        <div className={`text-sm font-medium px-4 py-3 rounded-xl ${sendMsg.startsWith('Failed') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
          {sendMsg}
        </div>
      )}

      {/* Monthly Summary */}
      <section>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold text-on-background tracking-tight mb-6 font-headline">
          <span className="material-symbols-outlined text-brand-purple" style={{ fontVariationSettings: "'FILL' 1" }}>summarize</span>
          Monthly Summary
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Total */}
          <div className="col-span-2 lg:col-span-4 brand-gradient p-6 rounded-xl text-white brand-shadow">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium opacity-90 mb-1">Total Earnings</p>
                <h3 className="text-4xl font-extrabold tracking-tight font-headline">{(s.total || 0).toFixed(0)} ₪</h3>
              </div>
              <div className="bg-white/20 p-2 rounded-lg">
                <span className="material-symbols-outlined text-white">payments</span>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-xs opacity-80">{s.days || 0} work days this month</span>
            </div>
          </div>

          {/* KM */}
          <div className="bg-white p-4 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100">
            <div className="flex items-center gap-2 mb-2 text-slate-500">
              <span className="material-symbols-outlined text-lg">directions_car</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">KM Travel</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 font-headline">{(s.km || 0).toFixed(0)} <span className="text-sm font-normal text-slate-400">₪</span></div>
          </div>

          {/* Expenses */}
          <div className="bg-white p-4 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100">
            <div className="flex items-center gap-2 mb-2 text-slate-500">
              <span className="material-symbols-outlined text-lg">receipt_long</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">Expenses</span>
            </div>
            <div className="text-2xl font-bold text-red-600 font-headline">{(s.expenses || 0).toFixed(0)} <span className="text-sm font-normal text-slate-400">₪</span></div>
          </div>

          {/* Learning */}
          <div className="bg-white p-4 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100">
            <div className="flex items-center gap-2 mb-2 text-slate-500">
              <span className="material-symbols-outlined text-lg">school</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">Learning</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 font-headline">{(s.learning || 0).toFixed(0)} <span className="text-sm font-normal text-slate-400">₪</span></div>
          </div>

          {/* Screening */}
          <div className="bg-white p-4 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100">
            <div className="flex items-center gap-2 mb-2 text-slate-500">
              <span className="material-symbols-outlined text-lg">medical_services</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">Screening</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 font-headline">{((s.screening || 0) + (s.mixed || 0)).toFixed(0)} <span className="text-sm font-normal text-slate-400">₪</span></div>
          </div>

          {/* Insurance */}
          <div className="bg-white p-4 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100">
            <div className="flex items-center gap-2 mb-2 text-slate-500">
              <span className="material-symbols-outlined text-lg">syringe</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">Insurance</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 font-headline">{(s.insurance || 0).toFixed(0)} <span className="text-sm font-normal text-slate-400">₪</span></div>
          </div>
        </div>
      </section>

      {/* Daily Entries */}
      <section>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold text-on-background tracking-tight mb-6 font-headline">
          <span className="material-symbols-outlined text-brand-purple" style={{ fontVariationSettings: "'FILL' 1" }}>event_note</span>
          Daily Entries
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {entries.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No entries for this month</p>
          ) : entries.map(e => {
            const [y, m, d] = e.date.split('-');
            const monthName = new Date(y, m - 1).toLocaleString('en-US', { month: 'short' });
            const tests = totalTests(e);
            return (
              <div
                key={e.id}
                className="flex items-center justify-between p-4 rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-50 flex flex-col items-center justify-center border border-slate-100">
                    <span className="text-[10px] font-bold uppercase leading-none text-slate-400">{monthName}</span>
                    <span className="text-lg font-bold leading-none text-slate-900">{d}</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{d}/{m}/{y}</p>
                    <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      {tests > 0 && (
                        <>
                          <span className="material-symbols-outlined text-xs leading-none" style={{ fontSize: 13 }}>biotech</span>
                          {tests} test{tests !== 1 ? 's' : ''}
                        </>
                      )}
                      {tests > 0 && e.kilometers > 0 && <span className="opacity-40">·</span>}
                      {e.kilometers > 0 && (
                        <>
                          <span className="material-symbols-outlined text-xs leading-none" style={{ fontSize: 13 }}>route</span>
                          {e.kilometers} km
                        </>
                      )}
                      {tests === 0 && e.kilometers === 0 && (
                        <>
                          <span className="material-symbols-outlined text-xs leading-none" style={{ fontSize: 13 }}>info</span>
                          No tests or km
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right mr-1">
                    <p className="font-bold text-slate-900 text-sm">{e.calc.total.toFixed(0)} ₪</p>
                    <p className="text-[10px] text-slate-400 font-medium flex items-center justify-end gap-0.5">
                      <span className="material-symbols-outlined" style={{ fontSize: 10 }}>payments</span>earned
                    </p>
                  </div>
                  <button
                    title="Edit"
                    className="w-8 h-8 flex items-center justify-center text-action-blue bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
                    onClick={() => navigate(`/entry/${e.date}`)}
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    title="Delete"
                    className="w-8 h-8 flex items-center justify-center text-red-500 bg-red-50 rounded-full hover:bg-red-100 transition-colors"
                    onClick={() => deleteEntry(e.id)}
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAB — mobile only */}
      <button
        onClick={() => navigate('/entry')}
        className="lg:hidden fixed bottom-28 right-6 w-14 h-14 brand-gradient text-white rounded-full brand-shadow flex items-center justify-center active:scale-90 transition-transform z-40"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>
    </main>
  );
}
