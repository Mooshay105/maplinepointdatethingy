"use client";

import { useRef, useState } from "react";
import {
	EVENT_ICONS,
	EventIcon,
	ICON_LABELS,
	Layer,
	MapEvent,
	MapGroup,
	colorHex,
} from "@/utils/types";
import { formatNzDate, parseNzDate } from "@/utils/dates";
import { geocodeAddress } from "@/utils/geocode";
import { ChevronIcon, EyeIcon, LockIcon, TrashIcon } from "./Icons";
import PlacementSelect from "./PlacementSelect";
import ColorSelect from "./ColorSelect";

/**
 * Editable fields for one event, shared by the sidebar and the map's hover menus.
 * Without onUpdate it's read-only (e.g. on the share page). A locked event is read-only too,
 * apart from its lock button.
 */
export default function EventEditor({
	event,
	onUpdate,
	onDelete,
	groups,
	layers = [],
	collapsible = false,
	className = "",
}: {
	event: MapEvent;
	onUpdate?: (id: number, changes: Partial<MapEvent>) => void;
	onDelete?: (id: number) => void;
	/** Lets the event be moved between groups and layers. Left out, there's no picker. */
	groups?: MapGroup[];
	layers?: Layer[];
	/** Adds a toggle that folds the event down to just its name and date (saved as event.collapsed). */
	collapsible?: boolean;
	className?: string;
}) {
	// Text the user is typing that isn't a valid value yet, so the input doesn't snap back mid-edit
	const [drafts, setDrafts] = useState<{ date?: string; lat?: string; lng?: string }>({});
	const [lookupFailed, setLookupFailed] = useState(false);
	// The address when the input was focused, so blurring without a change doesn't look it up again
	const addressOnFocus = useRef(event.address);
	// Bumped on every address edit, so a lookup that finishes after the address changed is ignored
	const addressVersion = useRef(0);
	const editable = onUpdate !== undefined;
	const readOnly = !editable || event.locked;
	// Collapsing only changes the sidebar, so it still works on a locked event
	const canCollapse = collapsible && editable;
	const collapsed = canCollapse && event.collapsed;

	function update(changes: Partial<MapEvent>) {
		if (!readOnly) onUpdate?.(event.id, changes);
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

	const lockButton = editable ? (
		// The one control a locked event keeps
		<button
			className={`icon-button ${event.locked ? "text-accent" : ""}`}
			title={event.locked ? "Unlock" : "Lock (stops all changes until unlocked)"}
			aria-label={event.locked ? "Unlock event" : "Lock event"}
			aria-pressed={event.locked}
			onClick={() => onUpdate(event.id, { locked: !event.locked })}
		>
			<LockIcon open={!event.locked} size={18} />
		</button>
	) : null;

	return (
		<div className={className}>
			<div className="flex items-center gap-1 px-1.5 py-1.5 pr-2">
				{canCollapse ? (
					<button
						className="icon-button w-6"
						aria-label={collapsed ? "Expand event" : "Collapse event"}
						aria-expanded={!collapsed}
						// Straight to onUpdate, as update() is blocked while locked and collapsing is still allowed
						onClick={() => onUpdate?.(event.id, { collapsed: !collapsed })}
					>
						<ChevronIcon open={!collapsed} size={18} />
					</button>
				) : null}
				{/* The marker's colour, to match this card to its spot on the map */}
				<span
					aria-hidden="true"
					className={`h-3 w-3 shrink-0 rounded-full ring-1 ring-panel-foreground/40 ${canCollapse ? "" : "ml-1"}`}
					style={{ background: colorHex(event.iconColor) }}
				/>
				<input
					className="field flex-1 px-1.5 font-display text-[1.0625rem] font-semibold"
					aria-label="Name"
					value={event.name}
					readOnly={readOnly}
					onChange={(e) => update({ name: e.target.value })}
					title={event.name}
					placeholder="Untitled event"
				/>
				<input
					className="field w-[5.75rem] shrink-0 px-1.5 text-right text-sm tabular-nums"
					aria-label="Date, DD/MM/YYYY"
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
					placeholder="DD/MM/YYYY"
				/>
			</div>
			{collapsed ? null : (
				<div className="grid grid-cols-2 gap-1.5 px-3 pb-2.5 text-sm">
					{readOnly && !event.address ? null : (
						<input
							className={`field col-span-2 ${lookupFailed ? "border-danger" : ""}`}
							aria-label="Address"
							aria-invalid={lookupFailed || undefined}
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
					{lookupFailed ? (
						<p className="col-span-2 -mt-1 text-sm text-danger">
							Couldn&apos;t find this address. Check it, or type the coordinates.
						</p>
					) : null}
					<input
						className="field tabular-nums"
						aria-label="Latitude"
						value={drafts.lat ?? event.lat}
						readOnly={readOnly}
						onChange={(e) => updateCoordinate("lat", e.target.value)}
						onBlur={() => clearDraft("lat")}
						placeholder="Latitude"
					/>
					<input
						className="field tabular-nums"
						aria-label="Longitude"
						value={drafts.lng ?? event.lng}
						readOnly={readOnly}
						onChange={(e) => updateCoordinate("lng", e.target.value)}
						onBlur={() => clearDraft("lng")}
						placeholder="Longitude"
					/>
					<select
						className="field"
						aria-label="Icon"
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
					<ColorSelect
						className="flex min-w-0 gap-1.5"
						selectClassName="field flex-1"
						value={event.iconColor}
						disabled={readOnly}
						onChange={(iconColor) => update({ iconColor })}
					/>
					{groups && editable ? (
						<PlacementSelect
							disabled={readOnly}
							className="field col-span-2"
							value={event}
							groups={groups}
							layers={layers}
							onChange={update}
						/>
					) : null}
					{readOnly && !event.description ? null : (
						<textarea
							className="field col-span-2 min-h-8 resize-y"
							aria-label="Description"
							rows={1}
							value={event.description}
							readOnly={readOnly}
							onChange={(e) => update({ description: e.target.value })}
							placeholder="Description"
						/>
					)}
					{editable ? (
						<div className="col-span-2 -mb-1 flex items-center justify-end gap-1">
							{event.locked ? (
								<p className="mr-auto text-sm text-muted">Locked. Unlock to make changes.</p>
							) : null}
							<button
								className="icon-button"
								title={event.locked ? "Unlock to hide or show" : event.visible ? "Hide" : "Show"}
								aria-label={event.visible ? "Hide event" : "Show event"}
								disabled={readOnly}
								onClick={() => update({ visible: !event.visible })}
							>
								<EyeIcon crossed={!event.visible} size={18} />
							</button>
							{lockButton}
							{onDelete ? (
								<button
									// Set apart from the lock, so a slip doesn't delete
									className="icon-button ml-2 hover:text-danger"
									title={event.locked ? "Unlock to delete" : "Delete"}
									aria-label="Delete event"
									disabled={event.locked}
									onClick={() => onDelete(event.id)}
								>
									<TrashIcon size={18} />
								</button>
							) : null}
						</div>
					) : null}
				</div>
			)}
		</div>
	);
}
