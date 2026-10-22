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
	description TEXT NOT NULL DEFAULT '',
	address TEXT NOT NULL DEFAULT '',  -- raw address as the user typed it
	group_id INTEGER,                 -- map_groups.id, or NULL when ungrouped (also set for events in a layer)
	layer_id INTEGER                  -- layers.id, or NULL when not in a layer
);

-- Upgrades for databases created by older versions (the app also runs these automatically):
-- ALTER TABLE events ADD COLUMN description TEXT NOT NULL DEFAULT '';
-- ALTER TABLE events RENAME COLUMN visable TO visible;
-- ALTER TABLE events ADD COLUMN address TEXT NOT NULL DEFAULT '';
-- ALTER TABLE events ADD COLUMN group_id INTEGER;
-- ALTER TABLE events ADD COLUMN layer_id INTEGER;

CREATE INDEX IF NOT EXISTS events_user_id ON events (user_id);

CREATE TABLE IF NOT EXISTS map_groups (
	id INTEGER PRIMARY KEY,           -- generated client-side
	user_id TEXT NOT NULL,
	name TEXT NOT NULL,
	visible INTEGER NOT NULL DEFAULT 1, -- 0 or 1
	created INTEGER NOT NULL          -- epoch milliseconds, for keeping the groups in order
);

CREATE INDEX IF NOT EXISTS map_groups_user_id ON map_groups (user_id);

-- Layers sit inside a group and hold events, but not other layers
CREATE TABLE IF NOT EXISTS layers (
	id INTEGER PRIMARY KEY,           -- generated client-side
	user_id TEXT NOT NULL,
	group_id INTEGER NOT NULL,        -- map_groups.id
	name TEXT NOT NULL,
	visible INTEGER NOT NULL DEFAULT 1, -- 0 or 1
	created INTEGER NOT NULL          -- epoch milliseconds
);

CREATE INDEX IF NOT EXISTS layers_user_id ON layers (user_id);
