/**
 * End-to-end test for document distribution + mandatory reading approvals.
 * Creates temporary test users, runs the full flow against production, then cleans up.
 *
 * Usage: node e2e-test.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { config } from 'dotenv';

config({ path: './backend/.env' });

const BASE_URL = 'https://salary-tracker-ruddy.vercel.app/api';
const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPA_URL, SUPA_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL  = `e2e-admin-${Date.now()}@salary-tracker.app`;
const TESTER_EMAIL = `e2e-tester-${Date.now()}@salary-tracker.app`;
const ADMIN_USER   = `e2e_admin_${Date.now()}`;
const TESTER_USER  = `e2e_tester_${Date.now()}`;
const PASSWORD     = 'E2eTest#9182!';

let adminToken, testerToken, adminUserId, testerUserId, notifId;
let passed = 0, failed = 0;

// ── Helpers ────────────────────────────────────────────────────────────────

function log(icon, label, detail = '') {
  console.log(`  ${icon} ${label}${detail ? ' → ' + detail : ''}`);
}

function pass(label, detail) { log('✅', label, detail); passed++; }
function fail(label, detail) { log('❌', label, detail); failed++; }
function probe(label, detail) { log('🔍', label, detail); }
function info(label) { log('   ', label); }

async function api(method, path, body, token, isFormData = false) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body
      ? isFormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

// ── Setup: create temp users ───────────────────────────────────────────────

async function setup() {
  console.log('\n── Setup ──────────────────────────────────────────────────');

  // Create admin user in Supabase Auth
  const { data: au, error: ae } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (ae) { fail('Create admin auth user', ae.message); process.exit(1); }
  adminUserId = au.user.id;
  info(`Admin auth user created: ${adminUserId}`);

  // Insert admin profile
  const { error: ape } = await supabase.from('profiles').insert({
    id: adminUserId, username: ADMIN_USER,
    first_name: 'E2E', last_name: 'Admin', is_admin: true,
  });
  if (ape) { fail('Create admin profile', ape.message); process.exit(1); }
  info(`Admin profile inserted`);

  // Create tester user in Supabase Auth
  const { data: tu, error: te } = await supabase.auth.admin.createUser({
    email: TESTER_EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (te) { fail('Create tester auth user', te.message); process.exit(1); }
  testerUserId = tu.user.id;
  info(`Tester auth user created: ${testerUserId}`);

  // Insert tester profile
  const { error: tpe } = await supabase.from('profiles').insert({
    id: testerUserId, username: TESTER_USER,
    first_name: 'E2E', last_name: 'Tester', is_admin: false,
  });
  if (tpe) { fail('Create tester profile', tpe.message); process.exit(1); }
  info(`Tester profile inserted`);

  // Log in as admin
  const { data: as } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: PASSWORD });
  adminToken = as?.session?.access_token;
  if (!adminToken) { fail('Admin login'); process.exit(1); }
  info('Admin token obtained');

  // Log in as tester
  const { data: ts } = await supabase.auth.signInWithPassword({ email: TESTER_EMAIL, password: PASSWORD });
  testerToken = ts?.session?.access_token;
  if (!testerToken) { fail('Tester login'); process.exit(1); }
  info('Tester token obtained');

  console.log('   Setup complete.\n');
}

// ── Tests ──────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('── Step 1: Admin creates notification with uploaded PDF ────');

  // Create a minimal valid PDF in memory
  const pdfBytes = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
    'xref\n0 4\n0000000000 65535 f\n' +
    '0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n' +
    'trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
  );
  const tmpPdf = join(tmpdir(), `e2e-test-${Date.now()}.pdf`);
  writeFileSync(tmpPdf, pdfBytes);

  const fd = new FormData();
  fd.append('title', 'E2E Test Document Notification');
  fd.append('content', 'Please read the attached policy document.');
  fd.append('requires_approval', 'true');
  fd.append('force_view_document', 'true');
  fd.append('type', 'manual');
  fd.append('force_view_document', 'true');
  fd.append('document', new Blob([pdfBytes], { type: 'application/pdf' }), 'test-policy.pdf');

  const { status: cs, data: cd } = await api('POST', '/notifications', fd, adminToken, true);

  if (cs === 201 && cd.id) {
    notifId = cd.id;
    pass('Notification created', `id=${notifId}`);
  } else {
    fail('Notification created', `${cs} ${JSON.stringify(cd)}`);
    return;
  }

  if (cd.force_view_document === true) {
    pass('force_view_document=true in response');
  } else {
    fail('force_view_document missing from response', JSON.stringify(cd.force_view_document));
  }

  // Check DB: document_storage_path should be set
  const { data: dbRow } = await supabase
    .from('notifications').select('document_storage_path, document_file_name, force_view_document')
    .eq('id', notifId).single();

  if (dbRow?.document_storage_path) {
    pass('document_storage_path saved in DB', dbRow.document_storage_path);
  } else {
    fail('document_storage_path missing from DB', JSON.stringify(dbRow));
  }

  if (dbRow?.document_file_name === 'test-policy.pdf') {
    pass('document_file_name saved correctly', dbRow.document_file_name);
  } else {
    fail('document_file_name wrong', JSON.stringify(dbRow?.document_file_name));
  }

  unlinkSync(tmpPdf);

  // ── Step 2: Admin creates notification with external link ──────────────
  console.log('\n── Step 2: Admin creates notification with external link ──');

  const fdLink = new FormData();
  fdLink.append('title', 'E2E Link Notification');
  fdLink.append('content', 'See the linked document.');
  fdLink.append('requires_approval', 'true');
  fdLink.append('force_view_document', 'false');
  fdLink.append('type', 'manual');
  fdLink.append('document_external_url', 'https://drive.google.com/file/d/test123');

  const { status: ls, data: ld } = await api('POST', '/notifications', fdLink, adminToken, true);

  let linkNotifId;
  if (ls === 201 && ld.id) {
    linkNotifId = ld.id;
    pass('Link notification created', `id=${linkNotifId}`);
  } else {
    fail('Link notification created', `${ls} ${JSON.stringify(ld)}`);
  }

  if (ld?.document_external_url) {
    pass('document_external_url stored', ld.document_external_url);
  } else {
    fail('document_external_url missing');
  }

  // ── Step 3: Tester fetches notifications ─────────────────────────────
  console.log('\n── Step 3: Tester fetches notifications ──────────────────');

  const { status: gs, data: gd } = await api('GET', '/notifications', null, testerToken);

  if (gs === 200 && Array.isArray(gd)) {
    pass('Tester GET /notifications', `${gd.length} notification(s) returned`);
  } else {
    fail('Tester GET /notifications', `${gs} ${JSON.stringify(gd)}`);
    return;
  }

  const notif = gd.find(n => n.id === notifId);
  if (notif) {
    pass('Upload notification visible to tester');
  } else {
    fail('Upload notification not found in tester feed');
    return;
  }

  if (notif.document_url) {
    pass('document_url present (signed URL generated)', notif.document_url.substring(0, 60) + '…');
  } else {
    fail('document_url missing from tester response');
  }

  if (notif.document_file_name === 'test-policy.pdf') {
    pass('document_file_name correct in tester response');
  } else {
    fail('document_file_name wrong in tester response', notif.document_file_name);
  }

  if (notif.force_view_document === true) {
    pass('force_view_document=true visible to tester');
  } else {
    fail('force_view_document not set in tester response', JSON.stringify(notif.force_view_document));
  }

  if (notif.document_opened_at === null) {
    pass('document_opened_at is null before opening');
  } else {
    fail('document_opened_at should be null initially', notif.document_opened_at);
  }

  // ── Step 4: Tester opens document ────────────────────────────────────
  console.log('\n── Step 4: Tester opens document ─────────────────────────');

  const { status: os, data: od } = await api('POST', `/notifications/${notifId}/open-document`, null, testerToken);

  if (os === 200 && od.success) {
    pass('POST /open-document succeeded', `opened_at=${od.document_opened_at}`);
  } else {
    fail('POST /open-document failed', `${os} ${JSON.stringify(od)}`);
    return;
  }

  // Verify DB updated
  const { data: readRow } = await supabase
    .from('notification_reads')
    .select('document_opened_at')
    .eq('notification_id', notifId)
    .eq('user_id', testerUserId)
    .single();

  if (readRow?.document_opened_at) {
    pass('document_opened_at persisted in notification_reads', readRow.document_opened_at);
  } else {
    fail('document_opened_at not saved in DB');
  }

  // Calling open-document a second time should preserve original timestamp
  const { data: od2 } = await api('POST', `/notifications/${notifId}/open-document`, null, testerToken);
  probe('Second open-document call preserves original timestamp',
    od.document_opened_at === od2.document_opened_at ? 'same timestamp ✓' : `changed! ${od2.document_opened_at}`
  );

  // Re-fetch feed — document_opened_at should now appear
  const { data: gd2 } = await api('GET', '/notifications', null, testerToken);
  const notif2 = gd2?.find(n => n.id === notifId);
  if (notif2?.document_opened_at) {
    pass('document_opened_at returned in subsequent GET /notifications', notif2.document_opened_at);
  } else {
    fail('document_opened_at missing from feed after opening');
  }

  // ── Step 5: Tester approves ───────────────────────────────────────────
  console.log('\n── Step 5: Tester approves notification ──────────────────');

  const { status: as2, data: ad } = await api('POST', `/notifications/${notifId}/approve`, null, testerToken);

  if (as2 === 200 && ad.success) {
    pass('POST /approve succeeded');
  } else {
    fail('POST /approve failed', `${as2} ${JSON.stringify(ad)}`);
    return;
  }

  // Verify approved_at is set in DB
  const { data: approveRow } = await supabase
    .from('notification_reads')
    .select('approved_at, document_opened_at')
    .eq('notification_id', notifId)
    .eq('user_id', testerUserId)
    .single();

  if (approveRow?.approved_at) {
    pass('approved_at saved in DB', approveRow.approved_at);
  } else {
    fail('approved_at missing from DB');
  }

  // document_opened_at must NOT have been wiped by the approve upsert
  if (approveRow?.document_opened_at) {
    pass('document_opened_at preserved after approve upsert');
  } else {
    fail('document_opened_at was wiped by approve upsert — critical bug');
  }

  // Notification should disappear from tester feed
  const { data: gd3 } = await api('GET', '/notifications', null, testerToken);
  const gone = !gd3?.find(n => n.id === notifId);
  if (gone) {
    pass('Notification no longer in tester feed after approval');
  } else {
    fail('Notification still visible after approval');
  }

  // ── Step 6: Admin compliance view ────────────────────────────────────
  console.log('\n── Step 6: Admin checks compliance modal ─────────────────');

  const { status: cms, data: cmd } = await api('GET', `/notifications/admin/${notifId}/compliance`, null, adminToken);

  if (cms === 200 && cmd.compliance) {
    pass('GET /admin/compliance succeeded', `${cmd.compliance.length} tester(s)`);
  } else {
    fail('GET /admin/compliance failed', `${cms} ${JSON.stringify(cmd)}`);
    return;
  }

  const testerRow = cmd.compliance.find(r => r.user_id === testerUserId);
  if (testerRow) {
    pass('Tester row found in compliance data');
  } else {
    fail('Tester row not found in compliance data');
    return;
  }

  if (testerRow.approved_at) {
    pass('approved_at visible in compliance', testerRow.approved_at);
  } else {
    fail('approved_at missing from compliance row');
  }

  if (testerRow.document_opened_at) {
    pass('document_opened_at visible in compliance', testerRow.document_opened_at);
  } else {
    fail('document_opened_at missing from compliance row');
  }

  // notification object should include document metadata
  if (cmd.notification?.document_storage_path) {
    pass('notification.document_storage_path returned in compliance response');
  } else {
    fail('notification.document_storage_path missing from compliance response');
  }

  // ── Probes ────────────────────────────────────────────────────────────
  console.log('\n── Probes: edge cases ────────────────────────────────────');

  // Unauthenticated open-document → 401
  const { status: unauth } = await api('POST', `/notifications/${notifId}/open-document`, null, null);
  probe('open-document without auth', `${unauth === 401 ? '401 ✓' : unauth + ' unexpected'}`);

  // force_view_document=true but no document → 400
  const fdBad = new FormData();
  fdBad.append('title', 'Bad'); fdBad.append('content', 'Bad');
  fdBad.append('requires_approval', 'true'); fdBad.append('type', 'manual');
  fdBad.append('force_view_document', 'true');
  const { status: badS } = await api('POST', '/notifications', fdBad, adminToken, true);
  probe('force_view_document=true with no document', `${badS === 400 ? '400 ✓' : badS + ' unexpected'}`);

  // Clean up link notification
  await api('DELETE', `/notifications/${linkNotifId}`, null, adminToken);
  await api('DELETE', `/notifications/${notifId}`, null, adminToken);
  probe('Deactivate test notifications', 'done');
}

// ── Teardown ───────────────────────────────────────────────────────────────

async function teardown() {
  console.log('\n── Teardown ───────────────────────────────────────────────');
  if (adminUserId)  await supabase.auth.admin.deleteUser(adminUserId);
  if (testerUserId) await supabase.auth.admin.deleteUser(testerUserId);
  info('Temp users deleted');
}

// ── Main ───────────────────────────────────────────────────────────────────

console.log('=== E2E: Document Distribution + Mandatory Reading Approvals ===');
console.log(`Target: ${BASE_URL}\n`);

try {
  await setup();
  await runTests();
} finally {
  await teardown();
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`Result: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
