const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, '..', 'salary.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
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
    learning_hours REAL DEFAULT 0,
    food_expense REAL DEFAULT 0,
    parking_expense REAL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, date)
  );
`);

module.exports = db;
