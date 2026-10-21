-- Optional free-text note the employee writes on an equipment order (special request / item not in catalog)
ALTER TABLE equipment_orders ADD COLUMN note TEXT;
