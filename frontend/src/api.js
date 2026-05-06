import { supabase } from './lib/supabase.js';
import { calcDaily, monthRange } from './lib/calc.js';

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(username, password) {
  const email = `${username}@salary-tracker.local`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Invalid credentials');
  return { username };
}

export async function register(username, password) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (existing) throw new Error('Username already taken');

  const email = `${username}@salary-tracker.local`;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);

  const { error: profileErr } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, username });
  if (profileErr) throw new Error(profileErr.message);

  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(signInErr.message);

  return { username };
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getMe() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('profiles')
    .select('username, gmail_user, payment_type, global_salary')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data;
}

export async function saveSettings(updates) {
  const { data: { user } } = await supabase.auth.getUser();
  const valid = ['per_test', 'per_hour', 'global'];
  const payload = {
    gmail_user: updates.gmail_user ?? undefined,
    gmail_app_password: updates.gmail_app_password ?? undefined,
    payment_type: valid.includes(updates.payment_type) ? updates.payment_type : undefined,
    global_salary: updates.payment_type === 'global' && updates.global_salary != null
      ? Number(updates.global_salary)
      : undefined,
  };
  // Remove undefined keys
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
  if (error) throw error;
}

// ── Entries ───────────────────────────────────────────────────────────────────

export async function getEntries(month) {
  const { start, end } = monthRange(month);
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false });
  if (error) throw error;
  return data.map(e => ({ ...e, calc: calcDaily(e) }));
}

export async function getSummary(month) {
  const entries = await getEntries(month);
  const totals = { insurance: 0, screening: 0, mixed: 0, partial: 0, km: 0, learning: 0, expenses: 0, total: 0, days: entries.length };
  for (const e of entries) {
    totals.insurance += e.calc.insurance;
    totals.screening += e.calc.screening;
    totals.mixed += e.calc.mixed;
    totals.partial += e.calc.partial;
    totals.km += e.calc.km;
    totals.learning += e.calc.learning;
    totals.expenses += e.calc.expenses;
    totals.total += e.calc.total;
  }
  return totals;
}

export async function upsertEntry(form) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('entries')
    .upsert({ user_id: user.id, ...form }, { onConflict: 'user_id,date' })
    .select()
    .single();
  if (error) throw error;
  return { ...data, calc: calcDaily(data) };
}

export async function deleteEntry(id) {
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) throw error;
}

export async function getBackup() {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .order('date', { ascending: true });
  if (error) throw error;
  const entries = data.map(({ user_id, id, ...e }) => e);
  return { exported_at: new Date().toISOString(), entries };
}

export async function restoreEntries(entries) {
  const { data: { user } } = await supabase.auth.getUser();
  const rows = entries.filter(e => e.date).map(e => ({ user_id: user.id, ...e }));
  const { error } = await supabase
    .from('entries')
    .upsert(rows, { onConflict: 'user_id,date' });
  if (error) throw error;
  return { imported: rows.length };
}

// ── Report ────────────────────────────────────────────────────────────────────

export async function sendReport(month, receiptFiles, parkingFiles) {
  const { data: { session } } = await supabase.auth.getSession();
  const formData = new FormData();
  formData.append('month', month);
  receiptFiles.forEach(f => formData.append('receipts', f));
  parkingFiles.forEach(f => formData.append('parking', f));

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-report`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to send report');
  return json;
}
