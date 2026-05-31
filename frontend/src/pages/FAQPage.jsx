import { useState, useEffect } from 'react';
import api from '../api.js';

const CATEGORIES = [
  { id: 'insurance', label: 'בדיקות ביטוח' },
  { id: 'screening', label: 'בדיקות סקר' },
];

export default function FAQPage() {
  const [items, setItems] = useState({ insurance: [], screening: [] });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.get('/faq').then(({ data }) => setItems(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function toggle(key) {
    setOpen(prev => (prev === key ? null : key));
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-20 pb-28 px-4">
      <div className="max-w-2xl mx-auto">

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight brand-gradient-text">FAQ</h1>
          <p className="text-sm text-slate-400 mt-1">שאלות נפוצות</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
          </div>
        ) : (
          CATEGORIES.map(cat => (
            <div key={cat.id} className="mb-8">
              <h2 className="text-base font-extrabold text-slate-700 mb-3 px-1" dir="rtl">{cat.label}</h2>

              {items[cat.id].length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 py-8 flex flex-col items-center gap-2 text-slate-400"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <span className="material-symbols-outlined text-3xl opacity-30">quiz</span>
                  <p className="text-sm">No questions yet</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {items[cat.id].map(item => {
                    const key = item.id;
                    const isOpen = open === key;
                    return (
                      <div
                        key={key}
                        className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
                        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                      >
                        <button
                          onClick={() => toggle(key)}
                          className="w-full flex items-center justify-between px-5 py-4 text-left gap-3"
                        >
                          <span className="text-sm font-semibold text-slate-700 flex-1" dir="rtl">{item.question}</span>
                          <span
                            className="material-symbols-outlined text-[20px] flex-shrink-0 transition-transform duration-200 text-slate-400"
                            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                          >
                            expand_more
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-4 text-sm text-slate-500 leading-relaxed border-t border-slate-50">
                            <p className="pt-3" dir="rtl">{item.answer}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
