const supabase = require('../supabase');

// Must be used after the auth middleware (requires req.userId to be set).
async function adminAuth(req, res, next) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', req.userId)
    .single();

  if (!profile?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = adminAuth;
