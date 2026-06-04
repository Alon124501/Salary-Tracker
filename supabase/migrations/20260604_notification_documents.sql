ALTER TABLE notifications
  ADD COLUMN document_storage_path text,
  ADD COLUMN document_external_url text,
  ADD COLUMN document_file_name     text,
  ADD COLUMN force_view_document    boolean NOT NULL DEFAULT false;

ALTER TABLE notification_reads
  ADD COLUMN document_opened_at timestamptz;

COMMENT ON COLUMN notifications.document_storage_path IS 'Path in Supabase notification-documents bucket. NULL when no uploaded file.';
COMMENT ON COLUMN notifications.document_external_url IS 'Secure external URL pasted by admin. Mutually exclusive with document_storage_path.';
COMMENT ON COLUMN notifications.force_view_document IS 'When true, approval button is disabled until the tester clicks View Document.';
COMMENT ON COLUMN notification_reads.document_opened_at IS 'Timestamp of first View Document click. NULL = not yet opened.';
