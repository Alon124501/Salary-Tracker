-- Per-employee configurable km-driving bonus (admin-set, replaces the
-- hardcoded "+100₪ at >=100km for everyone" rule in lib/payCalc.js).
-- Defaults match today's hardcoded constants so existing employees are
-- unaffected until an admin explicitly changes them in the Compensation tab.
ALTER TABLE profiles
  ADD COLUMN km_bonus_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN km_bonus_threshold numeric NOT NULL DEFAULT 100,
  ADD COLUMN km_bonus_amount numeric NOT NULL DEFAULT 100;
