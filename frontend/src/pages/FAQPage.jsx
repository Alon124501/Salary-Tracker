import { useState } from 'react';

const faqs = [
  {
    question: 'How do I add a new shift entry?',
    answer: 'Tap the "Entry" button in the navigation bar. Fill in the date, shift type, and hours worked, then submit. You can also attach receipt photos for food or parking expenses.',
  },
  {
    question: 'How are receipts handled?',
    answer: 'When adding or editing an entry, you can upload photos of food and parking receipts. These are stored securely and counted toward your expense reimbursements.',
  },
  {
    question: 'How is my salary calculated?',
    answer: 'Your salary is calculated based on the shift rules configured in Settings — including base hourly rate, overtime thresholds, and any bonuses or allowances.',
  },
  {
    question: 'Can I edit or delete a past entry?',
    answer: 'Yes. Open the Dashboard, find the entry you want to change, and tap the edit icon. You can update any field or delete the entry entirely.',
  },
  {
    question: 'Where can I see my monthly summary?',
    answer: 'The Stats page shows a breakdown of your earnings, hours, and expenses by month. Use the month selector at the top to navigate between periods.',
  },
  {
    question: 'How do I update my profile or password?',
    answer: 'Go to Settings (the icon in the top-right corner of the header) to edit your profile details or change your password.',
  },
];

export default function FAQPage() {
  const [open, setOpen] = useState(null);

  function toggle(i) {
    setOpen(prev => (prev === i ? null : i));
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-20 pb-28 px-4">
      <div className="max-w-2xl mx-auto">

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight brand-gradient-text">FAQ</h1>
          <p className="text-sm text-slate-400 mt-1">Frequently asked questions</p>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            >
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left gap-3"
              >
                <span className="text-sm font-semibold text-slate-700">{faq.question}</span>
                <span
                  className="material-symbols-outlined text-[20px] flex-shrink-0 transition-transform duration-200 text-slate-400"
                  style={{ transform: open === i ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  expand_more
                </span>
              </button>
              {open === i && (
                <div className="px-5 pb-4 text-sm text-slate-500 leading-relaxed border-t border-slate-50">
                  <p className="pt-3">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
