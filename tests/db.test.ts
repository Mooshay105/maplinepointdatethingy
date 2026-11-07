import { describe, expect, test } from "bun:test";
import type { Row } from "@libsql/client";
import {
	columns,
	eventChangesSchema,
	eventSchema,
	groupChangesSchema,
	layerSchema,
	parseId,
	rowToEvent,
	rowToLayer,
} from "@/utils/db";

const wireEvent = {
	id: 1,
	name: "Meet",
	description: "",
	address: "",
	lat: -36.8,
	lng: 174.7,
	date: 1_700_000_000_000,
	icon: "road-running",
	iconColor: "red",
	visible: true,
	groupId: null,
	layerId: null,
	travelNote: "",
	collapsed: false,
};

describe("parseId", () => {
	test("reads integer ids and rejects the rest", () => {
		expect(parseId("42")).toBe(42);
		expect(parseId("abc")).toBeNull();
		expect(parseId("1.5")).toBeNull();
		expect(parseId("9007199254740993")).toBeNull();
	});
});

describe("eventSchema", () => {
	test("accepts a full event and defaults locked to false", () => {
		expect(eventSchema.parse(wireEvent).locked).toBe(false);
	});

	test("rejects bad ids, icons and colours", () => {
		for (const bad of [{ id: 0 }, { id: -1 }, { id: 1.5 }, { icon: "nope" }, { iconColor: "pink" }]) {
			expect(eventSchema.safeParse({ ...wireEvent, ...bad }).success).toBe(false);
		}
	});
});

describe("eventChangesSchema", () => {
	test("leaving out locked doesn't unlock", () => {
		expect(eventChangesSchema.parse({ name: "x" })).toEqual({ name: "x" });
	});

	test("does not accept an id", () => {
		expect(eventChangesSchema.parse({ id: 5, name: "x" })).toEqual({ name: "x" });
	});

	test("every field has a column", () => {
		for (const key of Object.keys(eventChangesSchema.shape)) {
			expect(columns[key as keyof typeof columns]).toBeTruthy();
		}
	});
});

describe("group and layer schemas", () => {
	test("layers need a group", () => {
		expect(layerSchema.safeParse({ id: 1, name: "x", visible: true, collapsed: false }).success).toBe(
			false,
		);
	});

	test("group changes are partial", () => {
		expect(groupChangesSchema.parse({ visible: false })).toEqual({ visible: false });
	});
});

describe("row mapping", () => {
	test("rowToEvent converts sqlite values", () => {
		const row = {
			id: 1,
			name: "Meet",
			description: null,
			address: null,
			lat: 1,
			lng: 2,
			date: 3,
			icon: "dna",
			icon_color: "#abcdef",
			visible: 0,
			group_id: 7,
			layer_id: null,
			travel_note: null,
			collapsed: 1,
			locked: 1,
		} as unknown as Row;
		expect(rowToEvent(row)).toEqual({
			id: 1,
			name: "Meet",
			description: "",
			address: "",
			lat: 1,
			lng: 2,
			date: 3,
			icon: "dna",
			iconColor: "#abcdef",
			visible: false,
			groupId: 7,
			layerId: null,
			travelNote: "",
			collapsed: true,
			locked: true,
		});
	});

	test("rowToLayer includes the group id", () => {
		const row = { id: 2, name: "L", visible: 1, collapsed: 0, group_id: 9 } as unknown as Row;
		expect(rowToLayer(row)).toEqual({ id: 2, name: "L", visible: true, collapsed: false, groupId: 9 });
	});
});
