-- Add missing FK constraints so deleting a profile cascades through all related tables.

-- notification_reads: track which user read which notification
ALTER TABLE notification_reads
  ADD CONSTRAINT notification_reads_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- report_submissions: employee's submitted reports
ALTER TABLE report_submissions
  ADD CONSTRAINT report_submissions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- report_submissions.sent_by: admin who sent the report (preserve record, clear reference)
ALTER TABLE report_submissions
  ADD CONSTRAINT report_submissions_sent_by_fkey
    FOREIGN KEY (sent_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- user_monthly_approvals: per-employee monthly approval records
ALTER TABLE user_monthly_approvals
  ADD CONSTRAINT user_monthly_approvals_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- user_monthly_approvals.approved_by: admin who approved (preserve record, clear reference)
ALTER TABLE user_monthly_approvals
  ADD CONSTRAINT user_monthly_approvals_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- monthly_report_approvals.approved_by: was NO ACTION — change to SET NULL so deleting
-- an admin who approved monthly reports doesn't block their account deletion.
ALTER TABLE monthly_report_approvals
  DROP CONSTRAINT monthly_report_approvals_approved_by_fkey;
ALTER TABLE monthly_report_approvals
  ADD CONSTRAINT monthly_report_approvals_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
