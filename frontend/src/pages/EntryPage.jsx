import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api.js';

function calcDaily(f) {
  const totalTests = f.insurance_tests + f.screening_tests + f.mixed_screening_tests + f.partial_tests;
  const insurance = f.insurance_tests * 80;
  const screening = f.screening_tests * 105;
  const mixed = f.mixed_screening_tests * 120;
  const partial = f.partial_tests * 50;
  const rawTestsPay = insurance + screening + mixed + partial;
  const MIN_TESTS_PAY = 240;
  const testsPay = totalTests > 0 ? Math.max(rawTestsPay, MIN_TESTS_PAY) : rawTestsPay;
  const minBonus = testsPay - rawTestsPay;
  const km = f.kilometers * 2 + (f.kilometers >= 100 ? 100 : 0);
  const office = f.office_hours * 60;
  const expenses = f.food_expense + f.parking_expense;
  return { insurance, screening, mixed, partial, minBonus, km, office, expenses,
           total: testsPay + km + office + expenses };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const defaultForm = {
  date: today(),
  insurance_tests: 0, screening_tests: 0, mixed_screening_tests: 0, partial_tests: 0,
  kilometers: 0, office_hours: 0, food_expense: 0, parking_expense: 0,
};

export default function EntryPage() {
  const navigate = useNavigate();
  const { date } = useParams();
  const [form, setForm] = useState({ ...defaultForm, date: date || today() });
  const [entryId, setEntryId] = useState(null);
  const [foodReceipts, setFoodReceipts] = useState([]);
  const [pendingFoodFiles, setPendingFoodFiles] = useState([]);
  const [parkingReceipts, setParkingReceipts] = useState([]);
  const [pendingParkingFiles, setPendingParkingFiles] = useState([]);
  const [viewingUrl, setViewingUrl] = useState(null);
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
          office_hours: existing.office_hours,
          food_expense: existing.food_expense,
          parking_expense: existing.parking_expense,
        });
        setEntryId(existing.id);
        if (existing.food_receipt_urls?.length > 0) {
          try {
            const { data: receipts } = await api.get(`/entries/${existing.id}/food-receipts`);
            setFoodReceipts(receipts);
          } catch {}
        }
        if (existing.parking_receipt_urls?.length > 0) {
          try {
            const { data: receipts } = await api.get(`/entries/${existing.id}/parking-receipts`);
            setParkingReceipts(receipts);
          } catch {}
        }
      }
    } catch {}
  }

  function set(field, value) {
    const num = parseFloat(value);
    setForm(f => ({ ...f, [field]: isNaN(num) ? 0 : num }));
  }

  async function deleteReceipt(path) {
    const id = entryId ?? path.split('/')[2];
    try {
      await api.delete(`/entries/${id}/food-receipt`, { params: { path } });
      setFoodReceipts(prev => prev.filter(r => r.path !== path));
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete receipt');
    }
  }

  async function deleteParkingReceipt(path) {
    const id = entryId ?? path.split('/')[2];
    try {
      await api.delete(`/entries/${id}/parking-receipt`, { params: { path } });
      setParkingReceipts(prev => prev.filter(r => r.path !== path));
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete receipt');
    }
  }

  async function openReceipt(path, type) {
    try {
      const { data } = await api.get(`/entries/${entryId}/${type}-receipts`);
      const found = data.find(r => r.path === path);
      if (found?.signedUrl) {
        if (type === 'food') {
          setFoodReceipts(prev => prev.map(r => r.path === path ? { ...r, signedUrl: found.signedUrl } : r));
        } else {
          setParkingReceipts(prev => prev.map(r => r.path === path ? { ...r, signedUrl: found.signedUrl } : r));
        }
        setViewingUrl(found.signedUrl);
      } else {
        setError('Could not load receipt image');
      }
    } catch {
      setError('Failed to load receipt');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data: saved } = await api.post('/entries', form);
      setEntryId(saved.id);
      for (const { file } of pendingFoodFiles) {
        const fd = new FormData();
        fd.append('food_receipt', file);
        await api.post(`/entries/${saved.id}/food-receipt`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      for (const { file } of pendingParkingFiles) {
        const fd = new FormData();
        fd.append('parking_receipt', file);
        await api.post(`/entries/${saved.id}/parking-receipt`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save entry');
    } finally {
      setLoading(false);
    }
  }

  const calc = calcDaily(form);

  return (
    <div className="bg-[#F2F2F7] min-h-screen pb-56 lg:pb-24">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-20">

        {/* Editorial Header */}
        <section className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1 font-headline">
            {entryId ? 'Edit Entry' : 'Record Daily Stats'}
          </h1>
          <p className="text-slate-500 font-medium text-sm">Capture your productivity and expenses.</p>
        </section>

        <form className="space-y-6" onSubmit={handleSubmit}>

          {/* Date */}
          <CalendarPicker value={form.date} onChange={d => setForm(f => ({ ...f, date: d }))} />

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
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Office Hrs</label>
              <input
                type="number" inputMode="decimal" min="0" step="0.5"
                value={form.office_hours === 0 ? '' : form.office_hours}
                onChange={e => set('office_hours', e.target.value)}
                className="w-full bg-[#F2F2F7] border-none rounded-xl p-3 text-2xl font-bold focus:ring-2 focus:ring-brand-purple transition-all text-slate-900"
                placeholder="0"
              />
              {calc.office > 0 && <p className="text-[11px] text-brand-purple font-bold mt-1">{calc.office.toFixed(0)} ₪</p>}
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
              <div className="p-4 flex items-center justify-between border-b border-slate-50">
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

              {/* Parking Receipt Upload — multiple */}
              <div className="p-4 space-y-3 border-b border-slate-50">
                {(parkingReceipts.length > 0 || pendingParkingFiles.length > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {parkingReceipts.map(r => (
                      <div key={r.path} className="relative w-16 h-16 flex-shrink-0">
                        {r.signedUrl ? (
                          <img
                            src={r.signedUrl}
                            alt="parking receipt"
                            className="w-16 h-16 object-cover rounded-xl cursor-pointer border-2 border-white shadow"
                            onClick={() => openReceipt(r.path, 'parking')}
                          />
                        ) : (
                          <div
                            className="w-16 h-16 rounded-xl bg-slate-200 flex items-center justify-center border-2 border-slate-300"
                          >
                            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 20 }}>broken_image</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteParkingReceipt(r.path)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow"
                        >
                          <span className="material-symbols-outlined text-white" style={{ fontSize: 12 }}>close</span>
                        </button>
                      </div>
                    ))}
                    {pendingParkingFiles.map((item, i) => (
                      <div key={i} className="relative w-16 h-16 flex-shrink-0">
                        <img
                          src={item.previewUrl}
                          alt="pending"
                          className="w-16 h-16 object-cover rounded-xl opacity-70 border-2 border-dashed border-blue-300 cursor-pointer"
                          onClick={() => setViewingUrl(item.previewUrl)}
                        />
                        <button
                          type="button"
                          onClick={() => setPendingParkingFiles(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-400 rounded-full flex items-center justify-center shadow"
                        >
                          <span className="material-symbols-outlined text-white" style={{ fontSize: 12 }}>close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 rounded-xl transition-colors py-1">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-blue-600" style={{ fontSize: 20 }}>add_a_photo</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-slate-900">Add Parking Receipt</p>
                    <p className="text-[11px] text-slate-400">Tap to add photo(s)</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => {
                      const files = Array.from(e.target.files).map(file => ({
                        file,
                        previewUrl: URL.createObjectURL(file),
                      }));
                      setPendingParkingFiles(prev => [...prev, ...files]);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              {/* Food Receipt Upload — multiple */}
              <div className="p-4 space-y-3">
                {(foodReceipts.length > 0 || pendingFoodFiles.length > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {foodReceipts.map(r => (
                      <div key={r.path} className="relative w-16 h-16 flex-shrink-0">
                        {r.signedUrl ? (
                          <img
                            src={r.signedUrl}
                            alt="receipt"
                            className="w-16 h-16 object-cover rounded-xl cursor-pointer border-2 border-white shadow"
                            onClick={() => openReceipt(r.path, 'food')}
                          />
                        ) : (
                          <div
                            className="w-16 h-16 rounded-xl bg-slate-200 flex items-center justify-center border-2 border-slate-300"
                          >
                            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 20 }}>broken_image</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteReceipt(r.path)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow"
                        >
                          <span className="material-symbols-outlined text-white" style={{ fontSize: 12 }}>close</span>
                        </button>
                      </div>
                    ))}
                    {pendingFoodFiles.map((item, i) => (
                      <div key={i} className="relative w-16 h-16 flex-shrink-0">
                        <img
                          src={item.previewUrl}
                          alt="pending"
                          className="w-16 h-16 object-cover rounded-xl opacity-70 border-2 border-dashed border-orange-300 cursor-pointer"
                          onClick={() => setViewingUrl(item.previewUrl)}
                        />
                        <button
                          type="button"
                          onClick={() => setPendingFoodFiles(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-400 rounded-full flex items-center justify-center shadow"
                        >
                          <span className="material-symbols-outlined text-white" style={{ fontSize: 12 }}>close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 rounded-xl transition-colors py-1">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-orange-600" style={{ fontSize: 20 }}>add_a_photo</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-slate-900">Add Food Receipt</p>
                    <p className="text-[11px] text-slate-400">Tap to add photo(s)</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => {
                      const files = Array.from(e.target.files).map(file => ({
                        file,
                        previewUrl: URL.createObjectURL(file),
                      }));
                      setPendingFoodFiles(prev => [...prev, ...files]);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Live Total */}
          <div className="brand-gradient p-5 rounded-2xl brand-shadow flex justify-between items-center">
            <div>
              <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest block mb-1">Live Total</span>
              <h2 className="text-4xl font-extrabold text-white font-headline leading-none">{calc.total.toFixed(0)} <span className="text-xl font-medium opacity-80">₪</span></h2>
            </div>
            <div className="flex flex-col items-end gap-2">
              {calc.total > 0 && (
                <span className="inline-flex items-center gap-1 bg-white/20 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold">
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>trending_up</span>
                  ESTIMATED
                </span>
              )}
              <p className="text-white/60 text-[10px] font-medium text-right">
                {[
                  calc.insurance > 0 && `Ins: ${calc.insurance}₪`,
                  calc.screening > 0 && `Scr: ${calc.screening}₪`,
                  calc.km > 0 && `KM: ${calc.km}₪`,
                ].filter(Boolean).join(' · ') || 'Fill in your data'}
              </p>
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
      {viewingUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewingUrl(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white"
            onClick={() => setViewingUrl(null)}
          >
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>
          <img
            src={viewingUrl}
            alt="Receipt"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function CalendarPicker({ value, onChange }) {
  const today = new Date().toISOString().slice(0, 10);
  const selected = value ? new Date(value + 'T00:00:00') : null;
  const [open, setOpen] = useState(false);

  const [cursor, setCursor] = useState(() => {
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const firstDay = new Date(cursor.year, cursor.month, 1).getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const daysInPrev = new Date(cursor.year, cursor.month, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: daysInPrev - firstDay + 1 + i, cur: false });
  for (let i = 1; i <= daysInMonth; i++) cells.push({ day: i, cur: true });
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) cells.push({ day: i, cur: false });

  function prevMonth() {
    setCursor(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 });
  }
  function nextMonth() {
    setCursor(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 });
  }
  function selectDay(day) {
    const d = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(d);
    setOpen(false);
  }

  function isSelected(day) {
    if (!selected) return false;
    return selected.getFullYear() === cursor.year && selected.getMonth() === cursor.month && selected.getDate() === day;
  }
  function isToday(day) {
    const [ty, tm, td] = today.split('-').map(Number);
    return ty === cursor.year && tm - 1 === cursor.month && td === day;
  }

  const selectedLabel = selected
    ? selected.toLocaleString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'No date selected';

  return (
    <div className="bg-white rounded-2xl shadow-[0px_20px_40px_rgba(26,28,29,0.04)] overflow-hidden">
      {/* Selected date display — always visible, tap to open */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 pt-5 pb-4 bg-[#F9F9FB] flex items-center justify-between text-left active:bg-[#F2F2F7] transition-colors"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Date</p>
          <p className="text-lg font-extrabold text-slate-900 font-headline leading-tight">{selectedLabel}</p>
        </div>
        <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>

      {/* Expandable calendar */}
      {open && <>
      {/* Month nav */}
      <div className="flex items-center justify-between px-5 py-3">
        <button type="button" onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F2F2F7] transition-colors text-slate-500 active:scale-90">
          <span className="material-symbols-outlined text-lg">chevron_left</span>
        </button>
        <span className="font-headline font-extrabold text-slate-900 text-sm tracking-tight">
          {MONTHS[cursor.month]} {cursor.year}
        </span>
        <button type="button" onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F2F2F7] transition-colors text-slate-500 active:scale-90">
          <span className="material-symbols-outlined text-lg">chevron_right</span>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-3 pb-1">
        {DAYS.map(d => (
          <div key={d} className="flex items-center justify-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">{d}</span>
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-1 px-3 pb-4">
        {cells.map((cell, i) => {
          const sel = cell.cur && isSelected(cell.day);
          const tod = cell.cur && isToday(cell.day);
          return (
            <div key={i} className="flex items-center justify-center">
              <button
                type="button"
                disabled={!cell.cur}
                onClick={() => cell.cur && selectDay(cell.day)}
                className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-semibold transition-all active:scale-90 relative
                  ${!cell.cur ? 'text-slate-200 cursor-default' : ''}
                  ${cell.cur && !sel ? 'text-slate-800 hover:bg-[#F2F2F7]' : ''}
                  ${sel ? 'brand-gradient text-white brand-shadow' : ''}
                `}
              >
                {cell.day}
                {tod && !sel && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-purple" />
                )}
              </button>
            </div>
          );
        })}
      </div>
      </>}
    </div>
  );
}

function TestField({ label, sub, value, onChange, calc }) {
  const num = Number(value) || 0;
  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-100 flex flex-col overflow-hidden">
      <div className="px-3 pt-3 pb-2 text-center">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-[10px] text-slate-300 mt-0.5">{sub}</p>
      </div>
      <div className="text-center py-2">
        <span className="text-3xl font-extrabold text-slate-900 font-headline tabular-nums">{num}</span>
        {calc > 0 && <p className="text-[11px] text-brand-purple font-bold mt-0.5">{calc.toFixed(0)} ₪</p>}
        {calc === 0 && <p className="text-[11px] text-transparent font-bold mt-0.5">—</p>}
      </div>
      <div className="grid grid-cols-2 border-t border-slate-100 mt-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, num - 1))}
          disabled={num === 0}
          className="py-3 flex items-center justify-center text-slate-400 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-30 transition-all font-bold text-xl border-r border-slate-100"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => onChange(num + 1)}
          className="py-3 flex items-center justify-center text-brand-purple hover:bg-purple-50 active:bg-purple-100 transition-all"
        >
          <span className="material-symbols-outlined text-lg">add</span>
        </button>
      </div>
    </div>
  );
}
