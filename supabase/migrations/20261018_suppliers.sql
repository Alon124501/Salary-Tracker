-- Shared supplier list, so an admin picks a supplier for a catalog item instead of retyping details.
-- equipment_catalog keeps its inline supplier_* columns as a synced snapshot (the backend copies
-- them from the linked supplier on save) so reorder grouping and supplier_orders stay unchanged.
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  company_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Supplier contact data is admin-only (catalog endpoint hides it from employees too),
-- so no authenticated-read policy here.
CREATE POLICY "suppliers_admin" ON suppliers FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE equipment_catalog
  ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- Seed one supplier per company ID, using that company's most common detail combination.
INSERT INTO suppliers (company_name, contact_name, email, phone, whatsapp, company_id)
SELECT
  CASE WHEN supplier_contact_name LIKE '%בע"מ%' THEN supplier_contact_name END,
  supplier_contact_name, supplier_email, supplier_phone, supplier_whatsapp, supplier_company_id
FROM (
  SELECT DISTINCT ON (supplier_company_id)
    supplier_contact_name, supplier_email, supplier_phone, supplier_whatsapp, supplier_company_id
  FROM (
    SELECT supplier_contact_name, supplier_email, supplier_phone, supplier_whatsapp, supplier_company_id,
           COUNT(*) AS n
    FROM equipment_catalog
    WHERE supplier_company_id IS NOT NULL
    GROUP BY 1, 2, 3, 4, 5
  ) combos
  ORDER BY supplier_company_id, n DESC
) best;

-- Link only items whose details exactly match; malformed rows stay unlinked for manual review.
UPDATE equipment_catalog c
SET supplier_id = s.id
FROM suppliers s
WHERE c.supplier_company_id = s.company_id
  AND c.supplier_contact_name IS NOT DISTINCT FROM s.contact_name
  AND c.supplier_email        IS NOT DISTINCT FROM s.email
  AND c.supplier_phone        IS NOT DISTINCT FROM s.phone
  AND c.supplier_whatsapp     IS NOT DISTINCT FROM s.whatsapp;
