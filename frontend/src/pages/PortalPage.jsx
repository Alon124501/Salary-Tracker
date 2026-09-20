import { useState } from 'react';
import api from '../api.js';
import { useFetch } from '../hooks/useFetch.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatDate } from '../utils/date.js';
import DatePicker from '../components/DatePicker.jsx';

const CATEGORIES = [
  { id: 'insurance', label: 'בדיקות ביטוח' },
  { id: 'screening', label: 'בדיקות סקר' },
];

const TIME_OFF_CATEGORIES = [
  { id: 'vacation', label: 'חופשה' },
  { id: 'sick', label: 'מחלה' },
];

const TIME_OFF_STATUS = {
  pending:  { label: 'ממתין',  className: 'bg-amber-50 text-amber-600' },
  approved: { label: 'אושר',   className: 'bg-emerald-50 text-emerald-600' },
  rejected: { label: 'נדחה',   className: 'bg-rose-50 text-rose-600' },
};

function renderAnswer(text) {
  const lines = text.split('\n');
  const segments = [];
  let bullets = [];

  for (const line of lines) {
    const isBullet = /^[-•]\s?/.test(line.trim());
    if (isBullet) {
      bullets.push(line.replace(/^[-•]\s?/, '').trim());
    } else {
      if (bullets.length) { segments.push({ type: 'bullets', items: bullets }); bullets = []; }
      if (line.trim()) segments.push({ type: 'text', value: line });
      else segments.push({ type: 'spacer' });
    }
  }
  if (bullets.length) segments.push({ type: 'bullets', items: bullets });

  return segments.map((seg, i) => {
    if (seg.type === 'bullets')
      return (
        <ul key={i} className="list-disc list-inside space-y-1 text-slate-500 text-sm leading-relaxed">
          {seg.items.map((item, j) => <li key={j}>{item}</li>)}
        </ul>
      );
    if (seg.type === 'spacer') return <div key={i} className="h-2" />;
    return <p key={i} className="text-slate-500 text-sm leading-relaxed">{seg.value}</p>;
  });
}

function getYoutubeEmbed(url) {
  const m = url?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

function getVimeoEmbed(url) {
  const m = url?.match(/vimeo\.com\/(\d+)/);
  return m ? `https://player.vimeo.com/video/${m[1]}` : null;
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={copy}
      className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-purple hover:bg-purple-50 transition-all active:scale-95"
      title="העתק"
    >
      <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: copied ? "'FILL' 1" : "'FILL' 0" }}>
        {copied ? 'check' : 'content_copy'}
      </span>
    </button>
  );
}

export default function PortalPage() {
  const showToast = useToast();
  const [open, setOpen] = useState(null);
  const [tab, setTab] = useState('apps');

  const { data: creds = [],                                    loading: credsLoading  } = useFetch('/portal/credentials');
  const { data: faqItems = { insurance: [], screening: [] },   loading: faqLoading    } = useFetch('/faq');
  const { data: contacts = [],                                  loading: contactsLoading } = useFetch('/contacts');
  const loading = credsLoading || faqLoading || contactsLoading;

  // Equipment order state
  const { data: eqCatalog = [], loading: eqCatalogLoading } =
    useFetch('/equipment/catalog', { enabled: tab === 'equipment' });
  const [eqQty, setEqQty] = useState({});
  const [eqNeededDate, setEqNeededDate] = useState('');
  const [eqSubmitting, setEqSubmitting] = useState(false);

  // Tutorial videos state
  const { data: videos = [], loading: videosLoading } =
    useFetch('/tutorials', { enabled: tab === 'videos' });
  const [videoSearch, setVideoSearch] = useState('');
  const [videoModal, setVideoModal] = useState(null);
  const filteredVideos = videos.filter(v => {
    const q = videoSearch.trim().toLowerCase();
    if (!q) return true;
    return v.title.toLowerCase().includes(q) || (v.device_name || '').toLowerCase().includes(q);
  });

  // Time-off request state
  const { data: myTimeOff = [], loading: myTimeOffLoading, reload: reloadMyTimeOff } =
    useFetch('/timeoff/requests/mine', { enabled: tab === 'timeoff' });
  const [toCategory, setToCategory] = useState('vacation');
  const [toStart, setToStart] = useState('');
  const [toEnd, setToEnd] = useState('');
  const [toNote, setToNote] = useState('');
  const [toSubmitting, setToSubmitting] = useState(false);

  async function submitOrder() {
    const items = eqCatalog
      .filter(item => (eqQty[item.id] || 0) > 0)
      .map(item => ({ catalog_id: item.id, name: item.name, quantity: eqQty[item.id] }));
    if (items.length === 0 || !eqNeededDate) return;
    setEqSubmitting(true);
    try {
      await api.post('/equipment/orders', { items, needed_date: eqNeededDate });
      setEqQty({});
      setEqNeededDate('');
      showToast('ההזמנה נשלחה', 'success');
    } catch (err) { showToast(err?.response?.data?.error || 'שליחת ההזמנה נכשלה'); }
    finally { setEqSubmitting(false); }
  }

  async function submitTimeOff() {
    if (!toStart || !toEnd) return;
    setToSubmitting(true);
    try {
      await api.post('/timeoff/requests', { category: toCategory, start_date: toStart, end_date: toEnd, note: toNote });
      setToStart('');
      setToEnd('');
      setToNote('');
      showToast('הבקשה נשלחה', 'success');
      reloadMyTimeOff();
    } catch (err) { showToast(err?.response?.data?.error || 'שליחת הבקשה נכשלה'); }
    finally { setToSubmitting(false); }
  }

  async function cancelTimeOff(id) {
    try {
      await api.delete(`/timeoff/requests/${id}`);
      showToast('הבקשה בוטלה', 'success');
      reloadMyTimeOff();
    } catch (err) { showToast(err?.response?.data?.error || 'ביטול הבקשה נכשל'); }
  }

  function toggle(key) {
    setOpen(prev => (prev === key ? null : key));
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-20 pb-28 px-4">
      <div className="max-w-2xl mx-auto">

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight brand-gradient-text">פורטל</h1>
          <p className="text-sm text-slate-400 mt-1">אפליקציות ושאלות נפוצות</p>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[{ id: 'apps', label: 'אפליקציות', icon: 'apps' }, { id: 'faq', label: 'שאלות נפוצות', icon: 'quiz' }, { id: 'contacts', label: 'אנשי קשר', icon: 'call' }, { id: 'equipment', label: 'ציוד', icon: 'inventory' }, { id: 'videos', label: 'סרטונים', icon: 'smart_display' }, { id: 'timeoff', label: 'ימי חופש / מחלה', icon: 'event_busy' }].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                tab === t.id ? 'brand-gradient text-white' : 'bg-white border border-slate-200 text-slate-500'
              }`}
              style={tab === t.id ? { boxShadow: '0 4px 14px rgba(139,53,217,0.25)' } : {}}
            >
              <span className="material-symbols-outlined text-[16px]"
                style={{ fontVariationSettings: tab === t.id ? "'FILL' 1" : "'FILL' 0" }}>
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
          </div>
        ) : (
          <>
            {/* ── Applications ── */}
            {tab === 'apps' && <div className="mb-8">
              <h2 className="text-base font-extrabold text-slate-700 mb-3 px-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-brand-purple text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>apps</span>
                אפליקציות
              </h2>

              {creds.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 py-8 flex flex-col items-center gap-2 text-slate-400"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <span className="material-symbols-outlined text-3xl opacity-30">apps</span>
                  <p className="text-sm">אין עדיין אפליקציות</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {creds.map(cred => (
                    <div
                      key={cred.id}
                      className="bg-white rounded-2xl border border-slate-100 px-5 py-4"
                      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {cred.image_signed_url ? (
                          <img src={cred.image_signed_url} alt={cred.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-slate-400 text-lg">apps</span>
                          </div>
                        )}
                        <p className="font-bold text-slate-800 text-sm">{cred.name}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-400 w-20 flex-shrink-0">שם משתמש</span>
                          <span className="text-sm text-slate-700 flex-1 font-mono">{cred.username}</span>
                          <CopyButton value={cred.username} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-400 w-20 flex-shrink-0">סיסמה</span>
                          <span className="text-sm text-slate-700 flex-1 font-mono">{cred.password}</span>
                          <CopyButton value={cred.password} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>}

            {/* ── Contacts ── */}
            {tab === 'contacts' && (
              <div className="mb-8">
                <h2 className="text-base font-extrabold text-slate-700 mb-3 px-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-brand-purple text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>call</span>
                  אנשי קשר חשובים
                </h2>
                {contacts.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 py-8 flex flex-col items-center gap-2 text-slate-400"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <span className="material-symbols-outlined text-3xl opacity-30">call</span>
                    <p className="text-sm">עדיין לא נוספו אנשי קשר</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {contacts.map(c => (
                      <div key={c.id} className="bg-white rounded-2xl border border-slate-100 px-4 py-3.5 flex items-center gap-3"
                        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(c.name[0] || '?').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                          {c.title && <p className="text-xs text-slate-400 mt-0.5">{c.title}</p>}
                          <p className="text-xs text-slate-500 mt-0.5">{c.phone}</p>
                        </div>
                        <a href={`tel:${c.phone}`}
                          className="flex items-center gap-1.5 text-sm font-bold text-white brand-gradient px-4 py-2 rounded-xl active:scale-95 transition-all flex-shrink-0"
                          style={{ boxShadow: '0 2px 8px rgba(139,53,217,0.25)' }}>
                          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>call</span>
                          התקשר
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Equipment Order ── */}
            {tab === 'equipment' && (
              <div className="mb-8">
                <h2 className="text-base font-extrabold text-slate-700 mb-3 px-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-brand-purple text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>inventory</span>
                  הזמנת ציוד
                </h2>
                {eqCatalogLoading ? (
                  <div className="flex justify-center py-10">
                    <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span>
                  </div>
                ) : eqCatalog.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 py-10 flex flex-col items-center gap-2 text-slate-400"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <span className="material-symbols-outlined text-3xl opacity-30">inventory</span>
                    <p className="text-sm">אין פריטים זמינים</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-3 mb-5">
                      {eqCatalog.map(item => (
                        <div key={item.id} className="bg-white rounded-2xl border border-slate-100 px-4 py-3.5 flex items-center justify-between"
                          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                          <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEqQty(q => ({ ...q, [item.id]: Math.max(0, (q[item.id] || 0) - 1) }))}
                              className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-bold active:scale-95 transition-all"
                            >−</button>
                            <span className="w-8 text-center text-sm font-bold text-slate-800">{eqQty[item.id] || 0}</span>
                            <button
                              onClick={() => setEqQty(q => ({ ...q, [item.id]: (q[item.id] || 0) + 1 }))}
                              className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-bold active:scale-95 transition-all"
                            >+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 px-4 py-3.5 mb-5"
                      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      <label className="text-sm font-semibold text-slate-800 block mb-2">תאריך נדרש *</label>
                      <input
                        type="date"
                        value={eqNeededDate}
                        onChange={e => setEqNeededDate(e.target.value)}
                        required
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
                      />
                    </div>
                    <button
                      onClick={submitOrder}
                      disabled={eqSubmitting || Object.values(eqQty).every(v => !v) || !eqNeededDate}
                      className="w-full py-3 rounded-2xl text-sm font-bold text-white brand-gradient active:scale-[0.98] transition-all disabled:opacity-40"
                      style={{ boxShadow: '0 4px 14px rgba(139,53,217,0.3)' }}
                    >
                      {eqSubmitting ? 'שולח...' : 'שלח הזמנה'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── Time off ── */}
            {tab === 'timeoff' && (
              <div className="mb-8">
                <h2 className="text-base font-extrabold text-slate-700 mb-3 px-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-brand-purple text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>event_busy</span>
                  בקשת ימי חופש
                </h2>

                <div className="bg-white rounded-2xl border border-slate-100 px-4 py-4 mb-5"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <label className="text-sm font-semibold text-slate-800 block mb-2">סוג</label>
                  <div className="flex gap-2 mb-4">
                    {TIME_OFF_CATEGORIES.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setToCategory(c.id)}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                          toCategory === c.id ? 'brand-gradient text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-3 mb-4">
                    <div className="flex-1">
                      <label className="text-sm font-semibold text-slate-800 block mb-2">מתאריך *</label>
                      <DatePicker value={toStart} onChange={setToStart} />
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-semibold text-slate-800 block mb-2">עד תאריך *</label>
                      <DatePicker value={toEnd} onChange={setToEnd} />
                    </div>
                  </div>

                  <label className="text-sm font-semibold text-slate-800 block mb-2">הערה (לא חובה)</label>
                  <textarea
                    value={toNote}
                    onChange={e => setToNote(e.target.value)}
                    maxLength={500}
                    rows={3}
                    dir="rtl"
                    placeholder="פרטים נוספים..."
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 resize-none"
                  />
                </div>

                <button
                  onClick={submitTimeOff}
                  disabled={toSubmitting || !toStart || !toEnd}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-white brand-gradient active:scale-[0.98] transition-all disabled:opacity-40 mb-6"
                  style={{ boxShadow: '0 4px 14px rgba(139,53,217,0.3)' }}
                >
                  {toSubmitting ? 'שולח...' : 'שלח בקשה'}
                </button>

                <h3 className="text-sm font-extrabold text-slate-700 mb-3 px-1">הבקשות שלי</h3>
                {myTimeOffLoading ? (
                  <div className="flex justify-center py-10">
                    <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span>
                  </div>
                ) : myTimeOff.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 py-8 flex flex-col items-center gap-2 text-slate-400"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <span className="material-symbols-outlined text-3xl opacity-30">event_busy</span>
                    <p className="text-sm">אין עדיין בקשות</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {myTimeOff.map(r => {
                      const st = TIME_OFF_STATUS[r.status] || TIME_OFF_STATUS.pending;
                      const catLabel = TIME_OFF_CATEGORIES.find(c => c.id === r.category)?.label || r.category;
                      return (
                        <div key={r.id} className="bg-white rounded-2xl border border-slate-100 px-4 py-3.5"
                          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-sm font-bold text-slate-800">{catLabel}</p>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${st.className}`}>{st.label}</span>
                          </div>
                          <p className="text-xs text-slate-500">{formatDate(r.start_date)} — {formatDate(r.end_date)}</p>
                          {r.note && <p className="text-xs text-slate-400 mt-1.5">{r.note}</p>}
                          {r.status === 'pending' && (
                            <button
                              onClick={() => cancelTimeOff(r.id)}
                              className="mt-2.5 text-xs font-bold text-rose-500 active:scale-95 transition-all"
                            >
                              ביטול בקשה
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── FAQ ── */}
            {tab === 'faq' && CATEGORIES.map(cat => (
              <div key={cat.id} className="mb-8">
                <h2 className="text-base font-extrabold text-slate-700 mb-3 px-1" dir="rtl">{cat.label}</h2>

                {faqItems[cat.id].length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 py-8 flex flex-col items-center gap-2 text-slate-400"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <span className="material-symbols-outlined text-3xl opacity-30">quiz</span>
                    <p className="text-sm">אין עדיין שאלות</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {faqItems[cat.id].map(item => {
                      const isOpen = open === item.id;
                      return (
                        <div
                          key={item.id}
                          className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
                          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                        >
                          <button
                            onClick={() => toggle(item.id)}
                            className="w-full flex items-center justify-between px-5 py-4 text-left gap-3"
                          >
                            <span className="text-sm font-semibold text-slate-700 flex-1" dir="rtl">{item.question}</span>
                            <span
                              className="material-symbols-outlined text-[20px] flex-shrink-0 transition-transform duration-200 text-slate-400"
                              style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            >expand_more</span>
                          </button>
                          {isOpen && (
                            <div className="px-5 pb-4 border-t border-slate-50">
                              <div className="pt-3 space-y-1.5" dir="rtl">
                                {renderAnswer(item.answer)}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* ── Tutorial Videos ── */}
            {tab === 'videos' && (
              <div className="mb-8">
                <h2 className="text-base font-extrabold text-slate-700 mb-3 px-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-brand-purple text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>smart_display</span>
                  סרטוני הדרכה
                </h2>

                <div className="relative mb-4">
                  <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-lg">search</span>
                  <input
                    value={videoSearch}
                    onChange={e => setVideoSearch(e.target.value)}
                    placeholder="חיפוש לפי כותרת או מכשיר..."
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
                  />
                </div>

                {videosLoading ? (
                  <div className="flex justify-center py-10">
                    <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span>
                  </div>
                ) : filteredVideos.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 py-8 flex flex-col items-center gap-2 text-slate-400"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <span className="material-symbols-outlined text-3xl opacity-30">smart_display</span>
                    <p className="text-sm">{videos.length === 0 ? 'אין עדיין סרטוני הדרכה' : 'אין תוצאות'}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {filteredVideos.map(v => (
                      <button
                        key={v.id}
                        onClick={() => setVideoModal(v)}
                        className="bg-white rounded-2xl border border-slate-100 px-4 py-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-all"
                        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-brand-purple text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{v.title}</p>
                          {v.device_name && <p className="text-xs text-slate-400 mt-0.5">{v.device_name}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {videoModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setVideoModal(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-sm flex-1">{videoModal.title}</h3>
              <button onClick={() => setVideoModal(null)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {videoModal.source_type === 'upload' ? (
              <video controls src={videoModal.video_signed_url} className="w-full rounded-xl bg-black" />
            ) : (() => {
              const embed = getYoutubeEmbed(videoModal.external_url) || getVimeoEmbed(videoModal.external_url);
              return embed ? (
                <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingTop: '56.25%' }}>
                  <iframe src={embed} className="absolute inset-0 w-full h-full" allowFullScreen title={videoModal.title} />
                </div>
              ) : (
                <a
                  href={videoModal.external_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 text-sm font-bold text-white brand-gradient px-4 py-3 rounded-xl active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>open_in_new</span>
                  פתח קישור
                </a>
              );
            })()}

            {videoModal.description && (
              <p className="text-sm text-slate-500 mt-3 leading-relaxed">{videoModal.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
