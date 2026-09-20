const express = require('express');
const { z }   = require('zod');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const asyncHandler = require('../middleware/asyncHandler');
const { safeExt } = require('../lib/safeExt');
const { isSafeUrl } = require('../lib/validateUrl');

const router = express.Router();

const TutorialSchema = z.object({
  title:              z.string().trim().min(1).max(200),
  device_id:          z.string().max(100).optional(),
  device_name_other:  z.string().trim().max(100).optional(),
  description:        z.string().max(2000).optional(),
  source_type:        z.enum(['upload', 'link']),
  storage_path:       z.string().max(500).optional(),
  external_url:       z.string().max(2000).optional(),
  sort_order:         z.coerce.number().optional().default(0),
});
const TutorialPatchSchema = z.object({
  title:              z.string().trim().min(1).max(200).optional(),
  device_id:          z.string().max(100).optional(),
  device_name_other:  z.string().trim().max(100).optional(),
  description:        z.string().max(2000).optional(),
  sort_order:         z.coerce.number().optional(),
});

const BUCKET = 'tutorial-videos';

async function withSignedUrl(row) {
  if (row.source_type !== 'upload' || !row.storage_path) {
    return { ...row, video_signed_url: null };
  }
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 604800);
  return { ...row, video_signed_url: data?.signedUrl || null };
}

// GET /api/tutorials — all authenticated
router.get('/', auth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('tutorial_videos')
    .select('id, title, description, source_type, storage_path, external_url, sort_order, device_name_other, device_id, device_catalog(name)')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  const rows = (data || []).map(r => ({
    ...r,
    device_name: r.device_catalog?.name || r.device_name_other || null,
  }));
  const withUrls = await Promise.all(rows.map(withSignedUrl));
  res.json(withUrls);
}));

// POST /api/tutorials/upload-url — admin: get a direct-to-storage signed upload URL
router.post('/upload-url', auth, adminAuth, asyncHandler(async (req, res) => {
  const { filename } = req.body;
  if (!filename?.trim()) return res.status(400).json({ error: 'נדרש שם קובץ' });

  const ext = safeExt(filename);
  const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ uploadUrl: data.signedUrl, token: data.token, storagePath });
}));

// POST /api/tutorials — admin: create row
router.post('/', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = TutorialSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { title, device_id, device_name_other, description, source_type, storage_path, external_url, sort_order } = parsed.data;
  if (source_type === 'upload' && !storage_path) return res.status(400).json({ error: 'נדרש נתיב אחסון עבור קבצים שהועלו' });
  if (source_type === 'link' && !isSafeUrl(external_url)) return res.status(400).json({ error: 'נדרשת כתובת URL תקינה (http/https) עבור קישורים' });

  const { data, error } = await supabase
    .from('tutorial_videos')
    .insert({
      title: title.trim(),
      device_id: device_id || null,
      device_name_other: device_name_other || null,
      description: description || null,
      source_type,
      storage_path: source_type === 'upload' ? storage_path : null,
      external_url: source_type === 'link' ? external_url.trim() : null,
      sort_order: sort_order ?? 0,
    })
    .select('id, title, description, source_type, storage_path, external_url, sort_order, device_name_other, device_id')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(await withSignedUrl(data));
}));

// POST /api/tutorials/reorder — admin
router.post('/reorder', auth, adminAuth, asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'נדרש מערך פריטים' });

  const { error } = await supabase
    .from('tutorial_videos')
    .upsert(items.map(({ id, sort_order }) => ({ id, sort_order })), { onConflict: 'id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}));

// PATCH /api/tutorials/:id — admin: metadata only, no file/link swap
router.patch('/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const parsed = TutorialPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { title, device_id, device_name_other, description, sort_order } = parsed.data;
  const updates = {};
  if (title             !== undefined) updates.title = title;
  if (device_id         !== undefined) updates.device_id = device_id || null;
  if (device_name_other !== undefined) updates.device_name_other = device_name_other || null;
  if (description       !== undefined) updates.description = description;
  if (sort_order        !== undefined) updates.sort_order = sort_order;

  const { data, error } = await supabase
    .from('tutorial_videos')
    .update(updates)
    .eq('id', req.params.id)
    .select('id, title, description, source_type, storage_path, external_url, sort_order, device_name_other, device_id')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(await withSignedUrl(data));
}));

// DELETE /api/tutorials/:id — admin: also deletes the storage object for uploads
router.delete('/:id', auth, adminAuth, asyncHandler(async (req, res) => {
  const { data: existing, error: fetchErr } = await supabase
    .from('tutorial_videos')
    .select('source_type, storage_path')
    .eq('id', req.params.id)
    .single();
  if (fetchErr) return res.status(500).json({ error: fetchErr.message });

  const { error } = await supabase.from('tutorial_videos').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  if (existing?.source_type === 'upload' && existing.storage_path) {
    await supabase.storage.from(BUCKET).remove([existing.storage_path]);
  }
  res.json({ success: true });
}));

module.exports = router;
