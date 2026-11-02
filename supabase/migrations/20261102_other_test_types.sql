-- "אחר" tests: admin-managed list of extra test types (first: Medix). Each
-- entry stores a per-type count breakdown; entries.other_tests is the synced
-- total so test totals / food gate just add one more column. Count only — no
-- pay rate, same as the four fixed test types.
CREATE TABLE other_test_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE other_test_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "other_test_types_read" ON other_test_types FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "other_test_types_admin" ON other_test_types FOR ALL USING (auth.role() = 'service_role');

INSERT INTO other_test_types (label) VALUES ('Medix');

-- Breakdown shape: [{"type_id": "<uuid>", "count": 2}, ...].
ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS other_tests INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_test_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.entries
  ADD CONSTRAINT entries_other_tests_nonnegative CHECK (other_tests >= 0);
