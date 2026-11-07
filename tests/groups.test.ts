import { describe, expect, test } from "bun:test";
import {
	UNGROUPED,
	isShownOnMap,
	parsePlacementValue,
	placementOf,
	placementValue,
} from "@/utils/groups";
import type { Layer, MapEvent, MapGroup } from "@/utils/types";

const groups: MapGroup[] = [
	{ id: 1, name: "Europe", visible: true, collapsed: false },
	{ id: 2, name: "Hidden", visible: false, collapsed: false },
];
const layers: Layer[] = [
	{ id: 10, groupId: 1, name: "Paris", visible: true, collapsed: false },
	{ id: 11, groupId: 1, name: "Hidden layer", visible: false, collapsed: false },
	{ id: 20, groupId: 2, name: "In hidden group", visible: true, collapsed: false },
];

function event(overrides: Partial<MapEvent> = {}): MapEvent {
	return {
		id: 100,
		name: "Meet",
		description: "",
		address: "",
		lat: 0,
		lng: 0,
		date: new Date(2025, 0, 1),
		icon: "road-running",
		iconColor: "red",
		visible: true,
		groupId: null,
		layerId: null,
		travelNote: "",
		collapsed: false,
		locked: false,
		...overrides,
	};
}

describe("placementOf", () => {
	test("ungrouped", () => {
		expect(placementOf(UNGROUPED, groups, layers)).toEqual({ group: null, layer: null });
	});

	test("directly in a group", () => {
		expect(placementOf({ groupId: 1, layerId: null }, groups, layers)).toEqual({
			group: groups[0],
			layer: null,
		});
	});

	test("in a layer, the layer's group wins over a stale groupId", () => {
		expect(placementOf({ groupId: 2, layerId: 10 }, groups, layers)).toEqual({
			group: groups[0],
			layer: layers[0],
		});
	});

	test("a deleted layer falls back to the group", () => {
		expect(placementOf({ groupId: 1, layerId: 999 }, groups, layers)).toEqual({
			group: groups[0],
			layer: null,
		});
	});

	test("a deleted group falls back to ungrouped", () => {
		expect(placementOf({ groupId: 999, layerId: null }, groups, layers)).toEqual({
			group: null,
			layer: null,
		});
	});

	test("a layer whose group is gone falls back to ungrouped", () => {
		const orphan: Layer = { id: 30, groupId: 999, name: "x", visible: true, collapsed: false };
		expect(placementOf({ groupId: 999, layerId: 30 }, groups, [orphan])).toEqual({
			group: null,
			layer: null,
		});
	});
});

describe("isShownOnMap", () => {
	test("visible ungrouped event", () => {
		expect(isShownOnMap(event(), groups, layers)).toBe(true);
	});

	test("hidden event", () => {
		expect(isShownOnMap(event({ visible: false }), groups, layers)).toBe(false);
	});

	test("hidden group hides its events and layers", () => {
		expect(isShownOnMap(event({ groupId: 2 }), groups, layers)).toBe(false);
		expect(isShownOnMap(event({ groupId: 2, layerId: 20 }), groups, layers)).toBe(false);
	});

	test("hidden layer hides its events", () => {
		expect(isShownOnMap(event({ groupId: 1, layerId: 11 }), groups, layers)).toBe(false);
		expect(isShownOnMap(event({ groupId: 1, layerId: 10 }), groups, layers)).toBe(true);
	});

	test("events in a deleted hidden group are shown", () => {
		expect(isShownOnMap(event({ groupId: 999 }), groups, layers)).toBe(true);
	});
});

describe("placementValue / parsePlacementValue", () => {
	test("encodes each kind of placement", () => {
		expect(placementValue(UNGROUPED, groups, layers)).toBe("");
		expect(placementValue({ groupId: 1, layerId: null }, groups, layers)).toBe("g:1");
		expect(placementValue({ groupId: 1, layerId: 10 }, groups, layers)).toBe("l:10");
	});

	test("decodes, filling in a layer's group", () => {
		expect(parsePlacementValue("", layers)).toEqual(UNGROUPED);
		expect(parsePlacementValue("g:2", layers)).toEqual({ groupId: 2, layerId: null });
		expect(parsePlacementValue("l:20", layers)).toEqual({ groupId: 2, layerId: 20 });
	});

	test("an unknown layer decodes to ungrouped", () => {
		expect(parsePlacementValue("l:999", layers)).toEqual(UNGROUPED);
	});

	test("round-trips", () => {
		for (const p of [UNGROUPED, { groupId: 1, layerId: null }, { groupId: 1, layerId: 11 }]) {
			expect(parsePlacementValue(placementValue(p, groups, layers), layers)).toEqual(p);
		}
	});
});
