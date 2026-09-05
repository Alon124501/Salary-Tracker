const express    = require('express');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const { z }      = require('zod');
const supabase   = require('../supabase');
const supabaseAuth = require('../supabaseAuth');
const auth       = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

function isValidIsraeliId(id) {
  const s = String(id || '').trim();
  if (!/^\d{5,9}$/.test(s)) return false;
  const padded = s.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(padded[i]) * ((i % 2) + 1);
    if (d > 9) d -= 9;
    sum += d;
  }
  return sum % 10 === 0;
}

const RegisterSchema = z.object({
  password: z.string().min(6).max(100),
  first_name: z.string().min(1).max(50),
  last_name:  z.string().min(1).max(50),
  email:      z.string().email(),
  id_number:  z.string().refine(isValidIsraeliId, 'תעודת זהות לא תקינה'),
  phone:      z.string().max(20).optional(),
  address:    z.string().max(200).optional(),
  shirt_size: z.string().max(20).optional(),
  pants_size: z.string().max(20).optional(),
  vehicle_type_color: z.string().max(100).optional(),
  vehicle_number:     z.string().max(20).optional(),
});

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

async function generateUsername(firstName, lastName) {
  const base = `${firstName}${lastName}`
    .toLowerCase()
    .normalize('NFKD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]/g, '') || 'user';
  let candidate = base;
  for (let attempt = 0; attempt < 20; attempt++) {
    const { data } = await supabase.from('profiles').select('id').eq('username', candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return `${base}${Date.now()}`;
}

router.post('/register', asyncHandler(async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { password, first_name, last_name, email, id_number, phone,
          address, shirt_size, pants_size, vehicle_type_color, vehicle_number } = parsed.data;

  const { data: existingId } = await supabase.from('profiles').select('id').eq('id_number', id_number).maybeSingle();
  if (existingId) {
    return res.status(409).json({ error: 'תעודת הזהות הזו כבר רשומה במערכת' });
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const username = await generateUsername(first_name, last_name);

  const { error: profileErr } = await supabase.from('profiles').insert({
    id: data.user.id,
    username,
    first_name,
    last_name,
    email,
    id_number,
    phone:               phone               || null,
    address:             address             || null,
    shirt_size:          shirt_size          || null,
    pants_size:          pants_size          || null,
    vehicle_type_color:  vehicle_type_color  || null,
    vehicle_number:      vehicle_number      || null,
  });
  if (profileErr) {
    return res.status(500).json({ error: profileErr.message });
  }

  const { data: session, error: signInErr } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (signInErr) {
    return res.status(500).json({ error: signInErr.message });
  }

  res.status(201).json({ token: session.session.access_token, username });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'יש להזין אימייל וסיסמה' });
  }
  const { email, password } = parsed.data;

  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (error) {
    return res.status(401).json({ error: 'פרטי ההתחברות שגויים' });
  }

  const { data: profile } = await supabase.from('profiles').select('username').eq('id', data.user.id).maybeSingle();

  res.json({ token: data.session.access_token, username: profile?.username });
}));

router.get('/me', auth, asyncHandler(async (req, res) => {
  const { data: user, error } = await supabase.from('profiles')
    .select('username, payment_type, global_salary, first_name, last_name, profession, district, email, id_number, phone, vehicle_type_color, vehicle_number, shifts_per_week, shirt_size, pants_size, address, is_admin, mileage_rate, insurance_rate, screening_rate, mixed_screening_rate, partial_rate, hourly_rate, km_bonus_enabled, km_bonus_threshold, km_bonus_amount')
    .eq('id', req.userId)
    .single();
  if (error || !user) return res.status(404).json({ error: 'משתמש לא נמצא' });
  res.json(user);
}));

router.patch('/profile', auth, asyncHandler(async (req, res) => {
  const { first_name, last_name, email, id_number, vehicle_type_color, vehicle_number, shirt_size, pants_size, address } = req.body;

  if (id_number !== undefined && !isValidIsraeliId(id_number)) {
    return res.status(400).json({ error: 'תעודת זהות לא תקינה' });
  }

  const updates = {
    first_name: first_name || null,
    last_name:  last_name  || null,
    email:      email      || null,
    id_number:  id_number  || null,
    vehicle_type_color:  vehicle_type_color  || null,
    vehicle_number:      vehicle_number      || null,
    shirt_size:          shirt_size          || null,
    pants_size:          pants_size          || null,
    address:             address             || null,
  };

  const { error } = await supabase.from('profiles').update(updates).eq('id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

router.patch('/password', auth, asyncHandler(async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  if (!newPassword || !confirmPassword) return res.status(400).json({ error: 'יש למלא את שני השדות' });
  if (newPassword !== confirmPassword) return res.status(400).json({ error: 'הסיסמאות אינן תואמות' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'הסיסמה חייבת לכלול לפחות 6 תווים' });

  const { error } = await supabase.auth.admin.updateUserById(req.userId, { password: newPassword });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'נדרשת כתובת אימייל' });

  const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();

  if (profile) {
    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await supabase.from('password_reset_tokens').delete().eq('user_id', profile.id);
    await supabase.from('password_reset_tokens').insert({ token, user_id: profile.id, expires_at: expiresAt });

    const resetLink  = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    await transporter.sendMail({
      from:    `"Medical Pay" <${process.env.GMAIL_USER}>`,
      to:      email,
      subject: 'איפוס הסיסמה שלך ב-Medical Pay',
      html:    `<p>לחץ על הקישור הבא כדי לאפס את הסיסמה שלך. הקישור בתוקף לשעה אחת.</p><p><a href="${resetLink}">${resetLink}</a></p>`,
      text:    `איפוס הסיסמה שלך (בתוקף לשעה אחת): ${resetLink}`,
    });
  }

  // Always return the same message to prevent email enumeration
  res.json({ message: 'אם כתובת האימייל רשומה במערכת, נשלח אליה קישור לאיפוס הסיסמה.' });
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'נדרשים קוד אימות וסיסמה חדשה' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'הסיסמה חייבת לכלול לפחות 6 תווים' });

  const { data: row } = await supabase.from('password_reset_tokens')
    .select('user_id, expires_at').eq('token', token).maybeSingle();
  if (!row || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'הקישור לאיפוס הסיסמה אינו תקין או שפג תוקפו' });
  }

  const { error: updateErr } = await supabase.auth.admin.updateUserById(row.user_id, { password: newPassword });
  if (updateErr) return res.status(500).json({ error: updateErr.message });

  await supabase.from('password_reset_tokens').delete().eq('token', token);
  res.json({ message: 'הסיסמה עודכנה בהצלחה' });
}));

module.exports = router;
