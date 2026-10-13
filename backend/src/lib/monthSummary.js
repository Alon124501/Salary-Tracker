const supabase = require('../supabase');
const { totalTestsFor, foodAudit } = require('./payCalc');

// Cancellation % is only ranked once an employee has enough volume — otherwise
// 1 test + 1 cancellation (50%) would outrank 40 tests + 10 cancellations.
const CANCEL_MIN_VOLUME = 10;
const TESTS_PER_DAY_MIN_DAYS = 5;

// UTC math so the last day doesn't shift when the server runs in Israel time.
function monthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  return {
    start: `${month}-01`,
    end: new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10),
  };
}

function prevMonthOf(month) {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon - 2, 1)).toISOString().slice(0, 7);
}

function todayIsrael() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
}

function overlapDays(startDate, endDate, range) {
  const s = startDate > range.start ? startDate : range.start;
  const e = endDate < range.end ? endDate : range.end;
  if (s > e) return 0;
  return Math.round((Date.parse(e) - Date.parse(s)) / 86400000) + 1;
}

const round1 = n => Math.round(n * 10) / 10;

// Entry columns safe to expose on the link-based recap page — never notes or receipt URLs.
const ENTRY_FIELDS = 'user_id, date, insurance_tests, screening_tests, mixed_screening_tests, partial_tests, cancellations, kilometers, office_hours, food_expense, parking_expense, toll_expense, toll_receipt_urls';

function statsFor(entries, timeOff, range) {
  const s = {
    tests: 0, insurance: 0, screening: 0, mixed: 0, partial: 0,
    cancellations: 0, days: entries.length, km: 0, officeHours: 0,
    food: 0, parking: 0, toll: 0, vacationDays: 0, sickDays: 0,
  };
  for (const e of entries) {
    s.tests        += totalTestsFor(e);
    s.insurance    += e.insurance_tests || 0;
    s.screening    += e.screening_tests || 0;
    s.mixed        += e.mixed_screening_tests || 0;
    s.partial      += e.partial_tests || 0;
    s.cancellations += Number(e.cancellations) || 0;
    s.km           += e.kilometers || 0;
    s.officeHours  += e.office_hours || 0;
    s.food         += e.food_expense || 0;
    s.parking      += e.parking_expense || 0;
    s.toll         += Number(e.toll_expense) || 0;
  }
  for (const t of timeOff) {
    const days = overlapDays(t.start_date, t.end_date, range);
    if (t.category === 'vacation') s.vacationDays += days;
    if (t.category === 'sick') s.sickDays += days;
  }
  const volume = s.tests + s.cancellations;
  s.cancelPct = volume > 0 ? round1((s.cancellations / volume) * 100) : null;
  s.cancelEligible = volume >= CANCEL_MIN_VOLUME;
  s.km = round1(s.km);
  s.officeHours = round1(s.officeHours);
  return s;
}

function sumStats(rows) {
  const keys = ['tests', 'insurance', 'screening', 'mixed', 'partial', 'cancellations', 'days', 'km',
                'officeHours', 'food', 'parking', 'toll', 'vacationDays', 'sickDays'];
  const t = Object.fromEntries(keys.map(k => [k, 0]));
  for (const r of rows) for (const k of keys) t[k] += r[k];
  const volume = t.tests + t.cancellations;
  t.cancelPct = volume > 0 ? round1((t.cancellations / volume) * 100) : null;
  t.activeEmployees = rows.filter(r => r.days > 0).length;
  t.km = round1(t.km);
  t.officeHours = round1(t.officeHours);
  return t;
}

// Winner(s) of one category; ties share the title. null when nobody qualifies.
function pick(rows, value, { filter = () => true, lowest = false } = {}) {
  const candidates = rows.filter(filter).map(r => ({ r, v: value(r) })).filter(x => x.v !== null);
  if (!candidates.length) return null;
  const best = lowest ? Math.min(...candidates.map(x => x.v)) : Math.max(...candidates.map(x => x.v));
  return {
    value: best,
    people: candidates.filter(x => x.v === best).map(x => ({ id: x.r.id, name: x.r.name })),
  };
}

function listOf(rows, filter, value) {
  return rows.filter(filter)
    .map(r => ({ id: r.id, name: r.name, value: value(r) }))
    .sort((a, b) => b.value - a.value);
}

async function buildRecap(month) {
  const prevMonth = prevMonthOf(month);
  const cur = monthRange(month);
  const prev = monthRange(prevMonth);

  const [
    { data: profiles, error: pErr },
    { data: entries, error: eErr },
    { data: timeOff, error: tErr },
  ] = await Promise.all([
    supabase.from('profiles').select('id, first_name, last_name, username, created_at').eq('is_admin', false).order('first_name'),
    supabase.from('entries').select(ENTRY_FIELDS).gte('date', prev.start).lte('date', cur.end),
    supabase.from('time_off_requests').select('user_id, category, start_date, end_date')
      .eq('status', 'approved').lte('start_date', cur.end).gte('end_date', prev.start),
  ]);
  if (pErr) throw pErr;
  if (eErr) throw eErr;
  if (tErr) throw tErr;

  // Skip people who joined after the month ended (unless they somehow have entries in it).
  const relevant = profiles.filter(p =>
    !p.created_at || p.created_at.slice(0, 10) <= cur.end || entries.some(e => e.user_id === p.id && e.date >= cur.start));

  const employees = relevant.map(p => {
    const mine = entries.filter(e => e.user_id === p.id);
    const curEntries = mine.filter(e => e.date >= cur.start);
    const prevEntries = mine.filter(e => e.date < cur.start);
    const myTimeOff = timeOff.filter(t => t.user_id === p.id);
    const c = statsFor(curEntries, myTimeOff, cur);
    const pr = statsFor(prevEntries, myTimeOff, prev);
    return {
      id: p.id,
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username,
      ...c,
      prevTests: pr.tests,
      prevDays: pr.days,
      deltaTests: c.tests - pr.tests,
      foodOverBy: foodAudit(curEntries).overBy,
      tollMissing: curEntries.filter(e => (Number(e.toll_expense) || 0) > 0 && !(e.toll_receipt_urls || []).length).length,
      existedBeforeMonth: !p.created_at || p.created_at.slice(0, 10) < cur.start,
      _prev: pr,
    };
  });

  const company = sumStats(employees);
  const companyPrev = sumStats(employees.map(e => e._prev));
  for (const e of employees) delete e._prev;

  const awards = {
    mostTests:     pick(employees, r => r.tests, { filter: r => r.tests > 0 }),
    testsPerDay:   pick(employees, r => round1(r.tests / r.days), { filter: r => r.days >= TESTS_PER_DAY_MIN_DAYS && r.tests > 0 }),
    mostKm:        pick(employees, r => r.km, { filter: r => r.km > 0 }),
    mostDays:      pick(employees, r => r.days, { filter: r => r.days > 0 }),
    improvement:   pick(employees, r => r.deltaTests, { filter: r => r.prevDays > 0 && r.deltaTests > 0 }),
    lowestCancel:  pick(employees, r => r.cancelPct, { filter: r => r.cancelEligible, lowest: true }),
  };

  const attention = {
    highestCancel: pick(employees, r => r.cancelPct, { filter: r => r.cancelEligible && r.cancelPct > 0 }),
    mostSick:      pick(employees, r => r.sickDays, { filter: r => r.sickDays > 0 }),
    biggestDrop:   pick(employees, r => r.deltaTests, { filter: r => r.prevDays > 0 && r.deltaTests < 0, lowest: true }),
    foodOver:      listOf(employees, r => r.foodOverBy > 0, r => r.foodOverBy),
    tollMissing:   listOf(employees, r => r.tollMissing > 0, r => r.tollMissing),
    zeroEntries:   listOf(employees, r => r.existedBeforeMonth && r.days === 0, () => 0),
  };

  return {
    month,
    prevMonth,
    partial: cur.end >= todayIsrael(),
    rules: { cancelMinVolume: CANCEL_MIN_VOLUME, testsPerDayMinDays: TESTS_PER_DAY_MIN_DAYS },
    company,
    companyPrev,
    awards,
    attention,
    employees,
  };
}

async function buildDrilldown(month, userId) {
  const { start, end } = monthRange(month);
  const { data: profile } = await supabase.from('profiles').select('id, is_admin').eq('id', userId).maybeSingle();
  if (!profile || profile.is_admin) return null;
  const { data, error } = await supabase.from('entries').select(ENTRY_FIELDS)
    .eq('user_id', userId).gte('date', start).lte('date', end).order('date');
  if (error) throw error;
  return data.map(e => ({
    date: e.date,
    tests: totalTestsFor(e),
    insurance: e.insurance_tests || 0,
    screening: e.screening_tests || 0,
    mixed: e.mixed_screening_tests || 0,
    partial: e.partial_tests || 0,
    cancellations: Number(e.cancellations) || 0,
    km: e.kilometers || 0,
    officeHours: e.office_hours || 0,
    food: e.food_expense || 0,
    parking: e.parking_expense || 0,
    toll: Number(e.toll_expense) || 0,
  }));
}

module.exports = { monthRange, buildRecap, buildDrilldown };
