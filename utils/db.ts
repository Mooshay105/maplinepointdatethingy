import { createClient, Row } from "@libsql/client";
import z from "zod";
import { EVENT_COLORS, EVENT_ICONS, EventColor, EventIcon } from "./types";

export const db = createClient({
	url: process.env.TURSO_DATABASE_URL!,
	authToken: process.env.TURSO_AUTH_TOKEN,
});

let schemaReady: Promise<void> | null = null;

/** Creates (or upgrades) the events table on first use. Later calls reuse the same promise. */
export function ensureSchema() {
	schemaReady ??= createSchema().catch((err) => {
		schemaReady = null; // Let the next request try again
		throw err;
	});
	return schemaReady;
}

async function createSchema() {
	await db.execute(
		`CREATE TABLE IF NOT EXISTS events (
			id INTEGER PRIMARY KEY,
			user_id TEXT NOT NULL,
			name TEXT NOT NULL,
			lat REAL NOT NULL,
			lng REAL NOT NULL,
			date INTEGER NOT NULL,
			icon TEXT NOT NULL,
			icon_color TEXT NOT NULL,
			visible INTEGER NOT NULL DEFAULT 1,
			description TEXT NOT NULL DEFAULT ''
		)`,
	);
	await db.execute("CREATE INDEX IF NOT EXISTS events_user_id ON events (user_id)");

	// Upgrade tables created by older versions of the app
	const tableInfo = await db.execute("PRAGMA table_info(events)");
	const existingColumns = tableInfo.rows.map((r) => String(r.name));
	if (!existingColumns.includes("description")) {
		await db.execute("ALTER TABLE events ADD COLUMN description TEXT NOT NULL DEFAULT ''");
	}
	if (existingColumns.includes("visable")) {
		await db.execute("ALTER TABLE events RENAME COLUMN visable TO visible");
	}
}

/** Event as sent over the wire: same as MapEvent, but the date is epoch milliseconds. */
export const eventSchema = z.object({
	id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	name: z.string(),
	description: z.string(),
	lat: z.number(),
	lng: z.number(),
	date: z.number(),
	icon: z.enum(EVENT_ICONS),
	iconColor: z.enum(EVENT_COLORS),
	visible: z.boolean(),
});

export const eventChangesSchema = eventSchema.omit({ id: true }).partial();

export type EventChanges = z.infer<typeof eventChangesSchema>;

export function rowToEvent(row: Row): z.infer<typeof eventSchema> {
	return {
		id: Number(row.id),
		name: String(row.name),
		description: String(row.description ?? ""),
		lat: Number(row.lat),
		lng: Number(row.lng),
		date: Number(row.date),
		icon: row.icon as EventIcon,
		iconColor: row.icon_color as EventColor,
		visible: Boolean(row.visible),
	};
}

/** Maps EventChanges keys to their column names. */
export const columns: Record<keyof EventChanges, string> = {
	name: "name",
	description: "description",
	lat: "lat",
	lng: "lng",
	date: "date",
	icon: "icon",
	iconColor: "icon_color",
	visible: "visible",
};
