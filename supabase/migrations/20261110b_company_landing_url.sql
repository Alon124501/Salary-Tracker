-- Company-level landing page link (replaces per-branch registration_url).
-- Backfills each company with its first non-empty branch registration link (by branch name).
-- screening_branches.registration_url is deprecated, to be dropped later.
-- Existing RLS on screening_companies already covers the new column.
ALTER TABLE screening_companies ADD COLUMN landing_url TEXT;
-- copy existing branch registration links up; first non-empty per company
UPDATE screening_companies c SET landing_url = (
  SELECT trim(b.registration_url) FROM screening_branches b
  WHERE b.company_id = c.id AND coalesce(trim(b.registration_url), '') <> ''
  ORDER BY b.name LIMIT 1
);
