// The one admin who receives the app's admin emails and admin push alerts. Every admin-facing
// email (receipts, report packages, equipment recaps, stock alerts, supplier-order CC) uses
// ADMIN_EMAIL; admin push alerts go only to ADMIN_PROFILE_ID (profiles.id of the "Alon" account).
const ADMIN_EMAIL = 'alonm@mpcheck.co.il';
const ADMIN_PROFILE_ID = '566db8a5-05ca-4b99-9338-65a0f04561dd';

module.exports = { ADMIN_EMAIL, ADMIN_PROFILE_ID };
