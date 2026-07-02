-- Per-employee configurable pay rates (admin-set, per payment_type).
-- Defaults match today's hardcoded constants so existing employees are
-- unaffected until an admin explicitly changes their rates.
ALTER TABLE profiles
  ADD COLUMN insurance_rate       REAL NOT NULL DEFAULT 80,
  ADD COLUMN screening_rate       REAL NOT NULL DEFAULT 105,
  ADD COLUMN mixed_screening_rate REAL NOT NULL DEFAULT 120,
  ADD COLUMN partial_rate         REAL NOT NULL DEFAULT 50,
  ADD COLUMN hourly_rate          REAL NOT NULL DEFAULT 90;

-- payment_type is now exclusively admin-controlled; enforce valid values.
ALTER TABLE profiles
  ADD CONSTRAINT profiles_payment_type_check
  CHECK (payment_type IN ('per_test', 'per_hour', 'global'));
