const express = require('express');
const multer = require('multer');
const { z }  = require('zod');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { safeExt } = require('../lib/safeExt');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const CredentialSchema = z.object({
  name:       z.string().trim().min(1).max(100),
  username:   z.string().trim().min(1).max(200),
  password:   z.string().min(1).max(200),
  sort_order: z.coerce.number().optional().default(0),
});
const CredentialPatchSchema = z.object({
  name:     z.string().trim().min(1).max(100).optional(),
  username: z.string().trim().min(1).max(200).optional(),
  password: z.string().min(1).max(200).optional(),
});

async function withSignedUrl(cred) {
  if (!cred.image_url) return { ...cred, image_signed_url: null };
  const { data } = await supabase.storage.from('app-images').createSignedUrl(cred.image_url, 604800);
  return { ...cred, image_signed_url: data?.signedUrl || null };
}

// GET /api/portal/credentials — authenticated
router.get('/credentials', auth, async (req, res) => {
  const { data, error } = await supabase
    .from('app_credentials')
    .select('id, name, username, password, sort_order, image_url')
    .order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  const withUrls = await Promise.all((data || []).map(withSignedUrl));
  res.json(withUrls);
});

// POST /api/portal/credentials — admin
router.post('/credentials', auth, adminAuth, upload.single('image'), async (req, res) => {
  const parsed = CredentialSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { name, username, password, sort_order } = parsed.data;

  let image_url = null;
  if (req.file) {
    const ext = safeExt(req.file.originalname);
    const filePath = `${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('app-images')
      .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });
    if (!uploadErr) image_url = filePath;
  }

  const { data, error } = await supabase
    .from('app_credentials')
    .insert({ name, username, password, sort_order: sort_order ?? 0, image_url })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(await withSignedUrl(data));
});

// POST /api/portal/credentials/reorder — admin
router.post('/credentials/reorder', auth, adminAuth, async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'נדרש מערך פריטים' });

  const { error } = await supabase
    .from('app_credentials')
    .upsert(items.map(({ id, sort_order }) => ({ id, sort_order })), { onConflict: 'id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// PATCH /api/portal/credentials/:id — admin
router.patch('/credentials/:id', auth, adminAuth, upload.single('image'), async (req, res) => {
  const parsed = CredentialPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { name, username, password } = parsed.data;
  const updates = {};
  if (name     !== undefined) updates.name     = name;
  if (username !== undefined) updates.username = username;
  if (password !== undefined) updates.password = password;

  if (req.file) {
    const ext = safeExt(req.file.originalname);
    const filePath = `${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('app-images')
      .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });
    if (!uploadErr) updates.image_url = filePath;
  }

  const { data, error } = await supabase
    .from('app_credentials')
    .update(updates)
    .eq('id', req.params.id)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(await withSignedUrl(data));
});

// DELETE /api/portal/credentials/:id — admin
router.delete('/credentials/:id', auth, adminAuth, async (req, res) => {
  const { error } = await supabase.from('app_credentials').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
