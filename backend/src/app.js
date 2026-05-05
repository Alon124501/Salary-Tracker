const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/entries', require('./routes/entries'));
app.use('/api/report', require('./routes/report'));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

module.exports = app;
