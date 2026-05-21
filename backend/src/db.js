const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'salary.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    gmail_user TEXT,
    gmail_app_password TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    insurance_tests INTEGER DEFAULT 0,
    screening_tests INTEGER DEFAULT 0,
    mixed_screening_tests INTEGER DEFAULT 0,
    partial_tests INTEGER DEFAULT 0,
    kilometers REAL DEFAULT 0,
    office_hours REAL DEFAULT 0,
    food_expense REAL DEFAULT 0,
    parking_expense REAL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, date)
  );
`);

// Add columns to existing DBs that were created before these fields existed
for (const col of ['gmail_user', 'gmail_app_password', 'payment_type']) {
  try { db.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT`); } catch {}
}
try { db.exec(`ALTER TABLE users ADD COLUMN global_salary REAL`); } catch {}

module.exports = db;
