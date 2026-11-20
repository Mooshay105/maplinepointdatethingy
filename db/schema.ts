import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { EventColor, EventIcon } from "@/utils/types";

/** Users' events. Ids are generated client-side. */
export const events = sqliteTable(
	"events",
	{
		id: integer("id").primaryKey(),
		/** Clerk user id. */
		userId: text("user_id").notNull(),
		name: text("name").notNull(),
		lat: real("lat").notNull(),
		lng: real("lng").notNull(),
		/** Epoch milliseconds, or null when the event has no date. */
		date: integer("date"),
		icon: text("icon").$type<EventIcon>().notNull(),
		iconColor: text("icon_color").$type<EventColor>().notNull(),
		visible: integer("visible", { mode: "boolean" }).notNull().default(true),
		description: text("description").notNull().default(""),
		/** The address as the user typed it. */
		address: text("address").notNull().default(""),
		/** map_groups.id, or null when ungrouped. Also set for events in a layer. */
		groupId: integer("group_id"),
		/** layers.id, or null when not in a layer. */
		layerId: integer("layer_id"),
		/** Notes on getting here from the previous event, e.g. train time. */
		travelNote: text("travel_note").notNull().default(""),
		/** Whether the sidebar shows just its name and date. */
		collapsed: integer("collapsed", { mode: "boolean" }).notNull().default(false),
		/** A locked event can't be edited or deleted. */
		locked: integer("locked", { mode: "boolean" }).notNull().default(false),
	},
	(t) => [index("events_user_id").on(t.userId)],
);

/** Folders of events and layers. Ids are generated client-side. */
export const mapGroups = sqliteTable(
	"map_groups",
	{
		id: integer("id").primaryKey(),
		userId: text("user_id").notNull(),
		name: text("name").notNull(),
		visible: integer("visible", { mode: "boolean" }).notNull().default(true),
		/** Whether the sidebar folds it shut. */
		collapsed: integer("collapsed", { mode: "boolean" }).notNull().default(false),
		/** Epoch milliseconds, for keeping the groups in order. */
		created: integer("created").notNull(),
	},
	(t) => [index("map_groups_user_id").on(t.userId)],
);

/** Folders of events inside a group. Layers can't contain other layers. */
export const layers = sqliteTable(
	"layers",
	{
		id: integer("id").primaryKey(),
		userId: text("user_id").notNull(),
		/** map_groups.id */
		groupId: integer("group_id").notNull(),
		name: text("name").notNull(),
		visible: integer("visible", { mode: "boolean" }).notNull().default(true),
		/** Whether the sidebar folds it shut. */
		collapsed: integer("collapsed", { mode: "boolean" }).notNull().default(false),
		/** Epoch milliseconds. */
		created: integer("created").notNull(),
	},
	(t) => [index("layers_user_id").on(t.userId)],
);
