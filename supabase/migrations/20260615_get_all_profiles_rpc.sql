-- RPC used by the admin backend to read all profiles, bypassing RLS.
-- SECURITY DEFINER so it runs as the function owner (postgres), not the caller.
-- REVOKE from public and authenticated so only the service_role key (backend) can call it.

CREATE OR REPLACE FUNCTION get_all_profiles()
RETURNS SETOF profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM profiles ORDER BY first_name, last_name;
$$;

REVOKE EXECUTE ON FUNCTION get_all_profiles() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_all_profiles() FROM authenticated;
GRANT  EXECUTE ON FUNCTION get_all_profiles() TO service_role;
