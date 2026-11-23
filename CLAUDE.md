@AGENTS.md

## Full send

Rules for agents that prove, file, babysit and merge their own PRs in this repo.

### Commands

Use bun, never npm.

- Install: `bun install --frozen-lockfile`
- Typecheck: `bun run typecheck`
- Lint: `bun run lint`
- Test: `bun run test` (Bun's test runner over `tests/`; uses a throwaway SQLite file and a mocked Clerk sign-in, so it needs no `.env.local`)
- Build: `bun run build` (needs `TURSO_DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` set; CI uses the placeholders in `.github/workflows/ci.yml`)
- Dev server: `bun run dev`

CI (`.github/workflows/ci.yml`) runs install, lint, typecheck, test and build as one job named `ci` on every pull request and on pushes to `main`. A ruleset on `main` requires `ci` to pass on an up-to-date branch, and a pull request, before merging.

### Viewing the app

`bun run dev` serves the app at http://localhost:3000. It reads `.env.local` (Clerk, Turso and Google Maps keys, see README.md). Every page is behind Clerk sign-in, and there is no seed data or test account: sign in with a real Clerk account, or ask the user.

The `TURSO_DATABASE_URL` in `.env.local` points at the production database. A local dev server therefore reads and writes production events. Do not create, edit or delete events through the running app unless the user asks; prefer the test suite for proving behavior, and look at the UI without changing data.

### What merging to main triggers

- A Vercel production deploy, through the Vercel Git integration.
- `.github/workflows/migrate.yml`, which runs `drizzle-kit migrate` against the production Turso database.

Merging a PR that auto-deploys to production is acceptable for full send, including PRs that add migrations (the user's answer on 2026-11-23: "Yes, always"). The merge gate still applies: proof for every change, `ci` green, review findings handled, branch up to date.

### Never touch

- `.env.local` or any other `.env*` file: never read values out of it into chat, commits, PRs or logs, and never commit it.
- Repository secrets (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`) and the Vercel project settings.
- Production data: do not run `bun run db:migrate`, `drizzle-kit push` or any SQL against the database in `.env.local`. Migrations reach production only by merging to `main`.
- Existing files in `db/migrations/`, including `meta/`: never edit or delete them. Change `db/schema.ts` and run `bun run db:generate` to add a new migration instead.
- `.github/workflows/migrate.yml`, and the `main` ruleset or other repository settings.
