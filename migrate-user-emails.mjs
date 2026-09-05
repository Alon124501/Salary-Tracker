/**
 * One-off migration: moves existing users' Supabase Auth email from the old
 * synthetic address (`${username}@salary-tracker.app`) to their real
 * `profiles.email`, so they can log in with their real email going forward.
 *
 * Defaults to --dry-run (prints only). Pass --apply to actually mutate.
 *
 * Usage:
 *   node migrate-user-emails.mjs            # dry run
 *   node migrate-user-emails.mjs --apply     # real run
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: './backend/.env' });

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');

const supabase = createClient(SUPA_URL, SUPA_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const { data: profiles, error } = await supabase.from('profiles').select('id, username, email');
  if (error) {
    console.error('Failed to fetch profiles:', error.message);
    process.exitCode = 1;
    return;
  }

  const emailCounts = {};
  for (const p of profiles) {
    if (!p.email) continue;
    const key = p.email.toLowerCase();
    emailCounts[key] = (emailCounts[key] || 0) + 1;
  }

  const buckets = { updated: [], missing_email: [], invalid_email: [], duplicate_email: [], update_failed: [] };

  for (const p of profiles) {
    if (!p.email) {
      buckets.missing_email.push(p);
      continue;
    }
    if (!EMAIL_RE.test(p.email)) {
      buckets.invalid_email.push(p);
      continue;
    }
    if (emailCounts[p.email.toLowerCase()] > 1) {
      buckets.duplicate_email.push(p);
      continue;
    }

    if (!APPLY) {
      buckets.updated.push(p);
      continue;
    }

    try {
      const { error: updErr } = await supabase.auth.admin.updateUserById(p.id, {
        email: p.email,
        email_confirm: true,
      });
      if (updErr) throw updErr;
      buckets.updated.push(p);
    } catch (err) {
      buckets.update_failed.push({ ...p, reason: err.message });
    }
  }

  console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'} — ${profiles.length} profiles scanned\n`);
  for (const [name, rows] of Object.entries(buckets)) {
    console.log(`${name}: ${rows.length}`);
    for (const r of rows) {
      console.log(`  - ${r.id} | ${r.username} | ${r.email || '(none)'}${r.reason ? ' | ' + r.reason : ''}`);
    }
  }

  if (!APPLY) {
    console.log('\nThis was a dry run — no changes were made. Re-run with --apply to update Supabase Auth emails.');
  }
}

main();
