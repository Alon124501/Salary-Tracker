-- Supplier reorder agent: when a catalog item's stock drops to its reorder threshold,
-- a daily check drafts a purchase order per supplier (with an AI-suggested quantity).
-- Nothing is sent to a supplier until an admin approves it.

ALTER TABLE equipment_catalog
  ADD COLUMN reorder_threshold INTEGER,          -- NULL = auto-reorder off for this item
  ADD COLUMN reorder_qty_boxes INTEGER,          -- default boxes to order when triggered
  -- 'box': stock_qty counts packs (most items, e.g. "HbA1C (חבילה)"); 'unit': counts single items
  -- (e.g. "קפילרות (יחידה)"), so receiving N boxes adds N × units_per_box
  ADD COLUMN stock_unit TEXT NOT NULL DEFAULT 'box' CHECK (stock_unit IN ('unit', 'box'));

CREATE TABLE supplier_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGINT GENERATED ALWAYS AS IDENTITY (START WITH 1001) UNIQUE, -- in the email subject, matches replies
  supplier_key TEXT NOT NULL,
  supplier_contact_name TEXT,
  supplier_email TEXT,
  supplier_whatsapp TEXT,
  supplier_phone TEXT,
  supplier_company_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'received', 'cancelled')),
  channel TEXT CHECK (channel IN ('email', 'whatsapp')),
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  -- Latest supplier reply, read from the mailbox and classified by AI (lib/supplierReplies.js)
  reply_status TEXT CHECK (reply_status IN ('confirmed', 'partial', 'out_of_stock', 'price_change', 'question', 'other')),
  reply_summary TEXT,
  reply_delivery_date TEXT,
  reply_received_at TIMESTAMPTZ,
  reply_message_id TEXT,
  reply_web_link TEXT
);

CREATE TABLE supplier_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
  catalog_id UUID REFERENCES equipment_catalog(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT,
  rule_qty_boxes INTEGER NOT NULL,
  ai_qty_boxes INTEGER,
  ai_reason TEXT,
  qty_boxes INTEGER NOT NULL CHECK (qty_boxes > 0),
  unit_price_incl_vat NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX supplier_orders_status_idx ON supplier_orders (status);
CREATE INDEX supplier_order_items_order_idx ON supplier_order_items (order_id);
CREATE INDEX supplier_order_items_catalog_idx ON supplier_order_items (catalog_id);

ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_order_items ENABLE ROW LEVEL SECURITY;

-- Service-role only (like equipment_orders): supplier contacts and prices are admin data,
-- so no authenticated-read policy.
CREATE POLICY "supplier_orders_admin" ON supplier_orders FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "supplier_order_items_admin" ON supplier_order_items FOR ALL USING (auth.role() = 'service_role');

-- Mirror of decrement_catalog_stock: adds received stock atomically, reports whether a row matched.
CREATE FUNCTION increment_catalog_stock(p_catalog_id UUID, p_qty INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE equipment_catalog SET stock_qty = stock_qty + p_qty WHERE id = p_catalog_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Only the backend (service role) may change stock; block direct RPC calls with the public anon key
REVOKE EXECUTE ON FUNCTION increment_catalog_stock(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_catalog_stock(UUID, INTEGER) TO service_role;
