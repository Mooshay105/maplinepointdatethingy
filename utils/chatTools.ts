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
	groupId: z.number().optional().describe("The id of the group this event belongs to"),
	layerId: z
		.number()
		.optional()
		.describe(
			"The id of the layer this event belongs to. Its group is used automatically.",
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

export type AddEventInput = z.infer<typeof addEventInput>;
export type EditEventInput = z.infer<typeof editEventInput>;
export type DeleteEventInput = z.infer<typeof deleteEventInput>;
export type AddGroupInput = z.infer<typeof addGroupInput>;
export type EditGroupInput = z.infer<typeof editGroupInput>;
export type DeleteGroupInput = z.infer<typeof deleteGroupInput>;
export type AddLayerInput = z.infer<typeof addLayerInput>;
export type EditLayerInput = z.infer<typeof editLayerInput>;
export type DeleteLayerInput = z.infer<typeof deleteLayerInput>;
