"use client";

import { useRef, useState } from "react";
import {
	COLOR_LABELS,
	EVENT_COLORS,
	EVENT_ICONS,
	EventColor,
	EventIcon,
	ICON_LABELS,
	Layer,
	MapEvent,
	MapGroup,
} from "@/utils/types";
import { formatNzDate, parseNzDate } from "@/utils/dates";
import { geocodeAddress } from "@/utils/geocode";
import { EyeIcon, TrashIcon } from "./Icons";
import PlacementSelect from "./PlacementSelect";

/**
 * Editable fields for one event, shared by the sidebar and the map's hover menus.
 * Without onUpdate it's read-only (e.g. on the share page).
 */
export default function EventEditor({
	event,
	onUpdate,
	onDelete,
	groups,
	layers = [],
	className = "",
}: {
	event: MapEvent;
	onUpdate?: (id: number, changes: Partial<MapEvent>) => void;
	onDelete?: (id: number) => void;
	/** Lets the event be moved between groups and layers. Left out, there's no picker. */
	groups?: MapGroup[];
	layers?: Layer[];
	className?: string;
}) {
	// Text the user is typing that isn't a valid value yet, so the input doesn't snap back mid-edit
	const [drafts, setDrafts] = useState<{ date?: string; lat?: string; lng?: string }>({});
	const [lookupFailed, setLookupFailed] = useState(false);
	// The address when the input was focused, so blurring without a change doesn't look it up again
	const addressOnFocus = useRef(event.address);
	// Bumped on every address edit, so a lookup that finishes after the address changed is ignored
	const addressVersion = useRef(0);
	const readOnly = !onUpdate;

	function update(changes: Partial<MapEvent>) {
		onUpdate?.(event.id, changes);
	}

	function clearDraft(key: keyof typeof drafts) {
		setDrafts((prev) => ({ ...prev, [key]: undefined }));
	}

	function updateCoordinate(key: "lat" | "lng", value: string) {
		setDrafts((prev) => ({ ...prev, [key]: value }));
		const n = Number(value);
		if (value.trim() !== "" && Number.isFinite(n)) update({ [key]: n });
	}

	/** Fills lat/lng from the address. The address itself is kept exactly as typed. */
	async function lookUpAddress() {
		const address = event.address.trim();
		if (address === "" || event.address === addressOnFocus.current) return;
		addressOnFocus.current = event.address;
		const version = addressVersion.current;
		const result = await geocodeAddress(address);
		if (addressVersion.current !== version) return;
		setLookupFailed(!result);
		if (result) update({ lat: result.latitude, lng: result.longitude });
	}

	return (
		<div className={className}>
			<div className="flex flex-row">
				<input
					className="border border-line rounded-md mt-2 ml-2 mr-1 px-2 w-1/2 min-w-0"
					value={event.name}
					readOnly={readOnly}
					onChange={(e) => update({ name: e.target.value })}
					placeholder="Name"
				/>
				<input
					className="border border-line rounded-md mt-2 ml-1 mr-2 px-2 w-1/2 min-w-0"
					value={drafts.date ?? formatNzDate(event.date)}
					readOnly={readOnly}
					onChange={(e) => setDrafts((prev) => ({ ...prev, date: e.target.value }))}
					onBlur={() => {
						if (drafts.date === undefined) return;
						const parsed = parseNzDate(drafts.date);
						if (parsed) {
							update({ date: parsed });
							clearDraft("date");
						}
					}}
					placeholder="Date (DD/MM/YYYY)"
				/>
				{onUpdate ? (
					<button
						className="border border-line rounded-md mt-2 mr-2 px-1"
						title={event.visible ? "Hide" : "Show"}
						aria-label={event.visible ? "Hide event" : "Show event"}
						onClick={() => update({ visible: !event.visible })}
					>
						<EyeIcon crossed={!event.visible} />
					</button>
				) : null}
			</div>
			{readOnly && !event.address ? null : (
				<input
					className={`block border rounded-md mt-2 mx-2 px-2 w-[calc(100%-16px)] ${lookupFailed ? "border-danger" : "border-line"}`}
					value={event.address}
					readOnly={readOnly}
					title={lookupFailed ? "Couldn't find this address" : undefined}
					onFocus={() => (addressOnFocus.current = event.address)}
					onChange={(e) => {
						addressVersion.current++;
						setLookupFailed(false);
						update({ address: e.target.value });
					}}
					onBlur={lookUpAddress}
					onKeyDown={(e) => {
						if (e.key === "Enter") e.currentTarget.blur();
					}}
					placeholder="Address"
				/>
			)}
			<div className="flex flex-row">
				<input
					className="border border-line rounded-md mt-2 ml-2 mr-1 px-2 w-1/2 min-w-0"
					value={drafts.lat ?? event.lat}
					readOnly={readOnly}
					onChange={(e) => updateCoordinate("lat", e.target.value)}
					onBlur={() => clearDraft("lat")}
					placeholder="Latitude"
				/>
				<input
					className="border border-line rounded-md mt-2 ml-1 mr-2 px-2 w-1/2 min-w-0"
					value={drafts.lng ?? event.lng}
					readOnly={readOnly}
					onChange={(e) => updateCoordinate("lng", e.target.value)}
					onBlur={() => clearDraft("lng")}
					placeholder="Longitude"
				/>
				{onDelete ? (
					<button
						className="border border-line rounded-md mt-2 mr-2 px-1"
						title="Delete"
						aria-label="Delete event"
						onClick={() => onDelete(event.id)}
					>
						<TrashIcon />
					</button>
				) : null}
			</div>
			<div className="flex flex-row">
				<select
					className="border border-line bg-panel rounded-md mt-2 ml-2 mr-1 px-2 w-1/2 min-w-0"
					value={event.icon}
					disabled={readOnly}
					onChange={(e) => update({ icon: e.target.value as EventIcon })}
				>
					{EVENT_ICONS.map((icon) => (
						<option key={icon} value={icon}>
							{ICON_LABELS[icon]}
						</option>
					))}
				</select>
				<select
					className="border border-line bg-panel rounded-md mt-2 ml-1 mr-2 px-2 w-1/2 min-w-0"
					value={event.iconColor}
					disabled={readOnly}
					onChange={(e) => update({ iconColor: e.target.value as EventColor })}
				>
					{EVENT_COLORS.map((color) => (
						<option key={color} value={color}>
							{COLOR_LABELS[color]}
						</option>
					))}
				</select>
			</div>
			{groups && !readOnly ? (
				<PlacementSelect
					className="block border border-line bg-panel rounded-md mt-2 mx-2 px-2 w-[calc(100%-16px)]"
					value={event}
					groups={groups}
					layers={layers}
					onChange={update}
				/>
			) : null}
			{readOnly && !event.description ? (
				<div className="mb-2" />
			) : (
				<textarea
					className="block border border-line rounded-md mt-2 mb-2 mx-2 px-2 w-[calc(100%-16px)] resize-y min-h-[2.5em]"
					rows={2}
					value={event.description}
					readOnly={readOnly}
					onChange={(e) => update({ description: e.target.value })}
					placeholder="Description"
				/>
			)}
		</div>
	);
}
