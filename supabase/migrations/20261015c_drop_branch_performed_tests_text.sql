-- Free-text performed_tests was migrated to performed_test_ids + screening_test_catalog
-- (20261015_screening_test_catalog.sql); dropped once the new code was deployed.
ALTER TABLE screening_branches DROP COLUMN performed_tests;
