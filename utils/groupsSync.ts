import { Layer, MapGroup } from "./types";
import { createSync } from "./sync";

const groupSync = createSync<MapGroup>("/api/groups", "group");
const layerSync = createSync<Layer>("/api/layers", "layer");

/** Loads the signed-in user's groups and layers, or another user's when given their id (for the share page). */
export async function fetchGroups(
	userId?: string,
): Promise<{ groups: MapGroup[]; layers: Layer[] }> {
	const url = userId ? `/api/groups?userId=${encodeURIComponent(userId)}` : "/api/groups";
	const res = await fetch(url, { cache: "no-store" });
	if (!res.ok) throw new Error(`Failed to load groups: ${res.status}`);
	return res.json();
}

export const createGroup = groupSync.create;
export const updateGroup = groupSync.update;
/** Also deletes the group's layers, and moves its events out of it (the server does this too). */
export const deleteGroup = groupSync.remove;

export const createLayer = layerSync.create;
export const updateLayer = layerSync.update;
/** Its events stay in the layer's group (the server moves them too). */
export const deleteLayer = layerSync.remove;
