-- ============================================================
-- Salary Tracker — Supabase Schema
-- Run this in the Supabase SQL Editor before migrating data.
-- ============================================================

-- Profiles table: extends auth.users with app-specific fields.
-- Uses auth.users(id) as the primary key (UUID).
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  gmail_user TEXT,
  gmail_app_password TEXT,
  payment_type TEXT DEFAULT 'per_test',
  global_salary REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entries table: daily salary entries per user.
CREATE TABLE IF NOT EXISTS entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  insurance_tests INTEGER DEFAULT 0,
  screening_tests INTEGER DEFAULT 0,
  mixed_screening_tests INTEGER DEFAULT 0,
  partial_tests INTEGER DEFAULT 0,
  kilometers REAL DEFAULT 0,
  learning_hours REAL DEFAULT 0,
  food_expense REAL DEFAULT 0,
  parking_expense REAL DEFAULT 0,
  UNIQUE(user_id, date)
);

-- ============================================================
-- Row Level Security
-- Ensures users can only read/write their own data.
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- Profiles: each user manages only their own row
CREATE POLICY "Users manage own profile"
  ON profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Entries: each user manages only their own rows
CREATE POLICY "Users manage own entries"
  ON entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Indexes for common query patterns
-- ============================================================

CREATE INDEX IF NOT EXISTS entries_user_date_idx ON entries(user_id, date);
