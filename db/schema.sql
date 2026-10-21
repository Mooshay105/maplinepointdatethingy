-- Sets up the database for storing users' events.
-- Run with: turso db shell <database-name> < db/schema.sql
-- Keep in sync with createSchema() in utils/db.ts.

CREATE TABLE IF NOT EXISTS events (
	id INTEGER PRIMARY KEY,           -- generated client-side
	user_id TEXT NOT NULL,            -- Clerk user id
	name TEXT NOT NULL,
	lat REAL NOT NULL,
	lng REAL NOT NULL,
	date INTEGER NOT NULL,            -- epoch milliseconds
	icon TEXT NOT NULL,
	icon_color TEXT NOT NULL,
	visible INTEGER NOT NULL DEFAULT 1, -- 0 or 1
	description TEXT NOT NULL DEFAULT ''
);

-- Upgrades for databases created by older versions (the app also runs these automatically):
-- ALTER TABLE events ADD COLUMN description TEXT NOT NULL DEFAULT '';
-- ALTER TABLE events RENAME COLUMN visable TO visible;

CREATE INDEX IF NOT EXISTS events_user_id ON events (user_id);
