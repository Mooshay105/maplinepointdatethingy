import { Layer, MapEvent, MapGroup } from "./types";

export type Placement = Pick<MapEvent, "groupId" | "layerId">;

export const UNGROUPED: Placement = { groupId: null, layerId: null };

/**
 * The group and layer an event sits in. Ids pointing at a deleted group or layer are ignored,
 * so the event falls back a level instead of disappearing from the list.
 */
export function placementOf(
	placement: Placement,
	groups: MapGroup[],
	layers: Layer[],
): { group: MapGroup | null; layer: Layer | null } {
	const layer = layers.find((l) => l.id === placement.layerId) ?? null;
	const groupId = layer ? layer.groupId : placement.groupId;
	const group = groups.find((g) => g.id === groupId) ?? null;
	if (!group) return { group: null, layer: null };
	return { group, layer };
}

/** Whether an event is drawn on the map: it, its group and its layer all have to be visible. */
export function isShownOnMap(event: MapEvent, groups: MapGroup[], layers: Layer[]) {
	const { group, layer } = placementOf(event, groups, layers);
	return event.visible && (group?.visible ?? true) && (layer?.visible ?? true);
}

/** Encodes a placement as a <select> value: "" for none, "g:<id>" for a group, "l:<id>" for a layer. */
export function placementValue(placement: Placement, groups: MapGroup[], layers: Layer[]) {
	const { group, layer } = placementOf(placement, groups, layers);
	if (layer) return `l:${layer.id}`;
	if (group) return `g:${group.id}`;
	return "";
}

/** Decodes placementValue(). An event in a layer also stores the layer's group. */
export function parsePlacementValue(value: string, layers: Layer[]): Placement {
	const [kind, rawId] = value.split(":");
	const id = Number(rawId);
	if (kind === "g") return { groupId: id, layerId: null };
	const layer = kind === "l" ? layers.find((l) => l.id === id) : undefined;
	if (layer) return { groupId: layer.groupId, layerId: layer.id };
	return UNGROUPED;
}
