-- "ביטולים" (cancellations): tracked per day but excluded from test totals/pay,
-- shown only on the entry form and in the monthly Excel report.
ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS cancellations numeric NOT NULL DEFAULT 0;

ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS chk_entries_positive;
ALTER TABLE public.entries
  ADD CONSTRAINT chk_entries_positive
  CHECK (
    insurance_tests       >= 0 AND
    screening_tests       >= 0 AND
    mixed_screening_tests >= 0 AND
    partial_tests         >= 0 AND
    kilometers            >= 0 AND
    office_hours          >= 0 AND
    food_expense          >= 0 AND
    parking_expense       >= 0 AND
    cancellations         >= 0
  );
