-- CHECK constraints: prevent negative numeric fields in entries
ALTER TABLE entries
  ADD CONSTRAINT chk_entries_positive
  CHECK (
    insurance_tests       >= 0 AND
    screening_tests       >= 0 AND
    mixed_screening_tests >= 0 AND
    partial_tests         >= 0 AND
    kilometers            >= 0 AND
    office_hours          >= 0 AND
    food_expense          >= 0 AND
    parking_expense       >= 0
  );

-- Partial index for cron query: notifications due for activation
CREATE INDEX IF NOT EXISTS idx_notifications_active_scheduled
  ON notifications (is_active, scheduled_for)
  WHERE is_active = false AND scheduled_for IS NOT NULL;

-- Index for per-user notification reads
CREATE INDEX IF NOT EXISTS idx_notification_reads_user
  ON notification_reads (user_id);

-- Index for per-user equipment lookups
CREATE INDEX IF NOT EXISTS idx_user_equipment_user
  ON user_equipment (user_id);
