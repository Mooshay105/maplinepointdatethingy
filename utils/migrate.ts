import { LegacyEvent, MapEvent } from "./types";
import * as eventsSync from "@/utils/eventsSync";

/** Where the old localStorage-only version of the app saved events (it called them "points"). */
const LEGACY_STORAGE_KEY = "points";

/** Loads the user's events, first uploading any left over from the localStorage-only version. */
export async function loadEvents(): Promise<MapEvent[]> {
	const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
	if (stored) {
		const legacy: MapEvent[] = (JSON.parse(stored) as LegacyEvent[]).map(
			({ visable, ...event }) => ({
				description: "",
				address: "",
				...event,
				date: new Date(event.date),
				visible: visable ?? true,
				groupId: null,
				layerId: null,
			}),
		);
		await eventsSync.createEvents(legacy);
		localStorage.removeItem(LEGACY_STORAGE_KEY);
	}
	return eventsSync.fetchEvents();
}
