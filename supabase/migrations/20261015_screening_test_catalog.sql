-- Replaces free-text screening_branches.performed_tests with an admin-managed
-- catalog; branches reference catalog IDs so a rename propagates everywhere.
CREATE TABLE screening_test_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE screening_test_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screening_test_catalog_read" ON screening_test_catalog FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "screening_test_catalog_admin" ON screening_test_catalog FOR ALL USING (auth.role() = 'service_role');

-- Seed the catalog from the existing free-text values
INSERT INTO screening_test_catalog (name)
SELECT DISTINCT trim(t) FROM screening_branches, unnest(performed_tests) AS t
WHERE trim(t) <> ''
ON CONFLICT (name) DO NOTHING;

ALTER TABLE screening_branches ADD COLUMN performed_test_ids UUID[] NOT NULL DEFAULT '{}';

UPDATE screening_branches b SET performed_test_ids = ARRAY(
  SELECT c.id
  FROM unnest(b.performed_tests) WITH ORDINALITY AS u(t, ord)
  JOIN screening_test_catalog c ON c.name = trim(u.t)
  ORDER BY u.ord
);

-- performed_tests is dropped in a follow-up migration once the new code is deployed
