const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const supabase = require('../supabase');
const auth = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/register', upload.single('profession_document'), async (req, res) => {
  const { username, password, first_name, last_name, profession, district, email, shifts_per_week, phone, vehicle_type_color, vehicle_number, address } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  // Check username uniqueness
  const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const supabaseEmail = `${username}@salary-tracker.app`;
  const { data, error } = await supabase.auth.admin.createUser({
    email: supabaseEmail,
    password,
    email_confirm: true,
  });
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // Upload profession document if provided
  let profession_document_url = null;
  if (req.file) {
    const ext = req.file.originalname.split('.').pop();
    const filePath = `${data.user.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('profession-documents')
      .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });
    if (!uploadErr) profession_document_url = filePath;
  }

  // Insert profile with the new user's UUID
  const { error: profileErr } = await supabase.from('profiles').insert({
    id: data.user.id,
    username,
    first_name: first_name || null,
    last_name: last_name || null,
    profession: profession || null,
    district: district || null,
    email: email || null,
    shifts_per_week: shifts_per_week || null,
    phone: phone || null,
    vehicle_type_color: vehicle_type_color || null,
    vehicle_number: vehicle_number || null,
    address: address || null,
    profession_document_url,
  });
  if (profileErr) {
    return res.status(500).json({ error: profileErr.message });
  }

  // Sign in immediately to get a usable session token
  const { data: session, error: signInErr } = await supabase.auth.signInWithPassword({ email: supabaseEmail, password });
  if (signInErr) {
    return res.status(500).json({ error: signInErr.message });
  }

  res.status(201).json({ token: session.session.access_token, username });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Look up profile by username to confirm the user exists
  const { data: profile } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
  if (!profile) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const email = `${username}@salary-tracker.app`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({ token: data.session.access_token, username });
});

router.get('/me', auth, async (req, res) => {
  const { data: user, error } = await supabase.from('profiles')
    .select('username, gmail_user, payment_type, global_salary, first_name, last_name, profession, district, email, phone, vehicle_type_color, vehicle_number, shifts_per_week, address, is_admin')
    .eq('id', req.userId)
    .single();
  if (error || !user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.patch('/profile', auth, upload.single('profession_document'), async (req, res) => {
  const { first_name, last_name, profession, district, email, vehicle_type_color, vehicle_number, shifts_per_week, address } = req.body;

  const updates = {
    first_name: first_name || null,
    last_name: last_name || null,
    profession: profession || null,
    district: district || null,
    email: email || null,
    vehicle_type_color: vehicle_type_color || null,
    vehicle_number: vehicle_number || null,
    shifts_per_week: shifts_per_week || null,
    address: address || null,
  };

  if (req.file) {
    const ext = req.file.originalname.split('.').pop();
    const filePath = `${req.userId}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('profession-documents')
      .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });
    if (!uploadErr) updates.profession_document_url = filePath;
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.patch('/settings', auth, async (req, res) => {
  const { gmail_user, gmail_app_password, payment_type, global_salary } = req.body;
  const valid = ['per_test', 'per_hour', 'global'];
  const resolvedType = valid.includes(payment_type) ? payment_type : null;
  const resolvedSalary = (resolvedType === 'global' && global_salary != null) ? Number(global_salary) : null;

  const { error } = await supabase.from('profiles').update({
    gmail_user: gmail_user || null,
    gmail_app_password: gmail_app_password || null,
    payment_type: resolvedType,
    global_salary: resolvedSalary,
  }).eq('id', req.userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.patch('/password', auth, async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  if (!newPassword || !confirmPassword) return res.status(400).json({ error: 'Both fields are required' });
  if (newPassword !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const { error } = await supabase.auth.admin.updateUserById(req.userId, { password: newPassword });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();

  if (profile) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await supabase.from('password_reset_tokens').delete().eq('user_id', profile.id);
    await supabase.from('password_reset_tokens').insert({ token, user_id: profile.id, expires_at: expiresAt });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    await transporter.sendMail({
      from: `"Medical Pay" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Reset your Medical Pay password',
      html: `<p>Click the link below to reset your password. It expires in 1 hour.</p><p><a href="${resetLink}">${resetLink}</a></p>`,
      text: `Reset your password here (expires in 1 hour): ${resetLink}`,
    });
  }

  res.json({ message: 'If that email is registered, a reset link has been sent.' });
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const { data: row } = await supabase.from('password_reset_tokens').select('user_id, expires_at').eq('token', token).maybeSingle();
  if (!row || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired reset link' });
  }

  const { error: updateErr } = await supabase.auth.admin.updateUserById(row.user_id, { password: newPassword });
  if (updateErr) return res.status(500).json({ error: updateErr.message });

  await supabase.from('password_reset_tokens').delete().eq('token', token);
  res.json({ message: 'Password updated' });
});

module.exports = router;
