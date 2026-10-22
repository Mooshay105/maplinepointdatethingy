"use client";

import { ReactNode, useState } from "react";
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
}) {
	const placed = events.map((event) => ({ event, ...placementOf(event, groups, layers) }));

	function renderEvents(filter: (p: (typeof placed)[number]) => boolean) {
		return placed.filter(filter).map(({ event }) => (
			<EventEditor
				key={event.id}
				event={event}
				onUpdate={onUpdateEvent}
				onDelete={onDeleteEvent}
				groups={groups}
				layers={layers}
				className="border border-line rounded-xl m-2"
			/>
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
	onUpdate: (changes: { name?: string; visible?: boolean }) => void;
	onDelete: () => void;
	/** Only groups get this: layers can't contain layers. */
	onAddLayer?: () => void;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(true);
	const isEmpty = Array.isArray(children) ? children.flat().length === 0 : !children;

	return (
		<div className={`border border-line rounded-xl m-2 ${kind === "layer" ? "border-dashed" : ""}`}>
			<div className="flex flex-row items-center">
				<button
					className="mt-2 ml-1 px-1"
					aria-label={open ? `Collapse ${kind}` : `Expand ${kind}`}
					aria-expanded={open}
					onClick={() => setOpen((v) => !v)}
				>
					<ChevronIcon open={open} size={20} />
				</button>
				<input
					className="border border-line rounded-md mt-2 mr-1 px-2 grow min-w-0 font-semibold"
					value={folder.name}
					onChange={(e) => onUpdate({ name: e.target.value })}
					placeholder={kind === "group" ? "Group name" : "Layer name"}
				/>
				{onAddLayer ? (
					<button
						className="border border-line rounded-md mt-2 mr-1 px-1 whitespace-nowrap"
						title="Add a layer to this group"
						onClick={() => {
							setOpen(true);
							onAddLayer();
						}}
					>
						+ Layer
					</button>
				) : null}
				<button
					className="border border-line rounded-md mt-2 mr-1 px-1"
					title={folder.visible ? "Hide" : "Show"}
					aria-label={folder.visible ? `Hide ${kind}` : `Show ${kind}`}
					onClick={() => onUpdate({ visible: !folder.visible })}
				>
					<EyeIcon crossed={!folder.visible} />
				</button>
				<button
					className="border border-line rounded-md mt-2 mr-2 px-1"
					title={`Delete ${kind} (its events are kept)`}
					aria-label={`Delete ${kind}`}
					onClick={onDelete}
				>
					<TrashIcon />
				</button>
			</div>
			{open ? (
				// Dimmed while hidden, since nothing in here is on the map
				<div className={`pl-2 ${folder.visible ? "" : "opacity-50"}`}>
					{isEmpty ? (
						<div className="text-sm text-center opacity-70 my-2">
							Empty. Pick this {kind} on an event to move it here.
						</div>
					) : (
						children
					)}
				</div>
			) : (
				<div className="mb-2" />
			)}
		</div>
	);
}
