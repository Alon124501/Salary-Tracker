const express = require('express');
const multer = require('multer');
const supabase = require('../supabase');
const auth = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/register', upload.single('profession_document'), async (req, res) => {
  const { username, password, first_name, last_name, profession, district } = req.body;
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

  const email = `${username}@salary-tracker.local`;
  const { data, error } = await supabase.auth.signUp({ email, password });
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
    profession_document_url,
  });
  if (profileErr) {
    return res.status(500).json({ error: profileErr.message });
  }

  // Sign in immediately to get a usable session token
  const { data: session, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
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

  const email = `${username}@salary-tracker.local`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({ token: data.session.access_token, username });
});

router.get('/me', auth, async (req, res) => {
  const { data: user, error } = await supabase.from('profiles')
    .select('username, gmail_user, payment_type, global_salary, first_name, last_name')
    .eq('id', req.userId)
    .single();
  if (error || !user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
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

module.exports = router;
