import { createClient } from "@libsql/client";
import { and, eq, SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import z from "zod";
import * as schema from "@/db/schema";
import { events, layers, mapGroups } from "@/db/schema";
import { EVENT_ICONS, eventColorSchema } from "./types";

/** The Turso database, through Drizzle. The tables come from db/migrations, applied with `bun run db:migrate`. */
export const db = drizzle(
	createClient({
		url: process.env.TURSO_DATABASE_URL!,
		authToken: process.env.TURSO_AUTH_TOKEN,
	}),
	{ schema },
);

const idSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

/**
 * Reads a route's [id] param.
 * @param raw The param as it appears in the URL.
 * @returns The id, or null if it isn't a valid id.
 */
export function parseId(raw: string) {
	const id = Number(raw);
	return Number.isSafeInteger(id) ? id : null;
}

/** Event as sent over the wire: same as MapEvent, but the date is epoch milliseconds (or null). */
export const eventSchema = z.object({
	id: idSchema,
	name: z.string(),
	description: z.string(),
	address: z.string(),
	lat: z.number(),
	lng: z.number(),
	date: z.number().nullable(),
	icon: z.enum(EVENT_ICONS),
	iconColor: eventColorSchema,
	visible: z.boolean(),
	groupId: idSchema.nullable(),
	layerId: idSchema.nullable(),
	travelNote: z.string(),
	collapsed: z.boolean(),
	/** Optional so a page loaded before locking existed can still create events. */
	locked: z.boolean().default(false),
});

/** The fields a PATCH can change. Without locked's default, so leaving it out doesn't count as unlocking. */
export const eventChangesSchema = eventSchema
	.omit({ id: true })
	.extend({ locked: z.boolean() })
	.partial();

export type EventChanges = z.infer<typeof eventChangesSchema>;

/** The event columns sent to the browser: everything but the owner. */
export const eventFields = {
	id: events.id,
	name: events.name,
	description: events.description,
	address: events.address,
	lat: events.lat,
	lng: events.lng,
	date: events.date,
	icon: events.icon,
	iconColor: events.iconColor,
	visible: events.visible,
	groupId: events.groupId,
	layerId: events.layerId,
	travelNote: events.travelNote,
	collapsed: events.collapsed,
	locked: events.locked,
};

export const groupSchema = z.object({
	id: idSchema,
	name: z.string(),
	visible: z.boolean(),
	collapsed: z.boolean(),
});

export const groupChangesSchema = groupSchema.omit({ id: true }).partial();

export const layerSchema = groupSchema.extend({ groupId: idSchema });

/** Same as a group's: layers can't be moved to another group. */
export const layerChangesSchema = groupChangesSchema;

/** The group columns sent to the browser. */
export const groupFields = {
	id: mapGroups.id,
	name: mapGroups.name,
	visible: mapGroups.visible,
	collapsed: mapGroups.collapsed,
};

/** The layer columns sent to the browser. */
export const layerFields = {
	id: layers.id,
	name: layers.name,
	visible: layers.visible,
	collapsed: layers.collapsed,
	groupId: layers.groupId,
};

/**
 * Matches one of the user's rows.
 * @param table The table the row is in.
 * @param id The row's id.
 * @param userId The signed-in user, who has to own the row.
 * @returns A condition for a where clause.
 */
export function ownedRow(
	table: typeof events | typeof mapGroups | typeof layers,
	id: number,
	userId: string,
): SQL {
	return and(eq(table.id, id), eq(table.userId, userId))!;
}
