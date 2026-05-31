const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/entries', require('./routes/entries'));
app.use('/api/report', require('./routes/report'));
app.use('/api/cron', require('./routes/cron'));
app.use('/api/screening', require('./routes/screening'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/faq',   require('./routes/faq'));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

module.exports = app;
