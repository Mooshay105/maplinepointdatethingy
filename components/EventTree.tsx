"use client";

import { ReactNode } from "react";
import { Layer, MapEvent, MapGroup } from "@/utils/types";
import { placementOf } from "@/utils/groups";
import EventEditor from "./EventEditor";
import { ChevronIcon, EyeIcon, TrashIcon } from "./Icons";

/** The sidebar's list of events, nested in their groups and layers. Groups come first, then ungrouped events. */
export default function EventTree({
	events,
	groups,
	layers,
	onUpdateEvent,
	onDeleteEvent,
	onUpdateGroup,
	onDeleteGroup,
	onAddLayer,
	onUpdateLayer,
	onDeleteLayer,
	onHoverEvent,
}: {
	events: MapEvent[];
	groups: MapGroup[];
	layers: Layer[];
	onUpdateEvent: (id: number, changes: Partial<MapEvent>) => void;
	onDeleteEvent: (id: number) => void;
	onUpdateGroup: (id: number, changes: Partial<MapGroup>) => void;
	onDeleteGroup: (id: number) => void;
	onAddLayer: (groupId: number) => void;
	onUpdateLayer: (id: number, changes: Partial<Layer>) => void;
	onDeleteLayer: (id: number) => void;
	/** Called with an event's id when the mouse enters it, and null when it leaves. */
	onHoverEvent?: (id: number | null) => void;
}) {
	const placed = events.map((event) => ({ event, ...placementOf(event, groups, layers) }));

	function renderEvents(filter: (p: (typeof placed)[number]) => boolean) {
		return placed.filter(filter).map(({ event }) => (
			<div
				key={event.id}
				onMouseEnter={() => onHoverEvent?.(event.id)}
				onMouseLeave={() => onHoverEvent?.(null)}
			>
				<EventEditor
					event={event}
					onUpdate={onUpdateEvent}
					onDelete={onDeleteEvent}
					groups={groups}
					layers={layers}
					collapsible
					className="my-2 rounded-lg border border-line bg-panel-sunken/40"
				/>
			</div>
		));
	}

	return (
		<>
			{groups.map((group) => (
				<Folder
					key={group.id}
					kind="group"
					folder={group}
					onUpdate={(changes) => onUpdateGroup(group.id, changes)}
					onDelete={() => onDeleteGroup(group.id)}
					onAddLayer={() => onAddLayer(group.id)}
				>
					{layers
						.filter((layer) => layer.groupId === group.id)
						.map((layer) => (
							<Folder
								key={layer.id}
								kind="layer"
								folder={layer}
								onUpdate={(changes) => onUpdateLayer(layer.id, changes)}
								onDelete={() => onDeleteLayer(layer.id)}
							>
								{renderEvents((p) => p.layer?.id === layer.id)}
							</Folder>
						))}
					{renderEvents((p) => p.group?.id === group.id && !p.layer)}
				</Folder>
			))}
			{renderEvents((p) => !p.group)}
		</>
	);
}

/** A collapsible group or layer, with its name, visibility and delete controls. */
function Folder({
	kind,
	folder,
	onUpdate,
	onDelete,
	onAddLayer,
	children,
}: {
	kind: "group" | "layer";
	folder: MapGroup | Layer;
	onUpdate: (changes: { name?: string; visible?: boolean; collapsed?: boolean }) => void;
	onDelete: () => void;
	/** Only groups get this: layers can't contain layers. */
	onAddLayer?: () => void;
	children: ReactNode;
}) {
	// Saved with the group or layer, so it stays folded after a reload
	const open = !folder.collapsed;
	const isEmpty = Array.isArray(children) ? children.flat().length === 0 : !children;

	return (
		<section className="my-2" aria-label={folder.name || (kind === "group" ? "Untitled group" : "Untitled layer")}>
			<div className="flex items-center gap-1 rounded-md py-0.5 pr-0.5">
				<button
					className="icon-button w-6"
					aria-label={open ? `Collapse ${kind}` : `Expand ${kind}`}
					aria-expanded={open}
					onClick={() => onUpdate({ collapsed: open })}
				>
					<ChevronIcon open={open} size={18} />
				</button>
				<input
					className={`field flex-1 border-transparent border-b-line/60 bg-transparent px-1.5 font-display font-semibold hover:border-line ${kind === "group" ? "text-lg" : "text-base"}`}
					aria-label={kind === "group" ? "Group name" : "Layer name"}
					value={folder.name}
					onChange={(e) => onUpdate({ name: e.target.value })}
					placeholder={kind === "group" ? "Untitled group" : "Untitled layer"}
				/>
				{onAddLayer ? (
					<button
						className="button h-7 border-line/60 px-2 text-sm text-muted hover:text-panel-foreground"
						title="Add a layer to this group"
						onClick={() => {
							if (!open) onUpdate({ collapsed: false });
							onAddLayer();
						}}
					>
						New layer
					</button>
				) : null}
				<button
					className="icon-button"
					title={folder.visible ? "Hide" : "Show"}
					aria-label={folder.visible ? `Hide ${kind}` : `Show ${kind}`}
					onClick={() => onUpdate({ visible: !folder.visible })}
				>
					<EyeIcon crossed={!folder.visible} size={18} />
				</button>
				<button
					className="icon-button ml-1 hover:text-danger"
					title={`Delete ${kind} (its events are kept)`}
					aria-label={`Delete ${kind}`}
					onClick={onDelete}
				>
					<TrashIcon size={18} />
				</button>
			</div>
			{open ? (
				// Dimmed while hidden, since nothing in here is on the map. The rule down the left
				// shows what's inside: solid for a group, dashed for a layer.
				<div
					className={`ml-2.5 border-l-2 pl-1 ${kind === "layer" ? "border-dashed border-line" : "border-line"} ${folder.visible ? "" : "opacity-50"}`}
				>
					{isEmpty ? (
						<p className="py-2 pl-1 text-sm text-muted">
							Nothing here yet. Choose this {kind} on an event to move it in.
						</p>
					) : (
						children
					)}
				</div>
			) : null}
		</section>
	);
}
