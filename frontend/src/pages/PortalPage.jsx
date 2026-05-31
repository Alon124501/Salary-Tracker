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
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/portal/credentials').then(r => r.data),
      api.get('/faq').then(r => r.data),
    ]).then(([c, f]) => {
      setCreds(c);
      setFaqItems(f);
    }).catch(() => {}).finally(() => setLoading(false));
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

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
          </div>
        ) : (
          <>
            {/* ── Applications ── */}
            <div className="mb-8">
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
                      <p className="font-bold text-slate-800 text-sm mb-3">{cred.name}</p>
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
            </div>

            {/* ── FAQ ── */}
            {CATEGORIES.map(cat => (
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
