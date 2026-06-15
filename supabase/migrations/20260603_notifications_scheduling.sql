ALTER TABLE notifications
  ADD COLUMN scheduled_for   timestamptz,
  ADD COLUMN recurrence_days int2[],
  ADD COLUMN recurrence_time text;

COMMENT ON COLUMN notifications.scheduled_for   IS 'NULL = immediate/already active. Future timestamp = activate when cron fires after this time.';
COMMENT ON COLUMN notifications.recurrence_days IS 'Weekday numbers 0-6 (Sun=0). Non-null = recurring; after activation the cron inserts next occurrence.';
COMMENT ON COLUMN notifications.recurrence_time IS 'HH:MM in Israel local time. Used with recurrence_days to compute next scheduled_for.';
