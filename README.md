# Map Line Point Date Thingy

## Setup

Put these in `.env.local`:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`: Clerk auth
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`: the events database (see `db/schema.sql`)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: Google Maps JavaScript API (public; restrict it by HTTP referrer)
- `NOMINATIM_USER_AGENT` (optional): contact info for OpenStreetMap geocoding

## Icons

UI icons live in `components/Icons.tsx`; map markers are `public/icons/<icon>.svg`. Both use the same line style, see the comments in those files.

## Checks

- `bun run lint`
- `bun run test`: the tests in `tests/`, run with Bun's built-in test runner. They use a throwaway SQLite file instead of Turso and a fake Clerk sign-in, so they need no `.env.local`.
- `bun run build`

GitHub Actions runs all three on every push and pull request (`.github/workflows/ci.yml`).

# Todo:

Hook up colors to the map
