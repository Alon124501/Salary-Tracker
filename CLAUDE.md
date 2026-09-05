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

## Deployment

- **Production is Vercel**, not the `render.yaml` in this repo (that config exists but isn't the live target — don't assume Render env vars apply).
- `api/index.js` is the single serverless function entry point; it just re-exports `backend/src/app.js`. `vercel.json` rewrites all `/api/*` to it (`maxDuration: 300`) and defines two crons (`/api/cron/monthly-receipts`, `/api/cron/process-notifications`) protected by `CRON_SECRET` bearer auth — see `backend/src/routes/cron.js`.
- `backend/src/index.js` is only used for local/self-hosted running: it also serves `frontend/dist` as static files and does the SPA catch-all. Vercel doesn't use this file.
- A commit to `master` must be **pushed** to trigger a Vercel build — a local commit alone does not deploy.

## Architecture

**Backend (`backend/src/`)**: Express app in `app.js` (helmet, CORS restricted to `FRONTEND_URL`, JSON body parsing, per-route rate limits on auth endpoints, global error handler at the bottom that catches anything forwarded via `asyncHandler`). Routes live in `routes/`, one file per resource (`auth`, `entries`, `report`, `screening`, `admin`, `faq`, `portal`, `notifications`, `contacts`, `equipment`, `devices`, `tutorials`, `cron`) — each file mixes public/employee/admin endpoints, gating individually with `auth` / `adminAuth` middleware rather than grouping into separate routers.

- `middleware/auth.js` verifies the Supabase JWT (`supabase.auth.getUser(token)`) and sets `req.userId`. `middleware/adminAuth.js` must run *after* `auth` — it looks up `profiles.is_admin` and 403s if false. `middleware/asyncHandler.js` wraps async handlers so rejections reach the global error handler instead of hanging.
- `supabase.js` creates the Supabase client with the **service-role key**, so all backend queries bypass RLS — access control is enforced entirely in Express middleware, not in Postgres policies (RLS is enabled on tables mostly to block direct anon access, not to gate the backend).
- `lib/payCalc.js` is the single source of truth for salary math (`calcDaily`, `foodAudit`) — both the report generator and admin summaries import from here rather than recomputing rates. Pay is computed per employee based on their assigned `payment_type` (`per_test` default / `per_hour` / `global`, admin-controlled from the Compensation tab); `global` employees' flat salary is added once at the monthly-summary layer, not per daily entry.

**Database**: Supabase Postgres. **`supabase/schema.sql` is stale** — the real schema lives in `supabase/migrations/*.sql`, applied chronologically (`YYYYMMDD_description.sql`). When adding tables, follow the existing pattern: create table → `ENABLE ROW LEVEL SECURITY` → an `authenticated`-read policy → a `service_role`-all policy (see `20260703_device_recap.sql` or `20260810_tutorial_videos.sql` for the template). Apply new migrations with the Supabase MCP tools (`apply_migration`) rather than hand-editing prod through the dashboard when possible.

**Storage**: Several Supabase Storage buckets, each single-purpose (`receipts`, `app-images`, `profession-documents`, `notification-documents`, `screening-logos`, `branch-brochures`, `screening-vouchers`, `tutorial-videos`, `degree-documents`, `reports`) — most are private with signed URLs generated server-side; a few (`app-images`, `screening-logos`, `branch-brochures`) are public. Two upload patterns exist:
1. **Proxy through Express**: `multer({ storage: memoryStorage() })` → `supabase.storage.from(bucket).upload(...)`. Fine for small files (images).
2. **Direct-to-storage**: backend issues a `createSignedUploadUrl`, the browser PUTs the file straight to Supabase, bypassing Express/Vercel body-size and duration limits entirely. Used for large files (e.g. tutorial video uploads in `routes/tutorials.js`) — prefer this pattern for anything that could exceed a few MB.

**Frontend (`frontend/src/`)**: Vite + React 18 + React Router, no state-management library. `pages/` are route-level components; `App.jsx` wires routes with `PrivateRoute` (token-presence check only) and `AdminRoute` (same — real admin authorization is server-side, so admin pages 403 on data fetch rather than blocking navigation). `AdminDashboard.jsx` and `PortalPage.jsx` are large single-file components that hold *all* their tabs/sub-tabs as local `useState` + a hardcoded tab-definition array + conditional render blocks (not separate routes or a registry) — follow this exact copy-paste pattern when adding a new tab rather than introducing routing/registry abstractions.

- `api.js`: shared axios instance, `baseURL: '/api'`, injects `Authorization: Bearer <token>` from `localStorage`, and on a 401 clears the fetch cache + token + redirects to `/login`.
- `hooks/useFetch.js`: shared GET-with-cache hook (30s TTL, serves stale-then-revalidates in the background). Call the exported `clearCache()` on logout to avoid leaking one user's cached data into the next session.
- Styling is Tailwind with brand tokens in `tailwind.config.js` (`brand-purple` #8B35D9 gradient is the primary accent) and Material Symbols Outlined icons — `DESIGN.md` at the repo root describes a different, unused design language ("Action Blue" #0066CC, Manrope/Inter); it does not reflect the actual implementation, don't follow it.
- **The entire UI is Hebrew and RTL** — `index.html` sets `lang="he" dir="rtl"`, the font is Heebo (Manrope/Inter have no Hebrew glyphs), and all UI copy (frontend strings, API error messages, emails, Excel report headers) is Hebrew. Brand name "Medical Pay" stays in Latin by design. When adding new UI text or backend-facing messages, write Hebrew directly — don't reintroduce English strings. Directional icons (back/forward chevrons, arrows) are picked per RTL semantics (e.g. "back" points right, following `ScreeningLocationsPage.jsx`'s original RTL pattern), and edge-anchored spacing/position classes use the RTL-correct side (e.g. `me-auto`, `left-*` for a dropdown-arrow decoration on right-aligned text) rather than assuming LTR. Locale-dependent date formatting uses `'he-IL'`, not `'en-US'`.

## Salary calculation reference

Rates are admin-configurable per employee (not hardcoded constants) — see `lib/payCalc.js` for the authoritative logic: per-test rates (insurance/screening/mixed/partial), a 240₪ minimum-tests-pay floor, km at a configurable rate/km + 100₪ bonus at ≥100km/day, office hours at an hourly rate, and food/parking expenses reimbursed at actual cost. Do not reuse the rate table in `README.md` — it's outdated.
