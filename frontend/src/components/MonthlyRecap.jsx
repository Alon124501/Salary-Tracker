import { useState } from 'react';
import AnimatedModal from './AnimatedModal.jsx';

export function monthLabel(month) {
  return new Date(`${month}-15T12:00:00`).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
}

const num = n => (n ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 1 });
const ils = n => `₪${num(n)}`;
const pct = n => (n === null || n === undefined ? '—' : `${num(n)}%`);

// good: 'up' = increase is good (green), 'down' = increase is bad (red), null = neutral
const STRIP = [
  { key: 'tests',           label: 'בדיקות',          fmt: num, good: 'up',   icon: 'labs' },
  { key: 'cancellations',   label: 'ביטולים',          fmt: num, good: 'down', icon: 'event_busy' },
  { key: 'cancelPct',       label: 'אחוז ביטולים',     fmt: pct, good: 'down', icon: 'percent' },
  { key: 'activeEmployees', label: 'עובדים פעילים',    fmt: num, good: 'up',   icon: 'groups' },
  { key: 'days',            label: 'ימי עבודה',        fmt: num, good: 'up',   icon: 'calendar_month' },
  { key: 'km',              label: 'ק״מ',              fmt: num, good: null,   icon: 'directions_car' },
  { key: 'food',            label: 'הוצאות אוכל',      fmt: ils, good: null,   icon: 'restaurant' },
  { key: 'parking',         label: 'הוצאות חניה',      fmt: ils, good: null,   icon: 'local_parking' },
  { key: 'toll',            label: 'כבישי אגרה',       fmt: ils, good: null,   icon: 'toll' },
  { key: 'vacationDays',    label: 'ימי חופשה',        fmt: num, good: null,   icon: 'beach_access' },
  { key: 'sickDays',        label: 'ימי מחלה',         fmt: num, good: null,   icon: 'sick' },
];

const AWARDS = [
  { key: 'mostTests',    title: 'שיאן הבדיקות',             icon: 'emoji_events', fmt: v => `${num(v)} בדיקות` },
  { key: 'testsPerDay',  title: 'הכי הרבה בדיקות ליום',      icon: 'speed',        fmt: v => `${num(v)} ליום`, rule: r => `מינימום ${r.testsPerDayMinDays} ימי עבודה` },
  { key: 'mostKm',       title: 'הכי הרבה ק״מ',              icon: 'route',        fmt: v => `${num(v)} ק״מ` },
  { key: 'mostDays',     title: 'הכי הרבה ימי עבודה',         icon: 'event_available', fmt: v => `${num(v)} ימים` },
  { key: 'improvement',  title: 'השיפור הגדול ביותר',         icon: 'trending_up',  fmt: v => `+${num(v)} בדיקות מהחודש הקודם` },
  { key: 'lowestCancel', title: 'הכי מעט ביטולים',            icon: 'verified',     fmt: pct, rule: r => `מינימום ${r.cancelMinVolume} בדיקות+ביטולים` },
];

const ATTENTION_SINGLE = [
  { key: 'highestCancel', title: 'אחוז ביטולים גבוה ביותר', icon: 'cancel',        fmt: pct, rule: r => `מינימום ${r.cancelMinVolume} בדיקות+ביטולים` },
  { key: 'mostSick',      title: 'הכי הרבה ימי מחלה',       icon: 'sick',          fmt: v => `${num(v)} ימים` },
  { key: 'biggestDrop',   title: 'הירידה הגדולה ביותר',      icon: 'trending_down', fmt: v => `${num(v)} בדיקות מהחודש הקודם` },
];

const ATTENTION_LISTS = [
  { key: 'foodOver',    title: 'חריגה בהוצאות אוכל',    icon: 'restaurant', fmt: v => `חריגה ${ils(v)}` },
  { key: 'tollMissing', title: 'כביש אגרה ללא קבלה',     icon: 'receipt_long', fmt: v => `${num(v)} ימים` },
  { key: 'zeroEntries', title: 'ללא דיווחים החודש',      icon: 'block',      fmt: () => null },
];

const COLUMNS = [
  { key: 'name',          label: 'עובד' },
  { key: 'tests',         label: 'בדיקות',   fmt: num },
  { key: 'cancellations', label: 'ביטולים',  fmt: num },
  { key: 'cancelPct',     label: '% ביטולים', fmt: pct },
  { key: 'days',          label: 'ימים',     fmt: num },
  { key: 'deltaTests',    label: 'שינוי',    fmt: v => (v > 0 ? `+${num(v)}` : num(v)) },
  { key: 'km',            label: 'ק״מ',      fmt: num },
  { key: 'officeHours',   label: 'שעות משרד', fmt: num },
  { key: 'food',          label: 'אוכל',     fmt: ils },
  { key: 'parking',       label: 'חניה',     fmt: ils },
  { key: 'toll',          label: 'אגרה',     fmt: ils },
  { key: 'vacationDays',  label: 'חופשה',    fmt: num },
  { key: 'sickDays',      label: 'מחלה',     fmt: num },
];

function Delta({ cur, prev, good }) {
  if (cur === null || prev === null || cur === undefined || prev === undefined) return null;
  const diff = Math.round((cur - prev) * 10) / 10;
  if (diff === 0) return <span className="text-[10px] text-slate-400">ללא שינוי</span>;
  const up = diff > 0;
  const color = good === null ? 'text-slate-400' : (up === (good === 'up') ? 'text-emerald-600' : 'text-rose-600');
  return (
    <span className={`text-[10px] font-bold flex items-center ${color}`}>
      <span className="material-symbols-outlined text-sm leading-none">{up ? 'arrow_drop_up' : 'arrow_drop_down'}</span>
      {num(Math.abs(diff))}
    </span>
  );
}

function Card({ tone, icon, title, rule, children }) {
  const toneCls = tone === 'good'
    ? 'bg-emerald-50 text-emerald-600'
    : 'bg-amber-50 text-amber-600';
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${toneCls}`}>
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">{title}</p>
          {rule && <p className="text-[10px] text-slate-400">{rule}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function PersonButton({ person, onOpen }) {
  return (
    <button onClick={() => onOpen(person)} className="font-extrabold text-slate-900 text-sm hover:text-brand-purple underline-offset-2 hover:underline">
      {person.name}
    </button>
  );
}

export default function MonthlyRecap({ data, loadDrilldown }) {
  const [sort, setSort] = useState({ key: 'tests', dir: 'desc' });
  const [drill, setDrill] = useState(null); // { person, days, loading, error }

  async function openPerson(person) {
    setDrill({ person, days: null, loading: true, error: null });
    try {
      const days = await loadDrilldown(person.id);
      setDrill({ person, days, loading: false, error: null });
    } catch {
      setDrill({ person, days: null, loading: false, error: 'שגיאה בטעינת הנתונים' });
    }
  }

  function toggleSort(key) {
    setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));
  }

  const rows = [...data.employees].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = typeof av === 'string' ? av.localeCompare(bv, 'he') : av - bv;
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  const awards = AWARDS.filter(a => data.awards[a.key]);
  const singles = ATTENTION_SINGLE.filter(a => data.attention[a.key]);
  const lists = ATTENTION_LISTS.filter(a => data.attention[a.key]?.length);

  return (
    <div className="space-y-5">
      {data.partial && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl px-4 py-3 text-sm font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">hourglass_top</span>
          חלקי – החודש טרם הסתיים
        </div>
      )}

      {/* Company strip */}
      <section>
        <p className="text-xs font-bold text-slate-500 mb-2">סיכום החברה · לעומת {monthLabel(data.prevMonth)}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {STRIP.map(m => (
            <div key={m.key} className="bg-white rounded-2xl border border-slate-100 px-3 py-3" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="material-symbols-outlined text-base">{m.icon}</span>
                <span className="text-[11px] font-semibold">{m.label}</span>
              </div>
              <div className="flex items-end justify-between gap-1 mt-1">
                <span className="text-lg font-extrabold text-slate-900">{m.fmt(data.company[m.key])}</span>
                <Delta cur={data.company[m.key]} prev={data.companyPrev[m.key]} good={m.good} />
              </div>
              {m.key === 'tests' && (
                <p className="text-[10px] text-slate-400 mt-1">
                  ביטוח {num(data.company.insurance)} · סקר {num(data.company.screening)} · משולב {num(data.company.mixed)} · חלקי {num(data.company.partial)}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Highlights */}
      <section>
        <h2 className="text-base font-extrabold text-slate-900 mb-2">🏆 הישגים</h2>
        {awards.length === 0 ? (
          <p className="text-sm text-slate-400">אין עדיין נתונים לחודש זה</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {awards.map(a => {
              const w = data.awards[a.key];
              return (
                <Card key={a.key} tone="good" icon={a.icon} title={a.title} rule={a.rule?.(data.rules)}>
                  <div className="flex flex-wrap gap-x-2">
                    {w.people.map(p => <PersonButton key={p.id} person={p} onOpen={openPerson} />)}
                  </div>
                  <p className="text-xs text-emerald-600 font-bold mt-0.5">{a.fmt(w.value)}</p>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Attention */}
      <section>
        <h2 className="text-base font-extrabold text-slate-900 mb-2">⚠️ לתשומת לב</h2>
        {singles.length === 0 && lists.length === 0 ? (
          <p className="text-sm text-slate-400">אין נקודות לתשומת לב 🎉</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {singles.map(a => {
              const w = data.attention[a.key];
              return (
                <Card key={a.key} tone="warn" icon={a.icon} title={a.title} rule={a.rule?.(data.rules)}>
                  <div className="flex flex-wrap gap-x-2">
                    {w.people.map(p => <PersonButton key={p.id} person={p} onOpen={openPerson} />)}
                  </div>
                  <p className="text-xs text-amber-600 font-bold mt-0.5">{a.fmt(w.value)}</p>
                </Card>
              );
            })}
            {lists.map(a => (
              <Card key={a.key} tone="warn" icon={a.icon} title={a.title}>
                <ul className="space-y-1">
                  {data.attention[a.key].map(p => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <PersonButton person={p} onOpen={openPerson} />
                      {a.fmt(p.value) && <span className="text-xs text-amber-600 font-bold">{a.fmt(p.value)}</span>}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Employee table */}
      <section>
        <h2 className="text-base font-extrabold text-slate-900 mb-1">כל העובדים</h2>
        <p className="text-[11px] text-slate-400 mb-2">לחצו על כותרת למיון · על שורה לפירוט יומי</p>
        <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto" style={{ touchAction: 'pan-x pan-y' }}>
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-[11px] text-slate-500 font-semibold">
                {COLUMNS.map((c, i) => (
                  <th key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className={`px-3 py-2.5 cursor-pointer select-none whitespace-nowrap ${i === 0 ? 'sticky right-0 z-10 bg-slate-50 text-right min-w-[120px]' : 'text-center'}`}>
                    {c.label}
                    {sort.key === c.key && (
                      <span className="material-symbols-outlined text-xs align-middle">{sort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const bg = i % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                return (
                  <tr key={r.id} onClick={() => openPerson(r)} className={`${bg} border-b border-slate-100 cursor-pointer hover:bg-purple-50/50`}>
                    {COLUMNS.map((c, ci) => (
                      <td key={c.key}
                        className={`px-3 py-2.5 whitespace-nowrap ${ci === 0 ? `sticky right-0 z-10 ${bg} font-semibold text-slate-800` : 'text-center text-slate-600'} ${
                          c.key === 'deltaTests' ? (r.deltaTests > 0 ? 'text-emerald-600 font-bold' : r.deltaTests < 0 ? 'text-rose-600 font-bold' : '') : ''}`}>
                        {c.fmt ? c.fmt(r[c.key]) : r[c.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Drill-down */}
      <AnimatedModal open={!!drill} onBackdropClick={() => setDrill(null)} zIndex={50}>
        {drill && (
          <div className="bg-white rounded-3xl flex flex-col w-[min(92vw,640px)] shadow-2xl" style={{ maxHeight: '85vh' }}>
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 flex-shrink-0">
              <div>
                <p className="font-extrabold text-slate-900">{drill.person.name}</p>
                <p className="text-xs text-slate-400">{monthLabel(data.month)} · פירוט יומי</p>
              </div>
              <button onClick={() => setDrill(null)} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="overflow-auto p-3">
              {drill.loading ? (
                <div className="flex justify-center py-10">
                  <span className="material-symbols-outlined text-3xl text-slate-300 animate-spin">progress_activity</span>
                </div>
              ) : drill.error ? (
                <p className="text-sm text-rose-600 text-center py-6">{drill.error}</p>
              ) : drill.days.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">אין דיווחים בחודש זה</p>
              ) : (
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-[11px] text-slate-500 bg-slate-50">
                      {['תאריך', 'בדיקות', 'ביטוח', 'סקר', 'משולב', 'חלקי', 'ביטולים', 'ק״מ', 'שעות', 'אוכל', 'חניה', 'אגרה'].map(h => (
                        <th key={h} className="px-2 py-2 whitespace-nowrap text-center first:text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {drill.days.map(d => (
                      <tr key={d.date} className="border-b border-slate-100 text-slate-600">
                        <td className="px-2 py-2 whitespace-nowrap font-semibold text-slate-800">
                          {new Date(`${d.date}T12:00:00`).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                        </td>
                        <td className="px-2 py-2 text-center font-bold text-slate-800">{num(d.tests)}</td>
                        <td className="px-2 py-2 text-center">{num(d.insurance)}</td>
                        <td className="px-2 py-2 text-center">{num(d.screening)}</td>
                        <td className="px-2 py-2 text-center">{num(d.mixed)}</td>
                        <td className="px-2 py-2 text-center">{num(d.partial)}</td>
                        <td className="px-2 py-2 text-center">{num(d.cancellations)}</td>
                        <td className="px-2 py-2 text-center">{num(d.km)}</td>
                        <td className="px-2 py-2 text-center">{num(d.officeHours)}</td>
                        <td className="px-2 py-2 text-center">{ils(d.food)}</td>
                        <td className="px-2 py-2 text-center">{ils(d.parking)}</td>
                        <td className="px-2 py-2 text-center">{ils(d.toll)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </AnimatedModal>
    </div>
  );
}
