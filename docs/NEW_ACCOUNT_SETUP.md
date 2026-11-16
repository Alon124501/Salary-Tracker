# New Claude account setup

Checklist for a new Claude Code account working on this repo (same PC, same folder). Project facts are in `CLAUDE.md` and `docs/PROJECT_GUIDE.md`, so nothing else needs to be copied over.

1. **Log in**: in this folder run `claude`, then `/login` with the new account.
2. **Supabase MCP**: run `/mcp`, pick the `supabase` server, and authenticate. Confirm it can see the project whose ref is the subdomain of `SUPABASE_URL` in `backend/.env` (e.g. list tables). If the account you log in with isn't a member of the Supabase org, invite it from the dashboard (Organization → Team). If OAuth fails ("No OAuth flow is in progress"), the fallback is the dashboard SQL editor for migrations, plus read-only node scripts that use `backend/.env`.
3. **Vercel**: authenticate the Vercel plugin MCP via `/mcp`, and optionally run `npm i -g vercel` then `vercel login`. Confirm you can see project `salary-tracker` (team id in `.vercel/project.json`). If the work email isn't on that team, invite it (Team → Members). `.vercel/project.json` already links the folder.
4. **GitHub**: run `gh auth status` and confirm you have push access to `Alon124501/Salary-Tracker`. Pushing to `master` deploys to production.
5. **Env**: `backend/.env` already exists locally (it's gitignored), so there's nothing to do on the same PC. On a new machine, rebuild it from the Vercel production env vars (names are listed in `PROJECT_GUIDE.md`).
6. **Smoke test**: first check that ports 3001 and 5173 are free. Then run `npm run dev`, open http://localhost:5173, and log in. Run `npm run build --prefix frontend` to confirm the build passes. Never run `e2e-test.mjs` without the owner's OK, because it sends real push notifications to all employees.
7. **Old memory**: the previous account's auto-memory in `~/.claude/projects/.../memory/` stays on disk. Its lasting lessons are now in `CLAUDE.md` ("Gotchas") and `PROJECT_GUIDE.md`.
