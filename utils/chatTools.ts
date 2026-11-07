import z from "zod";
import { EVENT_COLORS, EVENT_ICONS, eventColorSchema } from "./types";

const iconColorInput = eventColorSchema
	.optional()
	.describe(
		`The color of the event's icon: one of ${EVENT_COLORS.join(", ")}, or any custom color as a 6-digit hex code like #ff8800`,
	);

// Input schemas for the chat tools that run in the browser (see onToolCall in app/page.tsx).
// Shared so the server's tool definitions and the client's handler agree on the shape.

export const addEventInput = z.object({
	name: z.string().describe("The name of the event"),
	description: z.string().optional().describe("A description of the event"),
	date: z.string().describe("The date of the event, in DD/MM/YYYY format"),
	address: z.string().optional().describe("The event's address, as the user wrote it"),
	latitude: z.number().describe("The latitude of the event"),
	longitude: z.number().describe("The longitude of the event"),
	icon: z.enum(EVENT_ICONS).optional().describe("The icon to use for the event"),
	iconColor: iconColorInput,
	groupId: z.number().optional().describe("The id of the group this event belongs to"),
	layerId: z
		.number()
		.optional()
		.describe(
			"The id of the layer this event belongs to. Its group is used automatically.",
		),
	travelNote: z
		.string()
		.optional()
		.describe(
			"Notes on getting to this event from the previous one on the map (by date), e.g. the approximate train time",
		),
});

export const editEventInput = z.object({
	id: z.number().describe("The id of the event"),
	name: z.string().optional().describe("The name of the event"),
	description: z.string().optional().describe("A description of the event"),
	date: z.string().optional().describe("The date of the event, in DD/MM/YYYY format"),
	address: z.string().optional().describe("The event's address, as the user wrote it"),
	latitude: z.number().optional().describe("The latitude of the event"),
	longitude: z.number().optional().describe("The longitude of the event"),
	icon: z.enum(EVENT_ICONS).optional().describe("The icon to use for the event"),
	iconColor: iconColorInput,
	groupId: z
		.number()
		.nullable()
		.optional()
		.describe(
			"The id of the group to move the event into, directly (out of any layer). null takes it out of its group and layer.",
		),
	layerId: z
		.number()
		.nullable()
		.optional()
		.describe(
			"The id of the layer to move the event into. Its group is used automatically and wins over groupId. null takes it out of its layer but keeps it in its group, unless groupId says otherwise.",
		),
	travelNote: z
		.string()
		.optional()
		.describe(
			"Notes on getting to this event from the previous one on the map (by date), e.g. the approximate train time",
		),
});

export const setTravelNoteInput = z.object({
	fromEventId: z.number().describe("The id of the event the stretch starts at"),
	toEventId: z.number().describe("The id of the event the stretch ends at"),
	travelNote: z
		.string()
		.describe(
			"Notes on travelling between the two, e.g. the approximate train time. An empty string clears it.",
		),
});

export const deleteEventInput = z.object({
	id: z.number().describe("The id of the event"),
});

export const addGroupInput = z.object({
	name: z.string().describe("The name of the group"),
	visible: z
		.boolean()
		.optional()
		.describe("Whether the group is shown on the map. Defaults to true."),
});

export const editGroupInput = z.object({
	id: z.number().describe("The id of the group"),
	name: z.string().optional().describe("The name of the group"),
	visible: z.boolean().optional().describe("Whether the group is shown on the map"),
});

export const deleteGroupInput = z.object({
	id: z.number().describe("The id of the group"),
});

export const addLayerInput = z.object({
	groupId: z.number().describe("The id of the group the layer goes in"),
	name: z.string().describe("The name of the layer"),
	visible: z
		.boolean()
		.optional()
		.describe("Whether the layer is shown on the map. Defaults to true."),
});

export const editLayerInput = z.object({
	id: z.number().describe("The id of the layer"),
	name: z.string().optional().describe("The name of the layer"),
	visible: z.boolean().optional().describe("Whether the layer is shown on the map"),
});

export const deleteLayerInput = z.object({
	id: z.number().describe("The id of the layer"),
});

/** Shared by hideItems and showItems. */
export const setVisibilityInput = z.object({
	eventIds: z.array(z.number()).optional().describe("The ids of the events"),
	groupIds: z
		.array(z.number())
		.optional()
		.describe("The ids of the groups. This affects everything inside them on the map."),
	layerIds: z
		.array(z.number())
		.optional()
		.describe("The ids of the layers. This affects every event inside them on the map."),
	allEvents: z
		.boolean()
		.optional()
		.describe("Set to true to apply this to every event, instead of listing their ids"),
});

/** Shared by collapseItems and expandItems. */
export const setCollapsedInput = z.object({
	eventIds: z.array(z.number()).optional().describe("The ids of the events"),
	groupIds: z.array(z.number()).optional().describe("The ids of the groups"),
	layerIds: z.array(z.number()).optional().describe("The ids of the layers"),
	allEvents: z
		.boolean()
		.optional()
		.describe("Set to true to apply this to every event, instead of listing their ids"),
	allGroups: z
		.boolean()
		.optional()
		.describe("Set to true to apply this to every group, instead of listing their ids"),
	allLayers: z
		.boolean()
		.optional()
		.describe("Set to true to apply this to every layer, instead of listing their ids"),
});

export const setLockedInput = z.object({
	eventIds: z.array(z.number()).describe("The ids of the events"),
	locked: z
		.boolean()
		.describe(
			"True to lock the events, so nothing about them can be changed, hidden, shown or deleted. False to unlock them.",
		),
});

export type AddEventInput = z.infer<typeof addEventInput>;
export type EditEventInput = z.infer<typeof editEventInput>;
export type SetTravelNoteInput = z.infer<typeof setTravelNoteInput>;
export type DeleteEventInput = z.infer<typeof deleteEventInput>;
export type AddGroupInput = z.infer<typeof addGroupInput>;
export type EditGroupInput = z.infer<typeof editGroupInput>;
export type DeleteGroupInput = z.infer<typeof deleteGroupInput>;
export type AddLayerInput = z.infer<typeof addLayerInput>;
export type EditLayerInput = z.infer<typeof editLayerInput>;
export type DeleteLayerInput = z.infer<typeof deleteLayerInput>;
export type SetVisibilityInput = z.infer<typeof setVisibilityInput>;
export type SetCollapsedInput = z.infer<typeof setCollapsedInput>;
export type SetLockedInput = z.infer<typeof setLockedInput>;
