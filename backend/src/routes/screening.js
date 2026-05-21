const express = require('express');
const multer = require('multer');
const supabase = require('../supabase');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();
router.use(auth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function uploadLogo(file) {
  const ext = file.originalname.split('.').pop() || 'jpg';
  const filePath = `logos/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('screening-logos')
    .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
  if (error) return null;
  const { data: { publicUrl } } = supabase.storage.from('screening-logos').getPublicUrl(filePath);
  return publicUrl;
}

async function uploadBrochure(file) {
  const ext = file.originalname.split('.').pop() || 'jpg';
  const filePath = `brochures/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('branch-brochures')
    .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
  if (error) return null;
  const { data: { publicUrl } } = supabase.storage.from('branch-brochures').getPublicUrl(filePath);
  return publicUrl;
}

// ── Companies ──────────────────────────────────────────────────────────────

// GET /api/screening/companies
router.get('/companies', async (req, res) => {
  const { data, error } = await supabase
    .from('screening_companies')
    .select('*')
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/screening/companies  (admin)
router.post('/companies', adminAuth, upload.single('logo'), async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Company name is required' });

  const logo_url = req.file ? await uploadLogo(req.file) : null;

  const { data, error } = await supabase
    .from('screening_companies')
    .insert({ name: name.trim(), logo_url })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/screening/companies/:id  (admin)
router.put('/companies/:id', adminAuth, upload.single('logo'), async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Company name is required' });

  const updates = { name: name.trim() };
  if (req.file) {
    const logo_url = await uploadLogo(req.file);
    if (logo_url) updates.logo_url = logo_url;
  }

  const { data, error } = await supabase
    .from('screening_companies')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/screening/companies/:id  (admin)
router.delete('/companies/:id', adminAuth, async (req, res) => {
  const { error } = await supabase
    .from('screening_companies')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── Branches ───────────────────────────────────────────────────────────────

// GET /api/screening/companies/:id/branches
router.get('/companies/:id/branches', async (req, res) => {
  const { data, error } = await supabase
    .from('screening_branches')
    .select('*')
    .eq('company_id', req.params.id)
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/screening/companies/:id/branches  (admin)
router.post('/companies/:id/branches', adminAuth, upload.single('brochure'), async (req, res) => {
  const { name, contact_name, contact_phone, requires_echo_bed, test_types, registration_url } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Branch name is required' });

  const brochure_url = req.file ? await uploadBrochure(req.file) : null;

  const { data, error } = await supabase
    .from('screening_branches')
    .insert({
      company_id: req.params.id,
      name: name.trim(),
      contact_name: contact_name?.trim() || null,
      contact_phone: contact_phone?.trim() || null,
      requires_echo_bed: requires_echo_bed === 'true' || requires_echo_bed === true,
      test_types: Array.isArray(test_types) ? test_types : (test_types ? JSON.parse(test_types) : []),
      registration_url: registration_url?.trim() || null,
      brochure_url,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/screening/branches/:id  (admin)
router.put('/branches/:id', adminAuth, upload.single('brochure'), async (req, res) => {
  const { name, contact_name, contact_phone, requires_echo_bed, test_types, registration_url } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Branch name is required' });

  const updates = {
    name: name.trim(),
    contact_name: contact_name?.trim() || null,
    contact_phone: contact_phone?.trim() || null,
    requires_echo_bed: requires_echo_bed === 'true' || requires_echo_bed === true,
    test_types: Array.isArray(test_types) ? test_types : (test_types ? JSON.parse(test_types) : []),
    registration_url: registration_url?.trim() || null,
  };

  if (req.file) {
    const brochure_url = await uploadBrochure(req.file);
    if (brochure_url) updates.brochure_url = brochure_url;
  }

  const { data, error } = await supabase
    .from('screening_branches')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/screening/branches/:id  (admin)
router.delete('/branches/:id', adminAuth, async (req, res) => {
  const { error } = await supabase
    .from('screening_branches')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
