-- Same hardening as increment_catalog_stock (20261016_supplier_reorders.sql): only the backend
-- (service role) may change stock, so block direct RPC calls with the public anon key.
ALTER FUNCTION decrement_catalog_stock(UUID, INTEGER) SET search_path = public;

REVOKE EXECUTE ON FUNCTION decrement_catalog_stock(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION decrement_catalog_stock(UUID, INTEGER) TO service_role;
