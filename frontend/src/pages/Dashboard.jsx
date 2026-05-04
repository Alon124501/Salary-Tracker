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

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  window.location.href = '/login';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [receiptFiles, setReceiptFiles] = useState([]);
  const [parkingFiles, setParkingFiles] = useState([]);
  const [toast, setToast] = useState('');

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

  async function downloadExcel() {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/report/excel?month=${month}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${month}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openModal() {
    setReceiptFiles([]);
    setParkingFiles([]);
    setSendMsg('');
    setShowModal(true);
  }

  async function sendReport() {
    setSending(true);
    setSendMsg('');
    try {
      const formData = new FormData();
      receiptFiles.forEach(f => formData.append('receipts', f));
      parkingFiles.forEach(f => formData.append('parking', f));
      const { data } = await api.post(`/report?month=${month}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowModal(false);
      setToast(`Report sent: "${data.subject}"`);
      setTimeout(() => setToast(''), 4000);
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
    <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 lg:pb-24 pt-20 flex flex-col gap-8">

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
            onClick={downloadExcel}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export Excel
          </button>
          <button
            onClick={openModal}
            disabled={sending}
            className="flex items-center gap-1.5 text-xs font-semibold text-action-blue bg-blue-50 px-3 py-1.5 rounded-full disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">send</span>
            Send Report
          </button>
        </div>
      </div>

      {/* Monthly Summary */}
      <section>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold text-on-background tracking-tight mb-5 font-headline">
          <span className="material-symbols-outlined text-brand-purple" style={{ fontVariationSettings: "'FILL' 1" }}>summarize</span>
          Monthly Summary
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Total hero card */}
          <div className="col-span-2 lg:col-span-4 brand-gradient p-6 rounded-2xl text-white brand-shadow">
            <div className="flex justify-between items-start mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-2">Total Earnings</p>
                <h3 className="text-5xl font-extrabold tracking-tight font-headline leading-none">{(s.total || 0).toFixed(0)} <span className="text-2xl font-medium opacity-80">₪</span></h3>
              </div>
              <div className="bg-white/20 p-2.5 rounded-xl">
                <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
              </div>
            </div>
            <div className="flex items-center gap-4 pt-4 border-t border-white/20">
              <div className="flex items-center gap-1.5 text-xs font-semibold opacity-90">
                <span className="material-symbols-outlined text-sm">calendar_month</span>
                {s.days || 0} work days
              </div>
              {s.expenses > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-semibold opacity-90">
                  <span className="material-symbols-outlined text-sm">receipt_long</span>
                  {(s.expenses || 0).toFixed(0)} ₪ expenses
                </div>
              )}
            </div>
          </div>

          {/* KM */}
          <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-100 group hover:shadow-card-hover transition-shadow duration-200">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-brand-purple text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>directions_car</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">KM Travel</p>
            <div className="text-2xl font-bold text-slate-900 font-headline">{(s.km || 0).toFixed(0)} <span className="text-sm font-normal text-slate-400">₪</span></div>
          </div>

          {/* Expenses */}
          <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-100 hover:shadow-card-hover transition-shadow duration-200">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-red-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Expenses</p>
            <div className="text-2xl font-bold text-red-500 font-headline">{(s.expenses || 0).toFixed(0)} <span className="text-sm font-normal text-slate-400">₪</span></div>
          </div>

          {/* Learning */}
          <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-100 hover:shadow-card-hover transition-shadow duration-200">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-amber-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Learning</p>
            <div className="text-2xl font-bold text-slate-900 font-headline">{(s.learning || 0).toFixed(0)} <span className="text-sm font-normal text-slate-400">₪</span></div>
          </div>

          {/* Screening */}
          <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-100 hover:shadow-card-hover transition-shadow duration-200">
            <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-sky-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>medical_services</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Screening</p>
            <div className="text-2xl font-bold text-slate-900 font-headline">{((s.screening || 0) + (s.mixed || 0)).toFixed(0)} <span className="text-sm font-normal text-slate-400">₪</span></div>
          </div>

          {/* Insurance */}
          <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-100 hover:shadow-card-hover transition-shadow duration-200">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-emerald-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>syringe</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Insurance</p>
            <div className="text-2xl font-bold text-slate-900 font-headline">{(s.insurance || 0).toFixed(0)} <span className="text-sm font-normal text-slate-400">₪</span></div>
          </div>
        </div>
      </section>

      {/* Daily Entries */}
      <section>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold text-on-background tracking-tight mb-5 font-headline">
          <span className="material-symbols-outlined text-brand-purple" style={{ fontVariationSettings: "'FILL' 1" }}>event_note</span>
          Daily Entries
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {entries.length === 0 ? (
            <div className="col-span-2 flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <span className="material-symbols-outlined text-5xl opacity-30">event_busy</span>
              <p className="text-sm font-medium">No entries for this month</p>
              <button
                onClick={() => navigate('/entry')}
                className="mt-1 text-xs font-semibold text-brand-purple border border-brand-purple/30 bg-purple-50 px-4 py-2 rounded-full hover:bg-purple-100 transition-colors"
              >
                Add your first entry
              </button>
            </div>
          ) : entries.map(e => {
            const [y, m, d] = e.date.split('-');
            const monthName = new Date(y, m - 1).toLocaleString('en-US', { month: 'short' });
            const tests = totalTests(e);
            return (
              <div
                key={e.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-white shadow-card border border-slate-100 hover:shadow-card-hover transition-all duration-150"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl brand-gradient flex flex-col items-center justify-center brand-shadow flex-shrink-0">
                    <span className="text-[9px] font-bold uppercase leading-none text-white/80">{monthName}</span>
                    <span className="text-lg font-extrabold leading-none text-white font-headline">{d}</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{d}/{m}/{y}</p>
                    <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                      {tests > 0 && (
                        <span className="flex items-center gap-0.5">
                          <span className="material-symbols-outlined leading-none" style={{ fontSize: 12 }}>biotech</span>
                          {tests} test{tests !== 1 ? 's' : ''}
                        </span>
                      )}
                      {tests > 0 && e.kilometers > 0 && <span className="opacity-40">·</span>}
                      {e.kilometers > 0 && (
                        <span className="flex items-center gap-0.5">
                          <span className="material-symbols-outlined leading-none" style={{ fontSize: 12 }}>route</span>
                          {e.kilometers} km
                        </span>
                      )}
                      {tests === 0 && e.kilometers === 0 && (
                        <span className="flex items-center gap-0.5 italic opacity-60">no data</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right mr-1">
                    <p className="font-extrabold text-slate-900 text-base font-headline">{e.calc.total.toFixed(0)} <span className="text-xs font-normal text-slate-400">₪</span></p>
                  </div>
                  <button
                    title="Edit"
                    className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-brand-purple hover:bg-purple-50 rounded-xl transition-all"
                    onClick={() => navigate(`/entry/${e.date}`)}
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    title="Delete"
                    className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
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

      {/* Send Report Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col gap-5 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900 font-headline">Send Report — {monthLabel(month)}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Receipts upload */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">receipt_long</span>
                Food Receipts
              </p>
              <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-slate-200 rounded-xl px-4 py-3 hover:border-action-blue transition-colors">
                <span className="material-symbols-outlined text-slate-400">add_photo_alternate</span>
                <span className="text-sm text-slate-500">{receiptFiles.length > 0 ? `${receiptFiles.length} photo${receiptFiles.length > 1 ? 's' : ''} selected` : 'Add photos'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => setReceiptFiles(Array.from(e.target.files))}
                />
              </label>
              {receiptFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {receiptFiles.map((f, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                      <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Parking receipts upload */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">local_parking</span>
                Parking Receipts
              </p>
              <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-slate-200 rounded-xl px-4 py-3 hover:border-action-blue transition-colors">
                <span className="material-symbols-outlined text-slate-400">upload_file</span>
                <span className="text-sm text-slate-500">{parkingFiles.length > 0 ? parkingFiles[0].name : 'Upload PDF'}</span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => setParkingFiles(Array.from(e.target.files))}
                />
              </label>
              {parkingFiles.length > 0 && (
                <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="material-symbols-outlined text-red-500 text-base">picture_as_pdf</span>
                  <span className="text-xs text-slate-600 truncate">{parkingFiles[0].name}</span>
                </div>
              )}
            </div>

            {sendMsg && (
              <div className={`text-sm font-medium px-3 py-2 rounded-xl ${sendMsg.startsWith('Failed') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                {sendMsg}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 text-sm font-semibold text-slate-600 bg-slate-100 px-4 py-2.5 rounded-full hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendReport}
                disabled={sending}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-white brand-gradient px-4 py-2.5 rounded-full brand-shadow disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">{sending ? 'hourglass_top' : 'send'}</span>
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {toast && (
        <div className="fixed bottom-36 lg:bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-emerald-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl animate-fade-in-up whitespace-nowrap">
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {toast}
          <button onClick={() => setToast('')} className="ml-1 opacity-70 hover:opacity-100">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}
    </main>
  );
}
