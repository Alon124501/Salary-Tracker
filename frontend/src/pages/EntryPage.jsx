import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api.js';

function calcDaily(f) {
  const insurance = f.insurance_tests * 80;
  const screening = f.screening_tests * 105;
  const mixed = f.mixed_screening_tests * 120;
  const partial = f.partial_tests * 50;
  const km = f.kilometers * 2 + (f.kilometers >= 100 ? 100 : 0);
  const learning = f.learning_hours * 60;
  const expenses = f.food_expense + f.parking_expense;
  return { insurance, screening, mixed, partial, km, learning, expenses,
           total: insurance + screening + mixed + partial + km + learning + expenses };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const defaultForm = {
  date: today(),
  insurance_tests: 0, screening_tests: 0, mixed_screening_tests: 0, partial_tests: 0,
  kilometers: 0, learning_hours: 0, food_expense: 0, parking_expense: 0,
};

export default function EntryPage() {
  const navigate = useNavigate();
  const { date } = useParams();
  const [form, setForm] = useState({ ...defaultForm, date: date || today() });
  const [entryId, setEntryId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (date) loadExisting(date); }, [date]);

  async function loadExisting(d) {
    try {
      const { data } = await api.get(`/entries?month=${d.slice(0, 7)}`);
      const existing = data.find(e => e.date === d);
      if (existing) {
        setForm({
          date: existing.date,
          insurance_tests: existing.insurance_tests,
          screening_tests: existing.screening_tests,
          mixed_screening_tests: existing.mixed_screening_tests,
          partial_tests: existing.partial_tests,
          kilometers: existing.kilometers,
          learning_hours: existing.learning_hours,
          food_expense: existing.food_expense,
          parking_expense: existing.parking_expense,
        });
        setEntryId(existing.id);
      }
    } catch {}
  }

  function set(field, value) {
    const num = parseFloat(value);
    setForm(f => ({ ...f, [field]: isNaN(num) ? 0 : num }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/entries', form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save entry');
    } finally {
      setLoading(false);
    }
  }

  const calc = calcDaily(form);

  return (
    <div className="bg-[#F2F2F7] min-h-screen pb-56 lg:pb-20">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-24">

        {/* Editorial Header */}
        <section className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1 font-headline">
            {entryId ? 'Edit Entry' : 'Record Daily Stats'}
          </h1>
          <p className="text-slate-500 font-medium text-sm">Capture your productivity and expenses.</p>
        </section>

        <form className="space-y-6" onSubmit={handleSubmit}>

          {/* Date */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full bg-[#F2F2F7] border-none rounded-xl p-3 text-base font-bold focus:ring-2 focus:ring-brand-purple transition-all text-slate-900"
              required
            />
          </div>

          {/* Tests */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Tests</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <TestField label="Insurance" sub="80 ₪ each" value={form.insurance_tests} onChange={v => set('insurance_tests', v)} calc={calc.insurance} />
              <TestField label="Screening" sub="105 ₪ each" value={form.screening_tests} onChange={v => set('screening_tests', v)} calc={calc.screening} />
              <TestField label="Mixed Screening" sub="120 ₪ each" value={form.mixed_screening_tests} onChange={v => set('mixed_screening_tests', v)} calc={calc.mixed} />
              <TestField label="Partial" sub="50 ₪ each" value={form.partial_tests} onChange={v => set('partial_tests', v)} calc={calc.partial} />
            </div>
          </div>

          {/* KM + Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
                Kilometers{form.kilometers >= 100 ? ' 🎯' : ''}
              </label>
              <input
                type="number" inputMode="decimal" min="0" step="0.1"
                value={form.kilometers === 0 ? '' : form.kilometers}
                onChange={e => set('kilometers', e.target.value)}
                className="w-full bg-[#F2F2F7] border-none rounded-xl p-3 text-2xl font-bold focus:ring-2 focus:ring-brand-purple transition-all text-slate-900"
                placeholder="0"
              />
              {calc.km > 0 && <p className="text-[11px] text-brand-purple font-bold mt-1">{calc.km.toFixed(0)} ₪</p>}
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Learning Hrs</label>
              <input
                type="number" inputMode="decimal" min="0" step="0.5"
                value={form.learning_hours === 0 ? '' : form.learning_hours}
                onChange={e => set('learning_hours', e.target.value)}
                className="w-full bg-[#F2F2F7] border-none rounded-xl p-3 text-2xl font-bold focus:ring-2 focus:ring-brand-purple transition-all text-slate-900"
                placeholder="0"
              />
              {calc.learning > 0 && <p className="text-[11px] text-brand-purple font-bold mt-1">{calc.learning.toFixed(0)} ₪</p>}
            </div>
          </div>

          {/* Expenses */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Daily Expenses</h3>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
              {/* Food */}
              <div className="p-4 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-orange-600" style={{ fontSize: 20 }}>restaurant</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-slate-900">Food Expense</p>
                    <p className="text-[11px] text-slate-400">Meals and snacks</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-[#F2F2F7] px-3 py-2 rounded-lg">
                  <span className="text-slate-400 font-bold text-sm">₪</span>
                  <input
                    type="number" inputMode="decimal" min="0" step="0.01"
                    value={form.food_expense === 0 ? '' : form.food_expense}
                    onChange={e => set('food_expense', e.target.value)}
                    className="w-16 bg-transparent border-none p-0 text-right font-bold text-slate-900 focus:ring-0"
                    placeholder="0.00"
                  />
                </div>
              </div>
              {/* Parking */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-600" style={{ fontSize: 20 }}>local_parking</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-slate-900">Parking Expense</p>
                    <p className="text-[11px] text-slate-400">Day pass or meter</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-[#F2F2F7] px-3 py-2 rounded-lg">
                  <span className="text-slate-400 font-bold text-sm">₪</span>
                  <input
                    type="number" inputMode="decimal" min="0" step="0.01"
                    value={form.parking_expense === 0 ? '' : form.parking_expense}
                    onChange={e => set('parking_expense', e.target.value)}
                    className="w-16 bg-transparent border-none p-0 text-right font-bold text-slate-900 focus:ring-0"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

          {/* Save Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full brand-gradient text-white font-bold py-4 rounded-2xl brand-shadow active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-xl">save</span>
            {loading ? 'Saving...' : 'Save Entry'}
          </button>
        </form>
      </main>

      {/* Live Total Preview — fixed above bottom nav */}
      <div className="fixed bottom-32 lg:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-sm z-40">
        <div className="bg-white/80 apple-blur p-5 rounded-2xl shadow-xl border border-white/40 flex justify-between items-center">
          <div>
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest block mb-0.5">Live Total</span>
            <h2 className="text-3xl font-extrabold text-slate-900 font-headline">{calc.total.toFixed(0)} ₪</h2>
          </div>
          <div className="flex flex-col items-end gap-1">
            {calc.total > 0 && (
              <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-600 px-2 py-1 rounded-md text-[10px] font-bold">
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>trending_up</span>
                ESTIMATED
              </span>
            )}
            <p className="text-slate-400 text-[10px] font-medium text-right">
              {[
                calc.insurance > 0 && `Ins: ${calc.insurance}₪`,
                calc.screening > 0 && `Scr: ${calc.screening}₪`,
                calc.km > 0 && `KM: ${calc.km}₪`,
              ].filter(Boolean).join(' · ') || 'Fill in your data'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TestField({ label, sub, value, onChange, calc }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">{label}</label>
      <p className="text-[10px] text-slate-300 mb-2">{sub}</p>
      <input
        type="number" inputMode="numeric" min="0" step="1"
        value={value === 0 ? '' : value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-[#F2F2F7] border-none rounded-xl p-3 text-2xl font-bold focus:ring-2 focus:ring-brand-purple transition-all text-slate-900"
        placeholder="0"
      />
      {calc > 0 && <p className="text-[11px] text-brand-purple font-bold mt-1">{calc.toFixed(0)} ₪</p>}
    </div>
  );
}
