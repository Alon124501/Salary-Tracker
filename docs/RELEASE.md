# Release & rollback process

This app deploys to Vercel automatically on every push to `master` (see `CLAUDE.md` → Deployment). There's no staging environment and no separate dev database, so this process exists to make sure there's always a known-good point to snap back to — for code and for the database — before something risky goes live.

A **release** here means: the point right before you push a finished batch of work (usually one or a few feature commits) to `master`. Not every commit needs this — just the point you're about to trust in production.

## Before pushing a release

1. Build check: `vite build --prefix frontend` (catches JSX/syntax errors). For changed backend route files: `node -c backend/src/routes/<file>.js`.
2. If the release includes a Supabase migration, back it up first — see [DB backups](#db-backups-before-a-risky-migration) below.
3. Tag the current commit:
   ```
   git tag -a vX.Y.Z -m "<short description of what's shipping>"
   git push origin vX.Y.Z
   ```
   Bump MINOR for a feature release, PATCH for a fix. Doesn't need to be strict semver — just increasing, and one tag per thing you actually pushed live.
4. Push to `master`: `git push origin master` — this triggers the Vercel build/deploy.
5. Watch the deployment finish in the Vercel dashboard, then smoke-test the live site (log in, hit the changed feature).

## If a code release breaks something

**Fastest — Vercel dashboard rollback (no git needed):**
Vercel Project → Deployments → find the last good deployment (matches the previous tag) → **Promote to Production**. Takes effect immediately, doesn't touch git history.

**Git-level revert** (if you also want `master`'s history to reflect the fix):
```
git revert <bad-commit>
git push origin master
```
This creates a new commit undoing the bad one and triggers a fresh deploy. Prefer this over `git reset --hard` + force-push, which rewrites shared history — only do that if you've explicitly decided to and understand the impact on anyone else with the repo cloned.

**Optional — Vercel CLI**: `npm i -g vercel`, then `vercel rollback` gives the same effect as the dashboard promote, from the terminal.

## DB backups before a risky migration

No down-migrations exist for this project (`supabase/migrations/*.sql` is forward-only), and there's no separate dev database — so back up before applying anything that could go wrong:

- **Whole-DB backup**: Supabase Dashboard → Database → Backups → on-demand backup, before applying the migration. Availability of on-demand (vs. daily-only) backups depends on the project's Supabase plan — check there.
- **Scoped table snapshot** (cheaper, good for a targeted migration): before applying, run
  ```sql
  CREATE TABLE <table>_backup_YYYYMMDD AS SELECT * FROM <table>;
  ```
  If the migration breaks something, restore affected rows with `INSERT INTO <table> SELECT * FROM <table>_backup_YYYYMMDD ...`. Drop the backup table once the release is confirmed stable.
- **For migrations touching a lot of rows or dropping/renaming columns**: test on a Supabase branch first (`create_branch` via the Supabase MCP tools) rather than applying directly to prod, since there's no dev DB to catch mistakes.

## Baseline

`v1.0.0` marks the commit right before this process was introduced (2026-08-29). Use `git tag --list` to see all release points, `git log <tag>..master` to see everything shipped since a given release.
