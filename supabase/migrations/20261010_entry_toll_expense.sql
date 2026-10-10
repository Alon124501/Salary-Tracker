-- "כביש אגרה" (toll roads): reimbursed at actual cost like parking, with
-- optional receipts (images or PDF) that can be attached later.
ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS toll_expense numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS toll_receipt_urls text[] NOT NULL DEFAULT '{}';

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
    cancellations         >= 0 AND
    toll_expense          >= 0
  );
