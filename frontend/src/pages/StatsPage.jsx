import { useState, useEffect } from 'react';
import api from '../api.js';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month) {
  const [y, m] = month.split('-');
  return new Date(y, m - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function totalTestsFor(e) {
  return (e.insurance_tests || 0) + (e.screening_tests || 0) + (e.mixed_screening_tests || 0) + (e.partial_tests || 0);
}

export default function StatsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => { loadStats(); }, [month]);

  async function loadStats() {
    try {
      const { data } = await api.get(`/entries?month=${month}`);
      setEntries(data);

      const s = {
        insurance_tests: 0, screening_tests: 0,
        mixed_screening_tests: 0, partial_tests: 0,
        kilometers: 0, office_hours: 0, days: data.length,
      };
      for (const e of data) {
        s.insurance_tests += e.insurance_tests;
        s.screening_tests += e.screening_tests;
        s.mixed_screening_tests += e.mixed_screening_tests;
        s.partial_tests += e.partial_tests;
        s.kilometers += e.kilometers;
        s.office_hours += e.office_hours;
      }
      s.total_tests = s.insurance_tests + s.screening_tests + s.mixed_screening_tests + s.partial_tests;
      setStats(s);
    } catch {}
  }

  // Build weekly bar chart from current week's entries
  const weekBars = buildWeekBars(entries);
  const maxBar = Math.max(...weekBars.map(b => b.total), 1);

  const avgDailyTests = stats && stats.days > 0 ? stats.total_tests / stats.days : 0;

  const s = stats || {};

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-32 lg:pb-24 space-y-8 bg-[#F2F2F7] min-h-screen">

      {/* Page Header */}
      <section className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 font-headline">Performance</h1>
          <p className="text-cupertino-label text-sm mt-1 font-medium">Activity summary for {monthLabel(month)}</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-full border-none focus:ring-1 focus:ring-action-blue w-auto shadow-sm"
        />
      </section>

      {/* Bento Grid Stats */}
      <section className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6">

        {/* Monthly Test Counts */}
        <div className="bg-white p-7 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-cupertino-label font-bold text-[11px] uppercase tracking-[0.1em] mb-1">Monthly Test Counts</p>
              <h2 className="text-5xl font-extrabold text-slate-900 tracking-tight font-headline">{(s.total_tests || 0).toLocaleString()}</h2>
            </div>
            <div className="flex items-center gap-1 text-brand-purple font-bold text-sm bg-purple-50 px-3 py-1 rounded-full">
              <span className="material-symbols-outlined text-xs">bar_chart</span>
              <span>{s.days || 0} days</span>
            </div>
          </div>
          <div className="mt-8 space-y-3">
            <StatRow label="Insurance" value={s.insurance_tests || 0} color="brand-gradient" max={s.total_tests || 1} />
            <StatRow label="Screening" value={s.screening_tests || 0} color="bg-purple-400" max={s.total_tests || 1} />
            <StatRow label="Mixed" value={s.mixed_screening_tests || 0} color="bg-indigo-400" max={s.total_tests || 1} />
            <StatRow label="Partial" value={s.partial_tests || 0} color="bg-sky-400" max={s.total_tests || 1} />
          </div>
        </div>

        {/* Distance Driven */}
        <div className="bg-white p-7 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-cupertino-label font-bold text-[11px] uppercase tracking-[0.1em] mb-1">Distance Driven</p>
              <h2 className="text-5xl font-extrabold text-slate-900 tracking-tight font-headline">
                {(s.kilometers || 0).toFixed(1)} <span className="text-xl font-medium text-cupertino-label">km</span>
              </h2>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-brand-purple">
              <span className="material-symbols-outlined">directions_car</span>
            </div>
          </div>
          {s.office_hours > 0 && (
            <div className="mt-2 flex items-center gap-2 text-cupertino-label text-sm">
              <span className="material-symbols-outlined text-base">corporate_fare</span>
              <span className="font-medium">{s.office_hours} office hours this month</span>
            </div>
          )}
        </div>
      </section>

      {/* Weekly Activity Bar Chart */}
      <section className="bg-white p-7 rounded-2xl border border-slate-100">
        <div className="flex justify-between items-center mb-10">
          <h3 className="text-lg font-bold text-slate-900 font-headline">Weekly Activity</h3>
          <span className="text-brand-purple text-xs font-bold uppercase tracking-wider">Daily Tests</span>
        </div>
        <div className="flex items-end justify-between h-40 gap-3">
          {weekBars.map((bar, i) => {
            const height = maxBar > 0 ? Math.max((bar.total / maxBar) * 100, bar.total > 0 ? 8 : 0) : 0;
            const isToday = bar.isToday;
            return (
              <div key={i} className="flex flex-col items-center flex-1 gap-4">
                <div
                  className={`w-full rounded-full transition-all duration-500 ${bar.total > 0 ? 'brand-gradient' : 'bg-slate-100'}`}
                  style={{ height: `${height}%`, minHeight: bar.total > 0 ? 8 : 8 }}
                  title={bar.total > 0 ? `${bar.total} tests` : 'No entry'}
                />
                <span className={`text-[10px] font-bold uppercase ${isToday ? 'text-brand-purple' : 'text-cupertino-label'}`}>
                  {DAY_LABELS[bar.day]}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Efficiency */}
      <section className="pb-8 space-y-3">
        <h3 className="text-[11px] font-bold text-cupertino-label uppercase tracking-[0.15em] ml-1">Efficiency</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-brand-purple">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Avg. Daily Tests</p>
                <p className="text-[11px] text-cupertino-label font-medium">Based on work days</p>
              </div>
            </div>
            <span className="text-xl font-extrabold text-slate-900">{avgDailyTests.toFixed(1)}</span>
          </div>

          <div className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Work Days Logged</p>
                <p className="text-[11px] text-cupertino-label font-medium">This month</p>
              </div>
            </div>
            <span className="text-xl font-extrabold text-slate-900">{s.days || 0}</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function StatRow({ label, value, color, max }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-[11px] font-bold text-cupertino-label uppercase tracking-wider mb-1">
        <span>{label}</span><span>{value}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function buildWeekBars(entries) {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const bars = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - dayOfWeek + i);
    const dateStr = d.toISOString().slice(0, 10);
    const entry = entries.find(e => e.date === dateStr);
    bars.push({
      day: i,
      total: entry ? totalTestsFor(entry) : 0,
      isToday: i === dayOfWeek,
    });
  }
  return bars;
}
