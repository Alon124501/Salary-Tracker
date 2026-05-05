require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const path = require('path');
const app = require('./app');

// Serve the built frontend in local dev / self-hosted mode
const DIST = path.join(__dirname, '../../frontend/dist');
app.use(express.static(DIST));
app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend running on http://localhost:${PORT}`));
