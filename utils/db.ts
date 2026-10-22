import { createClient, Row } from "@libsql/client";
import z from "zod";
import { EVENT_COLORS, EVENT_ICONS, EventColor, EventIcon } from "./types";

export const db = createClient({
	url: process.env.TURSO_DATABASE_URL!,
	authToken: process.env.TURSO_AUTH_TOKEN,
});

let schemaReady: Promise<void> | null = null;

/** Creates (or upgrades) the tables on first use. Later calls reuse the same promise. */
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
			description TEXT NOT NULL DEFAULT '',
			address TEXT NOT NULL DEFAULT '',
			group_id INTEGER,
			layer_id INTEGER
		)`,
	);
	await db.execute("CREATE INDEX IF NOT EXISTS events_user_id ON events (user_id)");
	await db.execute(
		`CREATE TABLE IF NOT EXISTS map_groups (
			id INTEGER PRIMARY KEY,
			user_id TEXT NOT NULL,
			name TEXT NOT NULL,
			visible INTEGER NOT NULL DEFAULT 1,
			created INTEGER NOT NULL
		)`,
	);
	await db.execute("CREATE INDEX IF NOT EXISTS map_groups_user_id ON map_groups (user_id)");
	await db.execute(
		`CREATE TABLE IF NOT EXISTS layers (
			id INTEGER PRIMARY KEY,
			user_id TEXT NOT NULL,
			group_id INTEGER NOT NULL,
			name TEXT NOT NULL,
			visible INTEGER NOT NULL DEFAULT 1,
			created INTEGER NOT NULL
		)`,
	);
	await db.execute("CREATE INDEX IF NOT EXISTS layers_user_id ON layers (user_id)");

	// Upgrade tables created by older versions of the app
	const tableInfo = await db.execute("PRAGMA table_info(events)");
	const existingColumns = tableInfo.rows.map((r) => String(r.name));
	if (!existingColumns.includes("description")) {
		await db.execute("ALTER TABLE events ADD COLUMN description TEXT NOT NULL DEFAULT ''");
	}
	if (!existingColumns.includes("address")) {
		await db.execute("ALTER TABLE events ADD COLUMN address TEXT NOT NULL DEFAULT ''");
	}
	if (!existingColumns.includes("group_id")) {
		await db.execute("ALTER TABLE events ADD COLUMN group_id INTEGER");
	}
	if (!existingColumns.includes("layer_id")) {
		await db.execute("ALTER TABLE events ADD COLUMN layer_id INTEGER");
	}
	if (existingColumns.includes("visable")) {
		await db.execute("ALTER TABLE events RENAME COLUMN visable TO visible");
	}
}

const idSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

/** Reads a route's [id] param, or null if it isn't a valid id. */
export function parseId(raw: string) {
	const id = Number(raw);
	return Number.isSafeInteger(id) ? id : null;
}

/** Event as sent over the wire: same as MapEvent, but the date is epoch milliseconds. */
export const eventSchema = z.object({
	id: idSchema,
	name: z.string(),
	description: z.string(),
	address: z.string(),
	lat: z.number(),
	lng: z.number(),
	date: z.number(),
	icon: z.enum(EVENT_ICONS),
	iconColor: z.enum(EVENT_COLORS),
	visible: z.boolean(),
	groupId: idSchema.nullable(),
	layerId: idSchema.nullable(),
});

export const eventChangesSchema = eventSchema.omit({ id: true }).partial();

export type EventChanges = z.infer<typeof eventChangesSchema>;

export function rowToEvent(row: Row): z.infer<typeof eventSchema> {
	return {
		id: Number(row.id),
		name: String(row.name),
		description: String(row.description ?? ""),
		address: String(row.address ?? ""),
		lat: Number(row.lat),
		lng: Number(row.lng),
		date: Number(row.date),
		icon: row.icon as EventIcon,
		iconColor: row.icon_color as EventColor,
		visible: Boolean(row.visible),
		groupId: nullableId(row.group_id),
		layerId: nullableId(row.layer_id),
	};
}

function nullableId(value: unknown) {
	return value == null ? null : Number(value);
}

/** Maps EventChanges keys to their column names. */
export const columns: Record<keyof EventChanges, string> = {
	name: "name",
	description: "description",
	address: "address",
	lat: "lat",
	lng: "lng",
	date: "date",
	icon: "icon",
	iconColor: "icon_color",
	visible: "visible",
	groupId: "group_id",
	layerId: "layer_id",
};

export const groupSchema = z.object({
	id: idSchema,
	name: z.string(),
	visible: z.boolean(),
});

export const groupChangesSchema = groupSchema.omit({ id: true }).partial();

export const groupColumns: Record<keyof z.infer<typeof groupChangesSchema>, string> = {
	name: "name",
	visible: "visible",
};

export const layerSchema = groupSchema.extend({ groupId: idSchema });

/** Same as a group's: layers can't be moved to another group. */
export const layerChangesSchema = groupChangesSchema;

export const layerColumns = groupColumns;

export function rowToGroup(row: Row): z.infer<typeof groupSchema> {
	return { id: Number(row.id), name: String(row.name), visible: Boolean(row.visible) };
}

export function rowToLayer(row: Row): z.infer<typeof layerSchema> {
	return { ...rowToGroup(row), groupId: Number(row.group_id) };
}

/**
 * Sets the given fields on one of the user's rows.
 * @param columnNames Maps each field to its column, which also keeps unknown keys out of the SQL.
 * @returns False if the user has no row with that id.
 */
export async function updateOwnedRow(
	table: string,
	columnNames: Record<string, string>,
	id: number,
	userId: string,
	changes: Record<string, unknown>,
) {
	const entries = Object.entries(changes);
	if (entries.length === 0) return true;

	const rs = await db.execute({
		sql: `UPDATE ${table} SET ${entries.map(([k]) => `${columnNames[k]} = ?`).join(", ")}
			WHERE id = ? AND user_id = ?`,
		args: [
			...entries.map(([, v]) =>
				typeof v === "boolean" ? (v ? 1 : 0) : (v as string | number | null),
			),
			id,
			userId,
		],
	});
	return rs.rowsAffected > 0;
}
