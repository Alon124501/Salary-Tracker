import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import DeviceRecapModal from '../components/DeviceRecapModal.jsx';
import { pushSupported, requestPermissionAndSubscribe, unsubscribePush } from '../push.js';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function totalTests(e) {
  return (e.insurance_tests || 0) + (e.screening_tests || 0) + (e.mixed_screening_tests || 0) + (e.partial_tests || 0);
}

function logout() {
  unsubscribePush().finally(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login';
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [showPushBanner, setShowPushBanner] = useState(
    pushSupported() && Notification.permission === 'default' && localStorage.getItem('pushBannerDismissed') !== '1'
  );

  useEffect(() => { loadData(); }, [month]);

  useEffect(() => {
    api.get('/notifications').then(r => setNotifications(r.data)).catch(() => {});
  }, []);

  async function loadData() {
    try {
      const [entriesRes, summaryRes] = await Promise.all([
        api.get(`/entries?month=${month}`),
        api.get(`/entries/summary?month=${month}`),
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

  async function downloadZip() {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/report/download-zip?month=${month}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 409) {
      setShowRecapModal(true);
      return;
    }
    if (!res.ok) return;
    const cd = res.headers.get('Content-Disposition');
    const match = cd && cd.match(/filename="([^"]+)"/);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = match ? decodeURIComponent(match[1]) : `${month}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleRecapSubmitted() {
    setShowRecapModal(false);
    downloadZip();
  }

  async function approveNotification(id) {
    try {
      await api.post(`/notifications/${id}/approve`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { /* silent */ }
  }

  async function dismissNotification(id) {
    try {
      await api.post(`/notifications/${id}/dismiss`);
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

  async function enablePush() {
    await requestPermissionAndSubscribe();
    setShowPushBanner(false);
  }

  function dismissPushBanner() {
    localStorage.setItem('pushBannerDismissed', '1');
    setShowPushBanner(false);
  }

  async function deleteEntry(id) {
    if (!confirm('למחוק רישום זה?')) return;
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
            onClick={downloadExcel}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            ייצוא לאקסל
          </button>
          <button
            onClick={downloadZip}
            className="flex items-center gap-1.5 text-xs font-semibold text-action-blue bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            הורדת דוח
          </button>
        </div>
      </div>

      {/* Push notifications opt-in banner */}
      {showPushBanner && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-brand-purple text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>notifications_active</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm">קבל התראות ישירות לטלפון</p>
            <p className="text-xs text-slate-400 mt-0.5">אשר קבלת התראות כדי לא לפספס עדכונים חשובים</p>
          </div>
          <button
            onClick={enablePush}
            className="text-xs font-bold px-3 py-2 rounded-xl brand-gradient text-white active:scale-95 transition-all flex-shrink-0"
          >
            הפעל
          </button>
          <button
            onClick={dismissPushBanner}
            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-slate-500 flex-shrink-0"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

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
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-slate-800 text-sm">{n.title}</p>
                    {!n.requires_approval && (
                      <button
                        onClick={() => dismissNotification(n.id)}
                        title="הסתר התראה"
                        className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-slate-300 hover:text-slate-500 -mt-0.5 -me-0.5"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap">{n.content}</p>
                  {n.document_url && (
                    <div className="mt-3 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-blue-500 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{n.document_file_name || 'מסמך מצורף'}</p>
                        <p className="text-[10px] text-slate-400">{n.document_opened_at ? 'נפתח' : 'טרם נפתח'}</p>
                      </div>
                      <button
                        onClick={() => openDocument(n)}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-500 text-white active:scale-95 transition-all flex-shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        צפייה
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
                        ? 'יש לפתוח את המסמך לפני האישור'
                        : 'קראתי ואישרתי את המסמך'}
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
          סיכום חודשי
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Total tests hero card */}
          <div className="col-span-2 lg:col-span-4 brand-gradient p-6 rounded-2xl text-white brand-shadow">
            <div className="flex justify-between items-start mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-2">סה״כ בדיקות</p>
                <h3 className="text-5xl font-extrabold tracking-tight font-headline leading-none">{s.totalTests || 0}</h3>
              </div>
              <div className="bg-white/20 p-2.5 rounded-xl">
                <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>biotech</span>
              </div>
            </div>
            <div className="flex items-center gap-4 pt-4 border-t border-white/20">
              <div className="flex items-center gap-1.5 text-xs font-semibold opacity-90">
                <span className="material-symbols-outlined text-sm">calendar_month</span>
                {s.days || 0} ימי עבודה
              </div>
              {s.expenses > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-semibold opacity-90">
                  <span className="material-symbols-outlined text-sm">receipt_long</span>
                  {(s.expenses || 0).toFixed(0)} ₪ הוצאות
                </div>
              )}
            </div>
          </div>

          {/* KM */}
          <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-100 group hover:shadow-card-hover transition-shadow duration-200">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-brand-purple text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>directions_car</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">נסועה בק״מ</p>
            <div className="text-2xl font-bold text-slate-900 font-headline">{(s.kilometers || 0).toFixed(0)} <span className="text-sm font-normal text-slate-400">ק״מ</span></div>
          </div>

          {/* Expenses */}
          <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-100 hover:shadow-card-hover transition-shadow duration-200">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-red-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">הוצאות</p>
            <div className="text-2xl font-bold text-red-500 font-headline">{(s.expenses || 0).toFixed(0)} <span className="text-sm font-normal text-slate-400">₪</span></div>
          </div>

          {/* Office */}
          <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-100 hover:shadow-card-hover transition-shadow duration-200">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-amber-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>corporate_fare</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">משרד</p>
            <div className="text-2xl font-bold text-slate-900 font-headline">{(s.office_hours || 0).toFixed(0)} <span className="text-sm font-normal text-slate-400">שעות</span></div>
          </div>

          {/* Screening */}
          <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-100 hover:shadow-card-hover transition-shadow duration-200">
            <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-sky-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>medical_services</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">סקר</p>
            <div className="text-2xl font-bold text-slate-900 font-headline">{(s.screening_tests || 0) + (s.mixed_screening_tests || 0)}</div>
          </div>

          {/* Insurance */}
          <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-100 hover:shadow-card-hover transition-shadow duration-200">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-emerald-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>syringe</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">ביטוח</p>
            <div className="text-2xl font-bold text-slate-900 font-headline">{s.insurance_tests || 0}</div>
          </div>

          {/* Partial */}
          <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-100 hover:shadow-card-hover transition-shadow duration-200">
            <div className="w-9 h-9 rounded-xl bg-fuchsia-50 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-fuchsia-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>science</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">חלקי</p>
            <div className="text-2xl font-bold text-slate-900 font-headline">{s.partial_tests || 0}</div>
          </div>
        </div>
      </section>

      {/* Daily Entries */}
      <section>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold text-on-background tracking-tight mb-5 font-headline">
          <span className="material-symbols-outlined text-brand-purple" style={{ fontVariationSettings: "'FILL' 1" }}>event_note</span>
          רישומים יומיים
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {entries.length === 0 ? (
            <div className="col-span-2 flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <span className="material-symbols-outlined text-5xl opacity-30">event_busy</span>
              <p className="text-sm font-medium">אין רישומים לחודש זה</p>
              <button
                onClick={() => navigate('/entry')}
                className="mt-1 text-xs font-semibold text-brand-purple border border-brand-purple/30 bg-purple-50 px-4 py-2 rounded-full hover:bg-purple-100 transition-colors"
              >
                הוסף רישום ראשון
              </button>
            </div>
          ) : [...entries].sort((a, b) => b.date.localeCompare(a.date)).map(e => {
            const [y, m, d] = e.date.split('-');
            const monthName = new Date(y, m - 1).toLocaleString('he-IL', { month: 'short' });
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
                          {tests} {tests === 1 ? 'בדיקה' : 'בדיקות'}
                        </span>
                      )}
                      {tests > 0 && e.kilometers > 0 && <span className="opacity-40">·</span>}
                      {e.kilometers > 0 && (
                        <span className="flex items-center gap-0.5">
                          <span className="material-symbols-outlined leading-none" style={{ fontSize: 12 }}>route</span>
                          {e.kilometers} ק״מ
                        </span>
                      )}
                      {tests === 0 && e.kilometers === 0 && (
                        <span className="flex items-center gap-0.5 italic opacity-60">אין נתונים</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    title="עריכה"
                    className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-brand-purple hover:bg-purple-50 rounded-xl transition-all"
                    onClick={() => navigate(`/entry/${e.date}`)}
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    title="מחיקה"
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
        className="lg:hidden fixed bottom-28 left-6 w-14 h-14 brand-gradient text-white rounded-full brand-shadow flex items-center justify-center active:scale-90 transition-transform z-40"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>

      {showRecapModal && (
        <DeviceRecapModal
          title="סיכום ציוד שבועי"
          subtitle="אנא אשר אילו מכשירים ברשותך השבוע כדי להמשיך."
          onSubmitted={handleRecapSubmitted}
        />
      )}

    </main>
  );
}
