-- Replaces the old fixed-5-type user_equipment table with an admin-managed
-- device catalog + employee monthly self-report recap.
DROP TABLE IF EXISTS user_equipment CASCADE;

-- Catalog of devices admin can track (replaces the old hardcoded 5 equipment types)
CREATE TABLE device_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Live "what does this employee currently have" state — written by employee
-- self-report and by admin override alike.
CREATE TABLE user_devices (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES device_catalog(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, device_id)
);

-- Tracks monthly self-report submissions (gate + "last reported" timestamp only,
-- no device snapshot — user_devices is the single live source of truth).
CREATE TABLE equipment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, month)
);

-- RLS
ALTER TABLE device_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_reports ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read the catalog (employees need it for the recap popup)
CREATE POLICY "device_catalog_read" ON device_catalog FOR SELECT USING (auth.role() = 'authenticated');
-- Only service role (backend) writes to any of these tables
CREATE POLICY "device_catalog_admin" ON device_catalog FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "user_devices_admin" ON user_devices FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "equipment_reports_admin" ON equipment_reports FOR ALL USING (auth.role() = 'service_role');
