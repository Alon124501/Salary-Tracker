-- Moves "בדיקות שמבצעים בסניף" from the branch level to the company level:
-- every branch of a company shows the company's list (no per-branch overrides).
-- Seeding: each company gets the union of its branches' lists; טבע gets the
-- list of its "רמת החייל" branch. screening_branches.performed_test_ids stays,
-- unread and unwritten, and is dropped in a follow-up migration.
-- Pre-step (manual, per docs/RELEASE.md): back up screening_branches first.
-- Existing RLS on screening_companies already covers the new column.
ALTER TABLE screening_companies ADD COLUMN performed_test_ids UUID[] NOT NULL DEFAULT '{}';

-- union of all branches per company, in catalog order; ids no longer in the
-- catalog are dropped
UPDATE screening_companies c SET performed_test_ids = ARRAY(
  SELECT t.id
  FROM screening_test_catalog t
  WHERE EXISTS (
    SELECT 1 FROM screening_branches b
    WHERE b.company_id = c.id AND t.id = ANY(b.performed_test_ids)
  )
  ORDER BY t.sort_order, t.name
);

-- טבע: use the list of exactly one רמת החייל branch, in catalog order, only
-- when that branch exists and its list is non-empty
UPDATE screening_companies c SET performed_test_ids = ARRAY(
  SELECT t.id
  FROM screening_test_catalog t
  WHERE t.id = ANY(rh.ids)
  ORDER BY t.sort_order, t.name
)
FROM (
  SELECT b.company_id, b.performed_test_ids AS ids
  FROM screening_branches b
  JOIN screening_companies bc ON bc.id = b.company_id
  WHERE trim(bc.name) = 'טבע' AND trim(b.name) = 'רמת החייל'
  ORDER BY b.id
  LIMIT 1
) rh
WHERE rh.company_id = c.id AND cardinality(rh.ids) > 0;
