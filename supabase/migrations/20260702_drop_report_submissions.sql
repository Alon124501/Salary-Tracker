-- The "Submit to Admin" in-app flow is replaced by a client-side download
-- (zip of receipts + Excel summary); employees now email admin manually.
-- The report_submissions table and its admin send-to-accounting routes are unused.
DROP TABLE IF EXISTS report_submissions CASCADE;
