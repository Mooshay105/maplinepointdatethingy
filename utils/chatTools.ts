import z from "zod";
import { EVENT_COLORS, EVENT_ICONS } from "./types";

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
	iconColor: z.enum(EVENT_COLORS).optional().describe("The color of the event's icon"),
});

export const editEventInput = z.object({
	id: z.number().describe("The id of the event"),
	name: z.string().optional().describe("The name of the event"),
	description: z.string().optional().describe("A description of the event"),
	date: z.string().optional().describe("The date of the event, in DD/MM/YYYY format"),
	address: z.string().optional().describe("The event's address, as the user wrote it"),
	latitude: z.number().optional().describe("The latitude of the event"),
	longitude: z.number().optional().describe("The longitude of the event"),
});

export const deleteEventInput = z.object({
	id: z.number().describe("The id of the event"),
});

export type AddEventInput = z.infer<typeof addEventInput>;
export type EditEventInput = z.infer<typeof editEventInput>;
export type DeleteEventInput = z.infer<typeof deleteEventInput>;
