const supabaseAuth = require('../supabaseAuth');

async function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'חסר טוקן או שהוא אינו תקין' });
  }
  const token = header.slice(7);
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'הטוקן אינו תקין או שפג תוקפו' });
  }
  req.userId = user.id;
  next();
}

module.exports = authMiddleware;
