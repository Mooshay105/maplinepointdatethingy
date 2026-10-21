"use client";

import { useState } from "react";
import { Point } from "@/utils/types";
import { parseNzDate } from "@/utils/dates";

export const ICON_OPTIONS: { value: Point["icon"]; label: string }[] = [
	{ value: "indoor-athletics", label: "Indoor" },
	{ value: "outdoor-athletics", label: "Outdoor" },
	{ value: "road-running", label: "Road Running" },
	{ value: "cross-country", label: "Cross Country" },
	{ value: "trail-running", label: "Trail Running" },
	{ value: "combined-events", label: "Combined Events" },
	{ value: "race-walking", label: "Race Walking" },
	{ value: "diamond-league", label: "Diamond League" },
];

export const COLOR_OPTIONS: { value: Point["iconColor"]; label: string }[] = [
	{ value: "red", label: "Red" },
	{ value: "yellow", label: "Yellow" },
	{ value: "orange", label: "Orange" },
	{ value: "green", label: "Green" },
	{ value: "blue", label: "Blue" },
	{ value: "purple", label: "Purple" },
	{ value: "black", label: "Black" },
	{ value: "grey", label: "Grey" },
	{ value: "white", label: "White" },
];

/**
 * Editable fields for one event, shared by the sidebar and the map's hover menus.
 * Without onUpdate it's read-only (e.g. on the share page).
 */
export default function EventEditor({
	point,
	onUpdate,
	onDelete,
	className = "",
}: {
	point: Point;
	onUpdate?: (id: number, changes: Partial<Point>) => void;
	onDelete?: (id: number) => void;
	className?: string;
}) {
	// Text the user is typing that isn't a valid value yet, so the input doesn't snap back mid-edit
	const [drafts, setDrafts] = useState<{ date?: string; lat?: string; lng?: string }>({});
	const readOnly = !onUpdate;

	function update(changes: Partial<Point>) {
		onUpdate?.(point.id, changes);
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
					className="border border-[#f0f0f0] rounded-md mt-2 ml-2 mr-1 px-2 w-1/2 min-w-0"
					value={point.name}
					readOnly={readOnly}
					onChange={(e) => update({ name: e.target.value })}
					placeholder="Name"
				/>
				<input
					className="border border-[#f0f0f0] rounded-md mt-2 ml-1 mr-2 px-2 w-1/2 min-w-0"
					value={drafts.date ?? point.date.toLocaleDateString("en-NZ")}
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
						className="border border-[#f0f0f0] rounded-md mt-2 mr-2 px-2"
						title={point.visable ? "Hide" : "Show"}
						onClick={() => update({ visable: !point.visable })}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="28"
							height="28"
							viewBox="0 0 64 64"
							fill="none"
							stroke="#f0f0f0"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M8 32 Q32 12 56 32 Q32 52 8 32 Z" />
							<circle cx="32" cy="32" r="8" />
							{!point.visable ? <line x1="12" y1="12" x2="52" y2="52" /> : null}
						</svg>
					</button>
				) : null}
			</div>
			<div className="flex flex-row">
				<input
					className="border border-[#f0f0f0] rounded-md mt-2 ml-2 mr-1 px-2 w-1/2 min-w-0"
					value={drafts.lat ?? point.lat}
					readOnly={readOnly}
					onChange={(e) => updateCoordinate("lat", e.target.value)}
					onBlur={() => clearDraft("lat")}
					placeholder="Latitude"
				/>
				<input
					className="border border-[#f0f0f0] rounded-md mt-2 ml-1 mr-2 px-2 w-1/2 min-w-0"
					value={drafts.lng ?? point.lng}
					readOnly={readOnly}
					onChange={(e) => updateCoordinate("lng", e.target.value)}
					onBlur={() => clearDraft("lng")}
					placeholder="Longitude"
				/>
				{onDelete ? (
					<button
						className="border border-[#f0f0f0] rounded-md mt-2 mr-2 px-2"
						title="Delete"
						onClick={() => onDelete(point.id)}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="28"
							height="28"
							viewBox="0 0 64 64"
							fill="none"
							stroke="#f0f0f0"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<line x1="12" y1="18" x2="52" y2="18" />
							<path d="M26 18 V13 H38 V18" />
							<path d="M17 18 L20 56 H44 L47 18" />
							<line x1="28" y1="27" x2="28" y2="47" />
							<line x1="36" y1="27" x2="36" y2="47" />
						</svg>
					</button>
				) : null}
			</div>
			<div className="flex flex-row">
				<select
					className="border border-[#f0f0f0] bg-[#0f0f0f] rounded-md mt-2 ml-2 mr-1 px-2 w-1/2 min-w-0"
					value={point.icon}
					disabled={readOnly}
					onChange={(e) => update({ icon: e.target.value as Point["icon"] })}
				>
					{ICON_OPTIONS.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
				<select
					className="border border-[#f0f0f0] bg-[#0f0f0f] rounded-md mt-2 ml-1 mr-2 px-2 w-1/2 min-w-0"
					value={point.iconColor}
					disabled={readOnly}
					onChange={(e) => update({ iconColor: e.target.value as Point["iconColor"] })}
				>
					{COLOR_OPTIONS.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
			</div>
			{readOnly && !point.description ? (
				<div className="mb-2" />
			) : (
				<textarea
					className="block border border-[#f0f0f0] rounded-md mt-2 mb-2 mx-2 px-2 w-[calc(100%-16px)] resize-y min-h-[2.5em]"
					rows={2}
					value={point.description}
					readOnly={readOnly}
					onChange={(e) => update({ description: e.target.value })}
					placeholder="Description"
				/>
			)}
		</div>
	);
}
