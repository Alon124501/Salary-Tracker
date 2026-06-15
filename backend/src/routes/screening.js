'use strict';
const express = require('express');
const multer = require('multer');
const archiver = require('archiver');
const ExcelJS = require('exceljs');
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
router.post('/companies', adminAuth, upload.fields([{ name: 'logo' }, { name: 'brochure' }]), async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Company name is required' });

  const logoFile = req.files?.logo?.[0];
  const brochureFile = req.files?.brochure?.[0];

  const logo_url = logoFile ? await uploadLogo(logoFile) : null;
  const brochure_url = brochureFile ? await uploadBrochure(brochureFile) : null;

  const requires_vouchers = req.body.requires_vouchers === 'true' || req.body.requires_vouchers === true;

  const { data, error } = await supabase
    .from('screening_companies')
    .insert({ name: name.trim(), logo_url, brochure_url, requires_vouchers })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/screening/companies/:id  (admin)
router.put('/companies/:id', adminAuth, upload.fields([{ name: 'logo' }, { name: 'brochure' }]), async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Company name is required' });

  const updates = { name: name.trim() };
  const logoFile = req.files?.logo?.[0];
  const brochureFile = req.files?.brochure?.[0];

  if (logoFile) {
    const logo_url = await uploadLogo(logoFile);
    if (logo_url) updates.logo_url = logo_url;
  }
  if (brochureFile) {
    const brochure_url = await uploadBrochure(brochureFile);
    if (brochure_url) updates.brochure_url = brochure_url;
  }
  updates.requires_vouchers = req.body.requires_vouchers === 'true' || req.body.requires_vouchers === true;

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
router.post('/companies/:id/branches', adminAuth, upload.none(), async (req, res) => {
  const { name, contacts, requires_echo_bed, test_types, registration_url } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Branch name is required' });

  let parsedContacts;
  try {
    parsedContacts = contacts
      ? (typeof contacts === 'string' ? JSON.parse(contacts) : contacts)
      : [];
  } catch {
    return res.status(400).json({ error: 'Invalid contacts format' });
  }

  const { data, error } = await supabase
    .from('screening_branches')
    .insert({
      company_id: req.params.id,
      name: name.trim(),
      contacts: parsedContacts,
      requires_echo_bed: requires_echo_bed === 'true' || requires_echo_bed === true,
      test_types: Array.isArray(test_types) ? test_types : (test_types ? JSON.parse(test_types) : []),
      registration_url: registration_url?.trim() || null,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/screening/branches/:id  (admin)
router.put('/branches/:id', adminAuth, upload.none(), async (req, res) => {
  const { name, contacts, requires_echo_bed, test_types, registration_url } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Branch name is required' });

  let parsedContacts;
  try {
    parsedContacts = contacts
      ? (typeof contacts === 'string' ? JSON.parse(contacts) : contacts)
      : [];
  } catch {
    return res.status(400).json({ error: 'Invalid contacts format' });
  }

  const updates = {
    name: name.trim(),
    contacts: parsedContacts,
    requires_echo_bed: requires_echo_bed === 'true' || requires_echo_bed === true,
    test_types: Array.isArray(test_types) ? test_types : (test_types ? JSON.parse(test_types) : []),
    registration_url: registration_url?.trim() || null,
  };

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

// ── Vouchers ───────────────────────────────────────────────────────────────

async function uploadVoucherFile(file, branchId, workDate, userId) {
  const ext = file.originalname.split('.').pop() || 'jpg';
  const filePath = `${branchId}/${workDate}/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('screening-vouchers')
    .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) return null;
  return filePath;
}

async function voucherSignedUrl(filePath) {
  const { data } = await supabase.storage
    .from('screening-vouchers')
    .createSignedUrl(filePath, 604800);
  return data?.signedUrl ?? null;
}

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff']);

async function ocrImage(buffer) {
  try {
    const Tesseract = require('tesseract.js');
    const { data: { text } } = await Tesseract.recognize(buffer, 'heb+eng', {
      cachePath: '/tmp',
      logger: () => {},
    });
    return text.trim();
  } catch {
    return null;
  }
}

// Extract Israeli ID numbers (exactly 9 digits) and voucher numbers (5-12 digits, not 9)
function extractFields(text) {
  if (!text) return { idNumbers: '', voucherNumber: '' };
  const allNumbers = [...text.matchAll(/\b(\d+)\b/g)].map(m => m[1]);
  const ids = allNumbers.filter(n => n.length === 9);
  const vouchers = allNumbers.filter(n => n.length >= 5 && n.length !== 9 && n.length <= 12);
  return {
    idNumbers: ids.join(', ') || '–',
    voucherNumber: vouchers[0] || '–',
  };
}

// GET /api/screening/branches/:id/vouchers/download?date=YYYY-MM-DD  (admin only)
router.get('/branches/:id/vouchers/download', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date query param required' });

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', req.userId).single();
  if (!profile?.is_admin) return res.status(403).json({ error: 'Admin access required' });

  const { data: vouchers, error } = await supabase
    .from('screening_vouchers')
    .select('*, profiles(first_name, last_name, username)')
    .eq('branch_id', req.params.id)
    .eq('work_date', date)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  if (!vouchers?.length) return res.status(404).json({ error: 'No vouchers for this date' });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="vouchers-${date}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', () => res.destroy());
  archive.pipe(res);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Vouchers');
  sheet.columns = [
    { header: '#', key: 'num', width: 5 },
    { header: 'שם עובד', key: 'employee', width: 25 },
    { header: 'מספר זהות', key: 'idNumbers', width: 30 },
    { header: 'מספר שובר', key: 'voucherNumber', width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  const downloadResults = await Promise.all(vouchers.map((v, i) => {
    const p = v.profiles;
    const employeeName = (p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username : 'unknown')
      .replace(/\s+/g, '_');
    const safeFileName = `${i + 1}_${employeeName}_${v.file_name}`;
    const ext = v.file_name.split('.').pop().toLowerCase();
    const isImage = IMAGE_EXTS.has(ext);
    const employeeDisplay = p
      ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username
      : 'unknown';
    return supabase.storage.from('screening-vouchers').download(v.file_url).then(async ({ data: fileData, error: dlErr }) => {
      if (dlErr || !fileData) return null;
      const buf = Buffer.from(await fileData.arrayBuffer());
      const rawText = isImage ? await ocrImage(buf) : null;
      const { idNumbers, voucherNumber } = extractFields(rawText);
      return { i, buf, safeFileName, isImage, employeeDisplay, idNumbers, voucherNumber };
    });
  }));

  for (const result of downloadResults) {
    if (!result) continue;
    const { i, buf, safeFileName, isImage, employeeDisplay, idNumbers, voucherNumber } = result;
    archive.append(buf, { name: safeFileName });
    sheet.addRow({
      num: i + 1,
      employee: employeeDisplay,
      idNumbers: isImage ? idNumbers : 'PDF – OCR skipped',
      voucherNumber: isImage ? voucherNumber : 'PDF – OCR skipped',
    });
  }

  const xlsxBuf = await workbook.xlsx.writeBuffer();
  archive.append(Buffer.from(xlsxBuf), { name: `vouchers-${date}.xlsx` });

  await archive.finalize();
});

// GET /api/screening/branches/:id/vouchers?date=YYYY-MM-DD
router.get('/branches/:id/vouchers', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date query param required' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', req.userId)
    .single();
  const isAdmin = !!profile?.is_admin;

  let query = supabase
    .from('screening_vouchers')
    .select('*, profiles(first_name, last_name, username)')
    .eq('branch_id', req.params.id)
    .eq('work_date', date)
    .order('created_at', { ascending: false });

  if (!isAdmin) query = query.eq('user_id', req.userId);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const rows = await Promise.all((data || []).map(async v => {
    const signed_url = await voucherSignedUrl(v.file_url);
    const p = v.profiles;
    return {
      id: v.id,
      file_name: v.file_name,
      file_url: v.file_url,
      signed_url,
      created_at: v.created_at,
      user_id: v.user_id,
      ...(isAdmin && p ? { user_label: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username } : {}),
    };
  }));

  res.json(rows);
});

// POST /api/screening/branches/:id/vouchers
router.post('/branches/:id/vouchers', upload.single('voucher'), async (req, res) => {
  const { work_date } = req.body;
  if (!work_date) return res.status(400).json({ error: 'work_date is required' });
  if (!req.file) return res.status(400).json({ error: 'voucher file is required' });

  const filePath = await uploadVoucherFile(req.file, req.params.id, work_date, req.userId);
  if (!filePath) return res.status(500).json({ error: 'File upload failed' });

  const { data, error } = await supabase
    .from('screening_vouchers')
    .insert({
      branch_id: req.params.id,
      user_id: req.userId,
      work_date,
      file_url: filePath,
      file_name: req.file.originalname,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  const signed_url = await voucherSignedUrl(filePath);
  res.status(201).json({ ...data, signed_url });
});

// DELETE /api/screening/vouchers/:id
router.delete('/vouchers/:id', async (req, res) => {
  const { data: voucher, error: fetchErr } = await supabase
    .from('screening_vouchers')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (fetchErr || !voucher) return res.status(404).json({ error: 'Voucher not found' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', req.userId)
    .single();
  const isAdmin = !!profile?.is_admin;

  if (voucher.user_id !== req.userId && !isAdmin) {
    return res.status(403).json({ error: 'Not authorised' });
  }

  const { error: storageErr } = await supabase.storage.from('screening-vouchers').remove([voucher.file_url]);
  if (storageErr) return res.status(500).json({ error: 'Failed to delete file from storage' });
  const { error } = await supabase.from('screening_vouchers').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
