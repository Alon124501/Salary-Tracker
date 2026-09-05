const { createClient } = require('@supabase/supabase-js');

// Dedicated client for auth-session calls (signInWithPassword, getUser) only.
// Kept separate from ../supabase.js because signInWithPassword sets an
// in-memory session on whatever client calls it; if that client is also used
// for privileged .from()/.rpc() queries, the SDK starts sending the logged-in
// user's JWT instead of the service-role key on every later query in that
// process, silently downgrading every subsequent request to that user's role.
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

module.exports = supabaseAuth;
