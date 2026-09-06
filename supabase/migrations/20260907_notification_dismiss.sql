-- Lets employees dismiss a non-approval-required notification from their own
-- feed without affecting other users or requiring admin deactivation.
ALTER TABLE public.notification_reads
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;
