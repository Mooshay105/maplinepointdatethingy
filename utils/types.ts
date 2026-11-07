import z from "zod";

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
	"dna",
	"want-to-go",
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
	dna: "DNA",
	"want-to-go": "Want to Go",
};

/** The named colours offered in the dropdowns. Events can also use any custom colour as a hex code. */
export const EVENT_COLORS = [
	"red",
	"yellow",
	"orange",
	"green",
	"blue",
	"purple",
	"bronze",
	"black",
	"grey",
	"white",
] as const;

export type PresetColor = (typeof EVENT_COLORS)[number];

/** A preset name, or a custom colour as a 6-digit hex code like "#ff8800". */
export type EventColor = PresetColor | `#${string}`;

export const COLOR_LABELS: Record<PresetColor, string> = {
	red: "Red",
	yellow: "Yellow",
	orange: "Orange",
	green: "Green",
	blue: "Blue",
	purple: "Purple",
	bronze: "Bronze",
	black: "Black",
	grey: "Grey",
	white: "White",
};

/** The disc colour of each preset marker. */
export const PRESET_HEX: Record<PresetColor, string> = {
	red: "#fc413d",
	orange: "#e65100",
	yellow: "#ffea00",
	green: "#097138",
	blue: "#1e88e5",
	purple: "#9c27b0",
	bronze: "#cd7f32",
	black: "#0f0f0f",
	grey: "#707070",
	white: "#f0f0f0",
};

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Validates an event colour: a preset name, or a hex code (stored lowercase). */
export const eventColorSchema = z.union([
	z.enum(EVENT_COLORS),
	z
		.string()
		.regex(HEX_COLOR_PATTERN)
		.transform((hex) => hex.toLowerCase() as `#${string}`),
]);

export function isPresetColor(color: string): color is PresetColor {
	return (EVENT_COLORS as readonly string[]).includes(color);
}

/** The hex code an event colour is drawn in. */
export function colorHex(color: EventColor): string {
	return isPresetColor(color) ? PRESET_HEX[color] : color.toLowerCase();
}

/**
 * The glyph colour for a marker disc: white, unless white would be hard to read on it
 * (contrast under 3:1, e.g. on yellow or white), then near-black.
 */
export function readableOn(hex: string): string {
	const channel = (i: number) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
	return 1.05 / (luminance + 0.05) >= 3 ? "#ffffff" : "#0f0f0f";
}

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
	/** The group the event sits in, or null when it isn't in one. Events in a layer also store that layer's group. */
	groupId: number | null;
	/** The layer the event sits in, or null when it sits directly in its group (or in no group). */
	layerId: number | null;
	/**
	 * Notes on getting here from the previous event on the map, e.g. "~4h by train".
	 * Shown on the line leading into this event.
	 */
	travelNote: string;
	/** Whether the sidebar shows just its name and date. */
	collapsed: boolean;
	/**
	 * A locked event can't be changed, moved, hidden, shown or deleted until it's unlocked.
	 * Only the lock itself, and whether the sidebar shows it collapsed, can still be changed.
	 */
	locked: boolean;
};

/** Fields a locked event still lets you change: the lock, and whether the sidebar shows it collapsed. */
export const LOCK_EXEMPT_FIELDS: readonly string[] = ["locked", "collapsed"];

/** Whether `changes` would touch anything on a locked event other than the lock (or how the sidebar shows it). */
export function editsLockedEvent(event: Pick<MapEvent, "locked">, changes: object) {
	return event.locked && Object.keys(changes).some((key) => !LOCK_EXEMPT_FIELDS.includes(key));
}

/** A folder of events and layers that can be hidden from the map all at once. */
export type MapGroup = {
	id: number;
	name: string;
	visible: boolean;
	/** Whether the sidebar folds it shut. */
	collapsed: boolean;
};

/** A folder of events inside a group. Layers can't contain other layers. */
export type Layer = {
	id: number;
	groupId: number;
	name: string;
	visible: boolean;
	/** Whether the sidebar folds it shut. */
	collapsed: boolean;
};

export type LegacyEvent = Omit<
	MapEvent,
	| "date"
	| "description"
	| "address"
	| "visible"
	| "groupId"
	| "layerId"
	| "travelNote"
	| "collapsed"
	| "locked"
> & {
	date: string;
	description?: string;
	visable?: boolean;
};
