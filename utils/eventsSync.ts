import { Point } from "./types";

// Client-side sync with /api/events. The UI updates its local state first, then calls these to persist in the background.

type WireEvent = Omit<Point, "date"> & { date: number };

const UPDATE_DEBOUNCE_MS = 400;

/** Requests for the same event run one after another, so e.g. an edit can't land before its create. */
const chains = new Map<number, Promise<void>>();
const pendingChanges = new Map<number, Record<string, unknown>>();
const pendingTimers = new Map<number, ReturnType<typeof setTimeout>>();

function enqueue(id: number, label: string, request: () => Promise<Response>) {
	const next = (chains.get(id) ?? Promise.resolve())
		.then(request)
		.then(async (res) => {
			if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
		})
		.catch((err) => console.error(`Failed to ${label} event ${id}:`, err));
	chains.set(id, next);
	next.finally(() => {
		if (chains.get(id) === next) chains.delete(id);
	});
}

function toWire(point: Point): WireEvent {
	return { ...point, date: point.date.getTime() };
}

function sendJson(url: string, method: string, body: unknown, keepalive = false) {
	return fetch(url, {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		keepalive,
	});
}

export async function fetchEvents(): Promise<Point[]> {
	const res = await fetch("/api/events", { cache: "no-store" });
	if (!res.ok) throw new Error(`Failed to load events: ${res.status}`);
	const events: WireEvent[] = await res.json();
	return events.map((e) => ({ ...e, date: new Date(e.date) }));
}

export function createEvent(point: Point) {
	enqueue(point.id, "create", () => sendJson("/api/events", "POST", toWire(point), true));
}

/** Uploads several events in one request (used to migrate old localStorage data). */
export async function createEvents(points: Point[]) {
	const res = await sendJson("/api/events", "POST", points.map(toWire));
	if (!res.ok) throw new Error(`Failed to upload events: ${res.status}`);
}

/** Merges changes into a pending update that's sent once edits to this event pause, so typing doesn't fire a request per key. */
export function updateEvent(id: number, changes: Partial<Point>) {
	const wire: Record<string, unknown> = { ...changes };
	if (changes.date) wire.date = changes.date.getTime();
	pendingChanges.set(id, { ...pendingChanges.get(id), ...wire });

	clearTimeout(pendingTimers.get(id));
	pendingTimers.set(
		id,
		setTimeout(() => flushUpdate(id), UPDATE_DEBOUNCE_MS),
	);
}

function flushUpdate(id: number) {
	clearTimeout(pendingTimers.get(id));
	pendingTimers.delete(id);
	const changes = pendingChanges.get(id);
	pendingChanges.delete(id);
	if (changes) enqueue(id, "update", () => sendJson(`/api/events/${id}`, "PATCH", changes, true));
}

export function deleteEvent(id: number) {
	clearTimeout(pendingTimers.get(id));
	pendingTimers.delete(id);
	pendingChanges.delete(id);
	enqueue(id, "delete", () => fetch(`/api/events/${id}`, { method: "DELETE", keepalive: true }));
}

/** Sends any debounced updates right away, e.g. before the page unloads. */
export function flushAllUpdates() {
	for (const id of [...pendingChanges.keys()]) flushUpdate(id);
}
