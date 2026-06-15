-- Catalog of items admin can offer
CREATE TABLE equipment_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders submitted by employees
CREATE TABLE equipment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  items JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE equipment_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_orders ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read catalog
CREATE POLICY "catalog_read" ON equipment_catalog FOR SELECT USING (auth.role() = 'authenticated');
-- Only service role (backend) manages catalog and orders
CREATE POLICY "catalog_admin" ON equipment_catalog FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "orders_admin" ON equipment_orders FOR ALL USING (auth.role() = 'service_role');
