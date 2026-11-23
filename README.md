# Map Line Point Date Thingy

## Setup

Put these in `.env.local`:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`: Clerk auth
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`: the events database (see "Database")
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: Google Maps JavaScript API (public; restrict it by HTTP referrer)
- `NOMINATIM_USER_AGENT` (optional): contact info for OpenStreetMap geocoding

## Database

The app talks to Turso through Drizzle. The tables are defined in `db/schema.ts`, and `db/migrations/` holds the SQL that builds them.

- `bun run db:migrate`: applies any new migrations to the database in `TURSO_DATABASE_URL`. Run it once before starting the app against a new database.
- `bun run db:generate`: after changing `db/schema.ts`, writes the migration for it. Commit the new files in `db/migrations/`.

Every push to `main` runs the migrations against production (`.github/workflows/migrate.yml`). It needs the `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` repository secrets.

## Icons

UI icons live in `components/Icons.tsx`; map markers are `public/icons/<icon>.svg`. Both use the same line style, see the comments in those files.

## Checks

- `bun run lint`
- `bun run typecheck`: generates Next.js route types, then runs `tsc`
- `bun run test`: the tests in `tests/`, run with Bun's built-in test runner. They use a throwaway SQLite file instead of Turso and a fake Clerk sign-in, so they need no `.env.local`.
- `bun run build`

GitHub Actions runs all four on every pull request and push to `main` (`.github/workflows/ci.yml`).

# Todo:

Hook up colors to the map
