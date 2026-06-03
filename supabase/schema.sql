-- ============================================================
-- Salary Tracker — Supabase Schema
-- Run this in the Supabase SQL Editor to recreate the full schema.
-- ============================================================

-- Profiles table: extends auth.users with app-specific fields.
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  gmail_user TEXT,
  gmail_app_password TEXT,
  payment_type TEXT DEFAULT 'per_test',
  global_salary REAL,
  phone TEXT,
  vehicle_type_color TEXT,
  vehicle_number TEXT,
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
  office_hours REAL DEFAULT 0,
  food_expense REAL DEFAULT 0,
  parking_expense REAL DEFAULT 0,
  receipt_url TEXT,
  food_receipt_urls TEXT[] DEFAULT '{}',
  parking_receipt_urls TEXT[] DEFAULT '{}',
  UNIQUE(user_id, date)
);

-- Password reset tokens (custom flow — Supabase built-in can't reach fake internal emails)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

-- ============================================================
-- Row Level Security
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
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS entries_user_date_idx ON entries(user_id, date);

-- ============================================================
-- Storage
-- ============================================================
-- Bucket: receipts (private)
-- Path pattern: {user_id}/{YYYY-MM}/{entry_id}/food_{timestamp}.{ext}
-- Path pattern: {user_id}/{YYYY-MM}/{entry_id}/parking_{timestamp}.{ext}
-- Access: server-side signed URLs (1-hour expiry) via service role key

-- ============================================================
-- Screening Locations (Migration)
-- ============================================================

-- Admin flag on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Screening companies (e.g. מזרחי טפחות, טבע)
CREATE TABLE IF NOT EXISTS screening_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  brochure_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Branches per company
CREATE TABLE IF NOT EXISTS screening_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES screening_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  requires_echo_bed BOOLEAN DEFAULT FALSE,
  test_types TEXT[] DEFAULT '{}',
  registration_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (backend uses service role key so these are defense-in-depth)
ALTER TABLE screening_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view companies"
  ON screening_companies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view branches"
  ON screening_branches FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS screening_branches_company_idx ON screening_branches(company_id);
