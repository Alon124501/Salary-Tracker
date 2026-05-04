const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }
  const password_hash = await bcrypt.hash(password, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, password_hash);
  const token = jwt.sign({ userId: Number(result.lastInsertRowid) }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ token, username });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, username: user.username });
});

router.get('/me', auth, (req, res) => {
  const user = db.prepare('SELECT username, gmail_user, payment_type, global_salary FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.patch('/settings', auth, (req, res) => {
  const { gmail_user, gmail_app_password, payment_type, global_salary } = req.body;
  const valid = ['per_test', 'per_hour', 'global'];
  const resolvedType = valid.includes(payment_type) ? payment_type : null;
  const resolvedSalary = (resolvedType === 'global' && global_salary != null) ? Number(global_salary) : null;
  db.prepare('UPDATE users SET gmail_user = ?, gmail_app_password = ?, payment_type = ?, global_salary = ? WHERE id = ?')
    .run(gmail_user || null, gmail_app_password || null, resolvedType, resolvedSalary, req.userId);
  res.json({ success: true });
});

module.exports = router;
