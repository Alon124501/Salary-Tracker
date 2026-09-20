import { useState, useRef, useEffect } from 'react';
import { formatDate } from '../utils/date.js';

const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function DatePicker({ value, onChange, placeholder = 'בחר תאריך' }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const selected = value ? new Date(value + 'T00:00:00') : null;

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
    return !!selected && selected.getFullYear() === cursor.year && selected.getMonth() === cursor.month && selected.getDate() === day;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 text-left focus:outline-none focus:ring-2 focus:ring-brand-purple/30 bg-white"
      >
        {value ? formatDate(value) : <span className="text-slate-300">{placeholder}</span>}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 bg-white rounded-2xl border border-slate-100 shadow-lg p-3 w-64">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 active:scale-90"
            >
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
            <span className="text-sm font-bold text-slate-800">{MONTHS[cursor.month]} {cursor.year}</span>
            <button
              type="button"
              onClick={nextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 active:scale-90"
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-[10px] font-bold text-slate-300 text-center">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((cell, i) => (
              <div key={i} className="flex items-center justify-center">
                <button
                  type="button"
                  disabled={!cell.cur}
                  onClick={() => cell.cur && selectDay(cell.day)}
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-semibold transition-all active:scale-90
                    ${!cell.cur ? 'text-slate-200 cursor-default' : ''}
                    ${cell.cur && !isSelected(cell.day) ? 'text-slate-700 hover:bg-slate-100' : ''}
                    ${isSelected(cell.day) ? 'brand-gradient text-white' : ''}
                  `}
                >
                  {cell.day}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
