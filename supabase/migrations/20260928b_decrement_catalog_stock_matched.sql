-- decrement_catalog_stock now reports whether it actually matched a catalog row,
-- so the order-fulfillment route can flag line items whose catalog_id no longer exists
-- (deleted/renamed product) instead of silently no-op'ing the stock decrement.
DROP FUNCTION IF EXISTS decrement_catalog_stock(UUID, INTEGER);

CREATE FUNCTION decrement_catalog_stock(p_catalog_id UUID, p_qty INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE equipment_catalog SET stock_qty = stock_qty - p_qty WHERE id = p_catalog_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$ LANGUAGE plpgsql;
