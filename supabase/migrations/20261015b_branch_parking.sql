-- Per-branch parking availability, set by admin. NULL = not set (hidden from employees).
ALTER TABLE screening_branches ADD COLUMN has_parking BOOLEAN;
