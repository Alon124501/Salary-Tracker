# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A salary-tracking web app for a company's employees: daily work entries (tests, km, hours, expenses) → monthly pay calculation, an admin dashboard, and an employee "Portal" (apps/FAQ/contacts/equipment/tutorial videos). Despite the name, this is **not** the generic SQLite/JWT app described in `README.md` — that file is stale. The real stack is React + Express + Supabase (Postgres, Auth, Storage), deployed to Vercel.

## Commands

```bash
npm run dev --prefix backend    # backend only, nodemon, http://localhost:3001
npm run dev --prefix frontend   # frontend only, vite --host, http://localhost:5173
npm run dev                     # both concurrently (root package.json)

npm run build --prefix frontend # production build (vite build) — also just `vite build` in frontend/
```

There is no test suite or ESLint config in this repo. The closest thing to an automated test is `node e2e-test.mjs` (root) — it runs **against production** (`https://salary-tracker-ruddy.vercel.app/api`), creates temporary admin/employee accounts via the Supabase service-role key, exercises the notification/document-approval flow end-to-end, then deletes what it created. Requires `backend/.env` with `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. There is no separate dev database — verify logic by reading code / running scoped queries rather than writing throwaway data into prod.

Verify changes by building the frontend (`vite build` catches JSX/syntax errors) and, for backend route files, `node -c <file>` for a quick syntax check.

A local backend (`npm run dev`) talks to the **production** Supabase project too. For an API-level test of a new feature, the pattern is a throwaway Node script against `http://localhost:3001/api` that creates `TEST-`-named accounts via `supabase.auth.admin.createUser` + a `profiles` insert, exercises the endpoints, and deletes everything (entries, profiles, auth users) in a `finally`. Use **two** service-role clients — one only for `signInWithPassword`, one for all reads/writes — because signing in mutates a client's auth state and later queries on it stop bypassing RLS (that bug is why `backend/src/supabaseAuth.js` exists). Before starting a dev server, check ports 3001/5173 aren't already taken by one the user is running.

## Deployment

- **Production is Vercel**, not the `render.yaml` in this repo (that config exists but isn't the live target — don't assume Render env vars apply).
- `api/index.js` is the single serverless function entry point; it just re-exports `backend/src/app.js`. `vercel.json` rewrites all `/api/*` to it (`maxDuration: 300`) and defines three crons (`/api/cron/monthly-receipts`, `/api/cron/process-notifications`, `/api/cron/equipment-agent` — low-stock check + supplier reorder drafts with an Anthropic-suggested quantity, see `lib/reorder.js`) protected by `CRON_SECRET` bearer auth — see `backend/src/routes/cron.js`.
- `backend/src/index.js` is only used for local/self-hosted running: it also serves `frontend/dist` as static files and does the SPA catch-all. Vercel doesn't use this file.
- A commit to `master` must be **pushed** to trigger a Vercel build — a local commit alone does not deploy.
- Release process is in `docs/RELEASE.md`: tag (`vX.Y.Z`) right before pushing a batch to `master`, take a backup before applying a risky migration (whole-DB, or a `CREATE TABLE <t>_backup_YYYYMMDD AS SELECT …` snapshot), roll back code via Vercel "promote" of an earlier deployment. Migrations are forward-only, so apply the migration **before** pushing code that reads new columns.

## Architecture

**Backend (`backend/src/`)**: Express app in `app.js` (helmet, CORS restricted to `FRONTEND_URL`, JSON body parsing, per-route rate limits on auth endpoints, global error handler at the bottom that catches anything forwarded via `asyncHandler`). Routes live in `routes/`, one file per resource, each mounted in `app.js` (`auth`, `entries`, `report`, `screening`, `admin`, `faq`, `portal`, `notifications`, `contacts`, `equipment`, `devices`, `tutorials`, `timeoff`, `push`, `recap`, `cancellation-reasons`, `cron`) — each file mixes public/employee/admin endpoints, gating individually with `auth` / `adminAuth` middleware rather than grouping into separate routers.

- `middleware/auth.js` verifies the Supabase JWT (`supabaseAuth.auth.getUser(token)`) and sets `req.userId`. `middleware/adminAuth.js` must run *after* `auth` — it looks up `profiles.is_admin` and 403s if false. `middleware/asyncHandler.js` wraps async handlers so rejections reach the global error handler instead of hanging.
- `supabase.js` creates the Supabase client with the **service-role key**, so all backend queries bypass RLS — access control is enforced entirely in Express middleware, not in Postgres policies (RLS is enabled on tables mostly to block direct anon access, not to gate the backend).
- `supabaseAuth.js` is a **separate** client used only for auth calls (`signInWithPassword`, `getUser`). Never call auth methods on the shared `supabase.js` client: a sign-in stores a user session on it and later data queries silently run as that user (intermittent RLS/permission errors).
- `db.js` (node:sqlite) is dead legacy from the README-era app — nothing requires it.
- `lib/monthSummary.js` builds the admin "סיכום חודשי" recap (company totals, awards, attention lists, per-employee drill-down); `lib/reportSheet.js` builds the per-employee Excel sheet used by both the employee export (`routes/report.js`) and the admin report/approval routes (`routes/admin.js`).
- `lib/payCalc.js` is the single source of truth for per-entry counts and the food rule (`totalTestsFor`, `foodQualifyingCountFor`, `foodAudit`, `dailyExpenses`) — the report generator, admin summaries and entry routes import from here rather than re-summing columns. It does **not** compute pay: see "Salary calculation reference" below.

**Database**: Supabase Postgres. **`supabase/schema.sql` is stale** — the real schema lives in `supabase/migrations/*.sql`, applied chronologically (`YYYYMMDD_description.sql`). When adding tables, follow the existing pattern: create table → `ENABLE ROW LEVEL SECURITY` → an `authenticated`-read policy → a `service_role`-all policy (see `20260703_device_recap.sql` or `20260810_tutorial_videos.sql` for the template). Apply new migrations with the Supabase MCP tools (`apply_migration`) rather than hand-editing prod through the dashboard when possible.

Screening locations: "בדיקות שמבצעים בסניף" lives on the **company** (`screening_companies.performed_test_ids`, ids from `screening_test_catalog`) and applies to every branch of that company — edited in the company form, no per-branch overrides. `screening_branches.performed_test_ids` is deprecated (unread/unwritten since 20261110) and pending a drop migration. Same for the company landing-page link: `screening_companies.landing_url` (optional, `isSafeUrl`), shown on every branch as "דף נחיתה" + copy; the per-branch `screening_branches.registration_url` and its SMS-send widget were removed (column deprecated since 20261110b, pending the same drop). Company brochures (חוברות) were removed entirely in 20261110c: `screening_companies.brochure_url` is nulled and deprecated (pending the same drop), and the `branch-brochures` bucket was deleted (local file backup kept).

**Storage**: Several Supabase Storage buckets, each single-purpose (`receipts`, `app-images`, `profession-documents`, `notification-documents`, `screening-logos`, `screening-vouchers`, `tutorial-videos`, `degree-documents`, `reports`) — most are private with signed URLs generated server-side; a few (`app-images`, `screening-logos`) are public. Two upload patterns exist:
1. **Proxy through Express**: `multer({ storage: memoryStorage() })` → `supabase.storage.from(bucket).upload(...)`. Fine for small files (images).
2. **Direct-to-storage**: backend issues a `createSignedUploadUrl`, the browser PUTs the file straight to Supabase, bypassing Express/Vercel body-size and duration limits entirely. Used for large files (e.g. tutorial video uploads in `routes/tutorials.js`) — prefer this pattern for anything that could exceed a few MB.

**Frontend (`frontend/src/`)**: Vite + React 18 + React Router, no state-management library. `pages/` are route-level components; `App.jsx` wires routes with `PrivateRoute` (token-presence check only) and `AdminRoute` (same — real admin authorization is server-side, so admin pages 403 on data fetch rather than blocking navigation). `AdminDashboard.jsx` and `PortalPage.jsx` are large single-file components that hold *all* their tabs/sub-tabs as local `useState` + a hardcoded tab-definition array + conditional render blocks (not separate routes or a registry) — follow this exact copy-paste pattern when adding a new tab rather than introducing routing/registry abstractions.

- `api.js`: shared axios instance, `baseURL: '/api'`, injects `Authorization: Bearer <token>` from `localStorage`, and on a 401 clears the fetch cache + token + redirects to `/login`.
- `hooks/useFetch.js`: shared GET-with-cache hook (30s TTL, serves stale-then-revalidates in the background). Call the exported `clearCache()` on logout to avoid leaking one user's cached data into the next session.
- Styling is Tailwind with brand tokens in `tailwind.config.js` (`brand-purple` #8B35D9 gradient is the primary accent) and Material Symbols Outlined icons — `DESIGN.md` at the repo root describes a different, unused design language ("Action Blue" #0066CC, Manrope/Inter); it does not reflect the actual implementation, don't follow it.
- **The entire UI is Hebrew and RTL** — `index.html` sets `lang="he" dir="rtl"`, the font is Heebo (Manrope/Inter have no Hebrew glyphs), and all UI copy (frontend strings, API error messages, emails, Excel report headers) is Hebrew. Brand name "Medical Pay" stays in Latin by design. When adding new UI text or backend-facing messages, write Hebrew directly — don't reintroduce English strings. Directional icons (back/forward chevrons, arrows) are picked per RTL semantics (e.g. "back" points right, following `ScreeningLocationsPage.jsx`'s original RTL pattern), and edge-anchored spacing/position classes use the RTL-correct side (e.g. `me-auto`, `left-*` for a dropdown-arrow decoration on right-aligned text) rather than assuming LTR. Locale-dependent date formatting uses `'he-IL'`, not `'en-US'`.

## Salary calculation reference

The app records and counts work; it does **not** calculate salary amounts. Per-employee compensation settings exist on `profiles` (`payment_type` `per_test`/`per_hour`/`global`, `global_salary`, `insurance_rate`/`screening_rate`/`mixed_screening_rate`/`partial_rate`, `mileage_rate`, `hourly_rate`, `km_bonus_*`) and are returned by `GET /api/auth/me`, but no backend or frontend code turns them into pay — reports and the monthly recap show counts (tests, cancellations, km, office hours) and expenses (food/parking/toll at actual cost) only. Don't assume a pay engine exists; if one is needed, it's new work. Do not reuse the rate table in `README.md` — it's outdated.

"אחר" tests: extra test types beyond the fixed four live in the admin-managed `other_test_types` table (first: Medix). Each entry stores `entries.other_test_breakdown` (`[{type_id, count}]`) with `entries.other_tests` as the synced total — always write through `applyOtherTestBreakdown` in `lib/otherTests.js`. They count as tests everywhere (`totalTestsFor`, food unlock, dashboard, recap) and the Excel sheet gets one column per active-or-used type; they carry no rate.

Cancellations (ביטולים) are not tests: excluded from test totals and pay, but tests + cancellations ≥ 4 unlocks the daily food expense (`foodQualifyingCountFor`, enforced server-side in `routes/entries.js` `enforceFoodGate`). Each day stores a per-reason breakdown in `entries.cancellation_reasons` (`[{reason_id, count}]`, reasons in the admin-managed `cancellation_reasons` table; the built-in `is_other` "אחר" row is locked and requires `cancellation_other_note`). `entries.cancellations` is kept as the synced total so every older reader keeps working — always go through `applyCancellationBreakdown` in `lib/cancelReasons.js` when writing entries; legacy rows with a bare count and no breakdown show as "לא צוין" in reports.
