ALTER TABLE screening_branches ADD COLUMN performed_tests TEXT[] NOT NULL DEFAULT '{}';
