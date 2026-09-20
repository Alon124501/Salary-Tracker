-- "הערות" (notes): free-text note per day, entered on the entry form and
-- shown as a trailing column in the monthly Excel report. Not part of pay/test totals.
ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS notes text;
