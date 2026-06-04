import { useState, useEffect } from 'react';
import api from '../api.js';

const CATEGORIES = [
  { id: 'insurance', label: 'בדיקות ביטוח' },
  { id: 'screening', label: 'בדיקות סקר' },
];

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
      title="Copy"
    >
      <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: copied ? "'FILL' 1" : "'FILL' 0" }}>
        {copied ? 'check' : 'content_copy'}
      </span>
    </button>
  );
}

export default function PortalPage() {
  const [creds, setCreds] = useState([]);
  const [faqItems, setFaqItems] = useState({ insurance: [], screening: [] });
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [tab, setTab] = useState('apps');

  useEffect(() => {
    let settled = 0;
    const done = () => { if (++settled === 3) setLoading(false); };

    api.get('/portal/credentials').then(r => setCreds(r.data)).catch(() => {}).finally(done);
    api.get('/faq').then(r => setFaqItems(r.data)).catch(() => {}).finally(done);
    api.get('/contacts').then(r => setContacts(r.data)).catch(() => {}).finally(done);
  }, []);

  function toggle(key) {
    setOpen(prev => (prev === key ? null : key));
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-20 pb-28 px-4">
      <div className="max-w-2xl mx-auto">

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight brand-gradient-text">Portal</h1>
          <p className="text-sm text-slate-400 mt-1">Applications &amp; FAQ</p>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-2 mb-6">
          {[{ id: 'apps', label: 'Apps', icon: 'apps' }, { id: 'faq', label: 'FAQ', icon: 'quiz' }, { id: 'contacts', label: 'Contacts', icon: 'call' }].map(t => (
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
                Applications
              </h2>

              {creds.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 py-8 flex flex-col items-center gap-2 text-slate-400"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <span className="material-symbols-outlined text-3xl opacity-30">apps</span>
                  <p className="text-sm">No applications yet</p>
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
                          <span className="text-[11px] font-semibold text-slate-400 w-20 flex-shrink-0">Username</span>
                          <span className="text-sm text-slate-700 flex-1 font-mono">{cred.username}</span>
                          <CopyButton value={cred.username} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-400 w-20 flex-shrink-0">Password</span>
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
                  Important Contacts
                </h2>
                {contacts.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 py-8 flex flex-col items-center gap-2 text-slate-400"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <span className="material-symbols-outlined text-3xl opacity-30">call</span>
                    <p className="text-sm">No contacts added yet</p>
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
                          Call
                        </a>
                      </div>
                    ))}
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
                    <p className="text-sm">No questions yet</p>
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
          </>
        )}
      </div>
    </div>
  );
}
