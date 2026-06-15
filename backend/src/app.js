const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// ── Rate limiters on sensitive auth endpoints ──────────────────────────────
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
}));

app.use('/api/auth/register', rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many registration attempts. Try again later.' },
}));

app.use('/api/auth/forgot-password', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many password reset attempts. Try again later.' },
}));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/entries',       require('./routes/entries'));
app.use('/api/report',        require('./routes/report'));
app.use('/api/cron',          require('./routes/cron'));
app.use('/api/screening',     require('./routes/screening'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/faq',           require('./routes/faq'));
app.use('/api/portal',        require('./routes/portal'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/contacts',      require('./routes/contacts'));
app.use('/api/equipment',     require('./routes/equipment'));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Global error handler ───────────────────────────────────────────────────
// Catches anything forwarded via next(err) or unhandled async rejections wrapped
// by asyncHandler. Returns a generic message so stack traces don't leak to clients.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

module.exports = app;
