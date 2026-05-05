// Vercel serverless entry point — handles all /api/* routes.
// In production, env vars are set via the Vercel dashboard.
require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

module.exports = require('../backend/src/app');
