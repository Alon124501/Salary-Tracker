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
  const [parkingFiles, setParkingFiles] = useState([]);
  const [toast, setToast] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [bonuses, setBonuses] = useState([]);

  useEffect(() => { loadData(); checkSubmission(); }, [month]);

  useEffect(() => {
    api.get('/notifications').then(r => setNotifications(r.data)).catch(() => {});
  }, []);

  async function loadData() {
    try {
      const [entriesRes, summaryRes, bonusRes] = await Promise.all([
        api.get(`/entries?month=${month}`),
        api.get(`/entries/summary?month=${month}`),
        api.get(`/entries/bonuses?month=${month}`),
      ]);
      setEntries(entriesRes.data);
      setSummary(summaryRes.data);
      setBonuses(bonusRes.data || []);
    } catch {}
  }

  async function checkSubmission() {
    try {
      const { data } = await api.get(`/report/submission?month=${month}`);
      setSubmitted(data.submitted);
    } catch {
      setSubmitted(false);
    }
  }

  async function downloadExcel() {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/report/excel?month=${month}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const cd = res.headers.get('Content-Disposition');
    const match = cd && cd.match(/filename="([^"]+)"/);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = match ? decodeURIComponent(match[1]) : `${month}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openModal() {
    setParkingFiles([]);
    setSendMsg('');
    setShowModal(true);
  }

  async function submitReport() {
    setSending(true);
    setSendMsg('');
    try {
      const formData = new FormData();
      parkingFiles.forEach(f => formData.append('parking', f));
      await api.post(`/report/submit?month=${month}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowModal(false);
      setSubmitted(true);
      setToast('Report submitted to admin for review.');
      setTimeout(() => setToast(''), 4000);
    } catch (err) {
      setSendMsg('Failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSending(false);
    }
  }

  async function approveNotification(id) {
    try {
      await api.post(`/notifications/${id}/approve`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { /* silent */ }
  }

  async function openDocument(notif) {
    window.open(notif.document_url, '_blank', 'noopener,noreferrer');
    try {
      await api.post(`/notifications/${notif.id}/open-document`);
      setNotifications(prev => prev.map(n =>
        n.id === notif.id
          ? { ...n, document_opened_at: n.document_opened_at || new Date().toISOString() }
          : n
      ));
    } catch { /* silent */ }
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this entry?')) return;
    await api.delete(`/entries/${id}`);
    loadData();
  }

  const s = summary || {};
  const bonusTotal = bonuses.reduce((sum, b) => sum + Number(b.amount), 0);

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
            onClick={downloadExcel}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export Excel
          </button>
          {submitted ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Submitted
            </span>
          ) : (
            <button
              onClick={openModal}
              disabled={sending}
              className="flex items-center gap-1.5 text-xs font-semibold text-action-blue bg-blue-50 px-3 py-1.5 rounded-full disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">upload</span>
              Submit to Admin
            </button>
          )}
        </div>
      </div>

      {/* Notification Feed */}
      {notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map(n => (
            <div key={n.id} className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-brand-purple text-base" style={{ fontVariationSettings: "'FILL' 1" }}>notifications</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm">{n.title}</p>
                  <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap">{n.content}</p>
                  {n.document_url && (
                    <div className="mt-3 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-blue-500 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{n.document_file_name || 'Attached Document'}</p>
                        <p className="text-[10px] text-slate-400">{n.document_opened_at ? 'Opened' : 'Not yet opened'}</p>
                      </div>
                      <button
                        onClick={() => openDocument(n)}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-500 text-white active:scale-95 transition-all flex-shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        View
                      </button>
                    </div>
                  )}
                  {n.requires_approval && (
                    <button
                      onClick={() => approveNotification(n.id)}
                      disabled={n.force_view_document && !!n.document_url && !n.document_opened_at}
                      className="mt-3 w-full brand-gradient text-white text-sm font-semibold rounded-xl py-2.5 active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ boxShadow: '0 4px 14px rgba(139,53,217,0.2)' }}
                    >
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      {n.force_view_document && !!n.document_url && !n.document_opened_at
                        ? 'Open document first to approve'
                        : 'I have read and approved this document'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
                <h3 className="text-5xl font-extrabold tracking-tight font-headline leading-none">{((s.total || 0) + bonusTotal).toFixed(0)} <span className="text-2xl font-medium opacity-80">₪</span></h3>
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

          {/* Office */}
          <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-100 hover:shadow-card-hover transition-shadow duration-200">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-amber-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>corporate_fare</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Office</p>
            <div className="text-2xl font-bold text-slate-900 font-headline">{(s.office || 0).toFixed(0)} <span className="text-sm font-normal text-slate-400">₪</span></div>
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

          {/* Bonuses */}
          {bonusTotal > 0 && (
            <div className="bg-amber-50 p-4 rounded-2xl shadow-card border border-amber-200 hover:shadow-card-hover transition-shadow duration-200">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-amber-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-1">Bonuses</p>
              <div className="text-2xl font-bold text-amber-700 font-headline">{bonusTotal.toFixed(0)} <span className="text-sm font-normal text-amber-400">₪</span></div>
            </div>
          )}
        </div>
      </section>

      {/* Daily Entries */}
      <section>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold text-on-background tracking-tight mb-5 font-headline">
          <span className="material-symbols-outlined text-brand-purple" style={{ fontVariationSettings: "'FILL' 1" }}>event_note</span>
          Daily Entries
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {entries.length === 0 && bonuses.length === 0 ? (
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
          ) : [
              ...entries.map(e => ({ type: 'entry', date: e.date, data: e })),
              ...bonuses.map(b => ({ type: 'bonus', date: b.date, data: b })),
            ].sort((a, b) => b.date.localeCompare(a.date)).map(item => {
            if (item.type === 'bonus') {
              const b = item.data;
              const [y, m, d] = b.date.split('-');
              const monthName = new Date(y, m - 1).toLocaleString('en-US', { month: 'short' });
              return (
                <div key={`bonus-${b.id}`} className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-card">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-amber-400 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold uppercase leading-none text-white/80">{monthName}</span>
                      <span className="text-lg font-extrabold leading-none text-white font-headline">{d}</span>
                    </div>
                    <div>
                      <p className="font-bold text-amber-800 text-sm flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                        Bonus
                      </p>
                      {b.note && <p className="text-xs text-amber-600 mt-0.5">{b.note}</p>}
                    </div>
                  </div>
                  <p className="font-extrabold text-amber-700 text-base font-headline">+{Number(b.amount).toLocaleString()} <span className="text-xs font-normal text-amber-500">₪</span></p>
                </div>
              );
            }
            const e = item.data;
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col gap-5 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900 font-headline">Submit Report — {monthLabel(month)}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Cellopark / Pango upload */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">local_parking</span>
                Cellopark / Pango
                <span className="text-xs font-normal normal-case tracking-normal text-slate-400 ml-1">— optional</span>
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
                onClick={submitReport}
                disabled={sending}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-white brand-gradient px-4 py-2.5 rounded-full brand-shadow disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">{sending ? 'hourglass_top' : 'upload'}</span>
                {sending ? 'Submitting...' : 'Submit'}
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
