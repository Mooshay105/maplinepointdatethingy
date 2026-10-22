// Single source of truth for the marker icons and colours. The type, the dropdowns and the
// API validation (utils/db.ts) are all built from these lists, so adding one here adds it everywhere.

export const EVENT_ICONS = [
	"indoor-athletics",
	"outdoor-athletics",
	"road-running",
	"cross-country",
	"trail-running",
	"combined-events",
	"race-walking",
	"diamond-league",
] as const;

export type EventIcon = (typeof EVENT_ICONS)[number];

/** Each icon's file is /public/icons/<icon>.svg. */
export const ICON_LABELS: Record<EventIcon, string> = {
	"indoor-athletics": "Indoor",
	"outdoor-athletics": "Outdoor",
	"road-running": "Road Running",
	"cross-country": "Cross Country",
	"trail-running": "Trail Running",
	"combined-events": "Combined Events",
	"race-walking": "Race Walking",
	"diamond-league": "Diamond League",
};

export const EVENT_COLORS = [
	"red",
	"yellow",
	"orange",
	"green",
	"blue",
	"purple",
	"black",
	"grey",
	"white",
] as const;

export type EventColor = (typeof EVENT_COLORS)[number];

export const COLOR_LABELS: Record<EventColor, string> = {
	red: "Red",
	yellow: "Yellow",
	orange: "Orange",
	green: "Green",
	blue: "Blue",
	purple: "Purple",
	black: "Black",
	grey: "Grey",
	white: "White",
};

// Not called `Event`: that name already belongs to the browser's DOM Event type, so a missing
// import would silently use the wrong type instead of giving an error.
export type MapEvent = {
	id: number;
	name: string;
	description: string;
	/** The address as the user typed it. Looked up to fill lat/lng, but never overwritten by them. */
	address: string;
	lat: number;
	lng: number;
	date: Date;
	icon: EventIcon;
	iconColor: EventColor;
	visible: boolean;
};

export type LegacyEvent = Omit<MapEvent, "date" | "description" | "address" | "visible"> & {
	date: string;
	description?: string;
	visable?: boolean;
};
