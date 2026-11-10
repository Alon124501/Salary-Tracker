-- Moves "בדיקות שמבצעים בסניף" from the branch level to the company level:
-- every branch of a company shows the company's list (no per-branch overrides).
-- Seeding: each company gets the union of its branches' lists; טבע gets the
-- list of its "רמת החייל" branch. screening_branches.performed_test_ids stays,
-- unread and unwritten, and is dropped in a follow-up migration.
-- Pre-step (manual, per docs/RELEASE.md): back up screening_branches first.
-- Existing RLS on screening_companies already covers the new column.
ALTER TABLE screening_companies ADD COLUMN performed_test_ids UUID[] NOT NULL DEFAULT '{}';

-- union of all branches per company
UPDATE screening_companies c SET performed_test_ids = ARRAY(
  SELECT DISTINCT unnest(b.performed_test_ids) FROM screening_branches b WHERE b.company_id = c.id
);

-- טבע: use the רמת החייל branch's list (only if that branch exists)
UPDATE screening_companies c SET performed_test_ids = b.performed_test_ids
FROM screening_branches b
WHERE b.company_id = c.id AND trim(c.name) = 'טבע' AND trim(b.name) = 'רמת החייל';
