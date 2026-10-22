import { MapEvent } from "./types";
import { createSync, sendJson } from "./sync";

type WireEvent = Omit<MapEvent, "date"> & { date: number };

function toWire(fields: Partial<MapEvent>): Record<string, unknown> {
	return fields.date ? { ...fields, date: fields.date.getTime() } : fields;
}

const sync = createSync<MapEvent>("/api/events", "event", toWire);

/** Loads the signed-in user's events, or another user's when given their id (for the share page). */
export async function fetchEvents(userId?: string): Promise<MapEvent[]> {
	const url = userId ? `/api/events?userId=${encodeURIComponent(userId)}` : "/api/events";
	const res = await fetch(url, { cache: "no-store" });
	if (!res.ok) throw new Error(`Failed to load events: ${res.status}`);
	const events: WireEvent[] = await res.json();
	return events.map((e) => ({ ...e, date: new Date(e.date) }));
}

export const createEvent = sync.create;

/** Uploads several events in one request (used to migrate old localStorage data). */
export async function createEvents(events: MapEvent[]) {
	const res = await sendJson("/api/events", "POST", events.map(toWire));
	if (!res.ok) throw new Error(`Failed to upload events: ${res.status}`);
}

export const updateEvent = sync.update;
export const deleteEvent = sync.remove;
