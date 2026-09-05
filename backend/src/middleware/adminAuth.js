const supabase = require('../supabase');

// Must be used after the auth middleware (requires req.userId to be set).
async function adminAuth(req, res, next) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', req.userId)
    .single();

  if (error) {
    console.error('[adminAuth] profile lookup failed:', error.message);
    return res.status(500).json({ error: 'אימות הרשאות הניהול נכשל. נסה שוב.' });
  }
  if (!profile?.is_admin) {
    return res.status(403).json({ error: 'נדרשת גישת מנהל' });
  }
  next();
}

module.exports = adminAuth;
