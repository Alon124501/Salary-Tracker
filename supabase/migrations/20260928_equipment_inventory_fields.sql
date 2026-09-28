-- Extend equipment_catalog with supplier/pricing/packaging fields and a live stock count,
-- so consumable products can be mapped 1:1 against the medical-consumables-pricing.xlsx source
-- and fulfilling an order can decrement stock atomically.

ALTER TABLE equipment_catalog
  ADD COLUMN sku TEXT,
  ADD COLUMN supplier_contact_name TEXT,
  ADD COLUMN supplier_email TEXT,
  ADD COLUMN supplier_phone TEXT,
  ADD COLUMN supplier_whatsapp TEXT,
  ADD COLUMN supplier_company_id TEXT,
  ADD COLUMN price_excl_vat NUMERIC(10,2),
  ADD COLUMN price_incl_vat NUMERIC(10,2),
  ADD COLUMN vat_amount NUMERIC(10,2),
  ADD COLUMN units_per_box INTEGER,
  ADD COLUMN stock_qty INTEGER NOT NULL DEFAULT 0;

-- Atomic decrement, avoids read-modify-write races when an admin fulfills an order.
-- Negative stock is allowed by design (admin UI flags it) rather than blocked.
CREATE OR REPLACE FUNCTION decrement_catalog_stock(p_catalog_id UUID, p_qty INTEGER)
RETURNS VOID AS $$
  UPDATE equipment_catalog SET stock_qty = stock_qty - p_qty WHERE id = p_catalog_id;
$$ LANGUAGE sql;
