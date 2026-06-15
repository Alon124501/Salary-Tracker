-- Admin-set compensation bonuses for employees (e.g. urgent test pay)
CREATE TABLE admin_bonuses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  amount      REAL        NOT NULL CHECK (amount > 0),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bonuses_service" ON admin_bonuses FOR ALL USING (auth.role() = 'service_role');
