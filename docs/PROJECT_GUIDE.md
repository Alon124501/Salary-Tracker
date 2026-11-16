# Project guide (agent reference)

Deep reference behind `CLAUDE.md`. `CLAUDE.md` = rules + architecture summary; this file = identifiers, infra, data model, feature index. No secrets here — values live in Vercel env settings and the local, gitignored `backend/.env`.

## Identity

| Thing | Value |
|---|---|
| Prod app | https://salary-tracker-ruddy.vercel.app (API at `/api`) |
| GitHub | `Alon124501/Salary-Tracker`, default branch `master` |
| Vercel project | `salary-tracker` — project + team ids in local `.vercel/project.json` (gitignored; repo is public, so ids are kept out of git) |
| Supabase project | ref = subdomain of `SUPABASE_URL` in local `backend/.env` (gitignored) — the **only** database; local dev hits prod too |
| Brand | "Medical Pay" (Latin); company MPCHECK |

## Supabase

### Auth model
- Users sign up with **username**, not email. Supabase Auth stores a fake address `{username}@salary-tracker.local`.
- Supabase's built-in reset emails can't reach those addresses, so password reset is custom: `password_reset_tokens` table (64-char hex, 1h TTL), email sent via Gmail/Nodemailer (`routes/auth.js`), link to `/reset-password?token=…`.
- Backend verifies the Supabase access token in `middleware/auth.js` via `supabaseAuth.auth.getUser(token)`. `adminAuth` checks `profiles.is_admin`.
- **Two clients, always**: `supabase.js` (service role, data) and `supabaseAuth.js` (auth calls only). Signing in on a client poisons it — later queries run as that user and hit RLS. Same rule for throwaway test scripts.

### Tables (in use by backend)
Core: `profiles`, `entries`, `password_reset_tokens`, `user_monthly_approvals`, `monthly_report_approvals`.
Screening: `screening_companies`, `screening_branches`, `screening_test_catalog`, `screening_vouchers`.
Equipment / devices: `device_catalog`, `user_devices`, `equipment_reports` (weekly recap, `week` = Wednesday-anchored `YYYY-MM-DD`), `equipment_catalog`, `equipment_orders`, `suppliers`, `supplier_orders`, `supplier_order_items`.
Portal / comms: `faq_items`, `app_credentials`, `contacts`, `tutorial_videos`, `notifications`, `notification_reads` (read + `dismissed_at`), `push_subscriptions`.
Work rules: `time_off_requests`, `cancellation_reasons`, `other_test_types`.
Unused/legacy: `admin_bonuses` (created 20260614, no backend reader). Backup snapshots: `entries_backup_20261030` (before cancellation-reasons migration), `screening_branches_backup_20261110` (pending drop). Dropped: `user_equipment`, `report_submissions`.

Early tables (profiles, entries, …) predate the migrations folder; `supabase/schema.sql` is stale. Source of truth = live DB + `supabase/migrations/*.sql`.

### Storage buckets
| Bucket | Access | Used by |
|---|---|---|
| `receipts` | private, signed URLs | entries food/parking/toll receipts, report zip, admin approve |
| `profession-documents` | private | profile documents (`admin.js`) |
| `notification-documents` | private | notification attachments / approval docs |
| `screening-vouchers` | private | per-company vouchers (gated by `requires_vouchers`) |
| `tutorial-videos` | private, **direct-to-storage** signed upload | `routes/tutorials.js` |
| `app-images` | public | Portal app logos |
| `screening-logos` | public | company logos |
| `degree-documents`, `reports` | private | listed in CLAUDE.md; no current `storage.from()` call in `backend/src` — verify before relying on them |
| `branch-brochures` | **deleted** 2026-11-10 | — |

### Migrations
- File name `YYYYMMDD[x]_description.sql`, applied in order, forward-only.
- New table template: create → `ENABLE ROW LEVEL SECURITY` → `authenticated` read policy → `service_role` all policy (see `20260703_device_recap.sql`).
- Apply via Supabase MCP `apply_migration`. If MCP auth fails, the fallback used before: paste SQL into the dashboard SQL editor, then do read-only checks with a node script using the service-role key.
- Apply the migration **before** pushing code that reads new columns. Risky migration → snapshot first (`CREATE TABLE <t>_backup_YYYYMMDD AS SELECT …`).

### Pending cleanup (one migration, run when user confirms)
Drop `screening_branches.performed_test_ids`, `screening_branches.registration_url`, `screening_companies.brochure_url`, and table `screening_branches_backup_20261110`. Nothing reads/writes them. The `COMMENT ON COLUMN` line of `20261110c` may still need running.

## Vercel

- `vercel.json`: build = `npm install` in backend + frontend, then `npm run build --prefix frontend`; output `frontend/dist`; all `/api/(.*)` → `api/index.js` (re-exports `backend/src/app.js`); `maxDuration: 300`.
- Crons (UTC), all require `Authorization: Bearer $CRON_SECRET` (`routes/cron.js`):
  - `/api/cron/monthly-receipts` — `0 2 1 * *` (1st of month)
  - `/api/cron/process-notifications` — `0 8 * * *` (daily; activates scheduled notifications + push)
  - `/api/cron/equipment-agent` — `0 6 * * 0-4` (Sun–Thu; low-stock check → supplier drafts, supplier reply check)
- Deploy = push to `master`. Local commit does nothing. Release tags `vX.Y.Z` per `docs/RELEASE.md`. Rollback = Vercel "promote" an earlier deployment.
- Request/response body limit ~4.5MB (platform). A 413 on proxy upload is usually this, not multer → use direct-to-storage signed upload.
- Env vars UI (changed ~2026-09): Project → Settings → **Environments** → **Production** row → Environment Variables. New/changed vars only apply to **new** deployments — redeploy (`git commit --allow-empty` + push).
- Debug prod 500s: Vercel runtime logs first (MCP `get_runtime_errors` / `get_runtime_logs`).
- `render.yaml` exists but is not the live target.

## Environment variables (names only)

| Var | Required | Purpose |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes | both Supabase clients |
| `FRONTEND_URL` | yes | CORS origin + links in emails (reset, recap) |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | yes | Nodemailer: reset emails, report approvals, monthly receipts, device emails, supplier fallback |
| `CRON_SECRET` | yes | bearer auth on `/api/cron/*` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | optional | Web Push; unset → push no-ops |
| `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `SUPPLIER_SENDER_EMAIL` | optional | supplier emails via Microsoft Graph from the company M365 mailbox (Entra app registration; client secret expires ~2028-10; access scoped to one mailbox via Exchange RBAC). Unset → Gmail with Reply-To |
| `ANTHROPIC_API_KEY` | optional | AI reorder quantity + supplier reply classification; unset → rule qty |
| `PORT` | local only | `backend/src/index.js` |

`JWT_SECRET` / `DB_PATH` are legacy (old README-era app, `db.js`) — not read by live code.

## Feature index

- **Entries**: one per user per day (upsert). Test counts (insurance/screening/mixed/partial + "אחר" breakdown), km, office hours, food/parking/toll expenses with receipt photos/PDFs. Counting rules in `lib/payCalc.js`. No pay engine — counts only.
- **Food gate**: tests + cancellations ≥ 4 unlocks daily food expense (server `enforceFoodGate`).
- **Cancellations**: per-reason breakdown, admin-managed reasons, locked "אחר" row requires note. Not tests.
- **אחר test types**: admin-managed `other_test_types` (Medix first); counted, unpaid, per-type Excel column.
- **Toll**: `toll_expense` + receipts, paid like parking; admin warned on missing receipts.
- **Reports**: per-employee Excel (`lib/reportSheet.js`, shared by employee export + admin). Hebrew filename → `encodeURIComponent` in Content-Disposition. Admin approve → email with Excel + 7-day signed receipt links (not attachments), row in `user_monthly_approvals`.
- **Monthly recap (סיכום חודשי)**: admin-only tab, `lib/monthSummary.js`, WhatsApp deep link. Public link/PIN was tried and dropped — keep behind login.
- **Weekly equipment recap**: employees blocked app-wide until they submit this week's device checklist; `lib/equipmentWeek.js` `currentWeek()` is the only week calc. Portal "מכשירים" tab manual update counts as recap and sends "עדכון ציוד ידני" email.
- **Equipment ordering**: employees order from `equipment_catalog`; fulfilling sets `status='completed'` (kept as AI history — don't revert to delete). Admin can lower delivered qty; employee note supported.
- **Supplier reorder agent**: stock ≤ threshold → one draft per supplier, AI suggests box qty (`lib/reorder.js`), admin must click send (email or WhatsApp). Replies matched by `#<order_number>` and classified (`lib/supplierReplies.js`). Received → `increment_catalog_stock`.
- **Notifications**: admin broadcast, scheduled activation, document-approval flow, per-user dismiss, Web Push to all subscriptions (iOS needs Add-to-Home-Screen).
- **Time off / sick days**: `time_off_requests`; note dual FK to `profiles` → embeds must name the FK explicitly.
- **Portal**: Apps (credentials), FAQ, contacts, equipment, tutorial videos, devices.
- **Screening locations**: companies → branches; performed tests and `landing_url` live on the company; Waze link from branch address; vouchers tab only if `requires_vouchers`.

## Testing without a dev DB
- Prefer reading code, `vite build`, `node -c <file>`.
- API test: throwaway script against local backend, `TEST-` accounts, two service-role clients, delete everything in `finally`.
- `e2e-test.mjs` hits prod **and pushes real notifications to all employees** — only with explicit user OK.
