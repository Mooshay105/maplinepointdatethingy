"use client";

import { useState } from "react";
import {
	COLOR_LABELS,
	EVENT_COLORS,
	EVENT_ICONS,
	EventColor,
	EventIcon,
	ICON_LABELS,
	MapEvent,
} from "@/utils/types";
import { formatNzDate, parseNzDate } from "@/utils/dates";
import { EyeIcon, TrashIcon } from "./Icons";

/**
 * Editable fields for one event, shared by the sidebar and the map's hover menus.
 * Without onUpdate it's read-only (e.g. on the share page).
 */
export default function EventEditor({
	event,
	onUpdate,
	onDelete,
	className = "",
}: {
	event: MapEvent;
	onUpdate?: (id: number, changes: Partial<MapEvent>) => void;
	onDelete?: (id: number) => void;
	className?: string;
}) {
	// Text the user is typing that isn't a valid value yet, so the input doesn't snap back mid-edit
	const [drafts, setDrafts] = useState<{ date?: string; lat?: string; lng?: string }>({});
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
