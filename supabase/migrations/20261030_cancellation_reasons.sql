-- Cancellation reasons: admin-managed list; each entry stores a per-reason
-- count breakdown. entries.cancellations stays the synced total so the food
-- gate / recap cancel % / Excel count keep working unchanged.
-- The single is_other row ("אחר") is built-in: locked from rename/disable,
-- and requires entries.cancellation_other_note when its count > 0.
CREATE TABLE cancellation_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  is_other BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX cancellation_reasons_one_other ON cancellation_reasons (is_other) WHERE is_other;

ALTER TABLE cancellation_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cancellation_reasons_read" ON cancellation_reasons FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "cancellation_reasons_admin" ON cancellation_reasons FOR ALL USING (auth.role() = 'service_role');

INSERT INTO cancellation_reasons (label, created_at) VALUES
  ('לקוח לא הגיע',     NOW()),
  ('לקוח ביטל מראש',   NOW() + interval '1 second'),
  ('לא כשיר לבדיקה',   NOW() + interval '2 seconds'),
  ('בעיית ציוד',       NOW() + interval '3 seconds');
INSERT INTO cancellation_reasons (label, is_other) VALUES ('אחר', true);

-- Breakdown shape: [{"reason_id": "<uuid>", "count": 2}, ...]. Empty on
-- legacy rows — reports show the unexplained remainder as "לא צוין".
ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS cancellation_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cancellation_other_note TEXT;
