-- Employee time-off / sick-day requests: submitted by employees, approved or
-- rejected by an admin. No DB-level link to `entries` — an approved request
-- simply means no entry row is expected for those dates.
CREATE TABLE time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('vacation', 'sick', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by UUID REFERENCES profiles(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT end_after_start CHECK (end_date >= start_date)
);

ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
-- No authenticated-read policy: this is a private per-user resource, the
-- backend (service-role key) is the only intended access path.
CREATE POLICY "time_off_admin" ON time_off_requests FOR ALL USING (auth.role() = 'service_role');
