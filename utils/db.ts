import { createClient, Row } from "@libsql/client";
import z from "zod";
import { Point } from "./types";

export const db = createClient({
	url: process.env.TURSO_DATABASE_URL!,
	authToken: process.env.TURSO_AUTH_TOKEN,
});

let schemaReady: Promise<unknown> | null = null;

/** Creates the events table on first use. */
export function ensureSchema() {
	schemaReady ??= db
		.execute(
			`CREATE TABLE IF NOT EXISTS events (
				id INTEGER PRIMARY KEY,
				user_id TEXT NOT NULL,
				name TEXT NOT NULL,
				lat REAL NOT NULL,
				lng REAL NOT NULL,
				date INTEGER NOT NULL,
				icon TEXT NOT NULL,
				icon_color TEXT NOT NULL,
				visable INTEGER NOT NULL DEFAULT 1,
				description TEXT NOT NULL DEFAULT ''
			)`,
		)
		.then(() => db.execute("CREATE INDEX IF NOT EXISTS events_user_id ON events (user_id)"))
		// Tables created before descriptions existed are missing the column
		.then(() => db.execute("PRAGMA table_info(events)"))
		.then((rs) => {
			if (!rs.rows.some((r) => r.name === "description")) {
				return db.execute("ALTER TABLE events ADD COLUMN description TEXT NOT NULL DEFAULT ''");
			}
		})
		.catch((err) => {
			schemaReady = null;
			throw err;
		});
	return schemaReady;
}

const icons = [
	"indoor-athletics",
	"outdoor-athletics",
	"road-running",
	"cross-country",
	"trail-running",
	"combined-events",
	"race-walking",
	"diamond-league",
] as const satisfies readonly Point["icon"][];

const iconColors = [
	"red",
	"yellow",
	"orange",
	"green",
	"blue",
	"purple",
	"black",
	"grey",
	"white",
] as const satisfies readonly Point["iconColor"][];

/** Event as sent over the wire: same as Point, but the date is epoch milliseconds. */
export const eventSchema = z.object({
	id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	name: z.string(),
	description: z.string(),
	lat: z.number(),
	lng: z.number(),
	date: z.number(),
	icon: z.enum(icons),
	iconColor: z.enum(iconColors),
	visable: z.boolean(),
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
		icon: row.icon as Point["icon"],
		iconColor: row.icon_color as Point["iconColor"],
		visable: Boolean(row.visable),
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
	visable: "visable",
};
