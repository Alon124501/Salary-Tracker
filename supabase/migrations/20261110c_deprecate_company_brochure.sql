-- Brochures (חוברות) feature removed from screening companies.
-- Backup of the 9 non-null URLs + all bucket files was taken locally before this ran.
-- Column is deprecated (unread/unwritten); dropped in the pending drop migration
-- together with screening_branches.performed_test_ids / registration_url.
-- The `branch-brochures` storage bucket is emptied and deleted separately (storage API).
UPDATE screening_companies SET brochure_url = NULL WHERE brochure_url IS NOT NULL;
COMMENT ON COLUMN screening_companies.brochure_url IS 'DEPRECATED 20261110c — brochures removed, pending drop';
