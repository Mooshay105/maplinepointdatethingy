import { describe, expect, test } from "bun:test";
import { getTableColumns } from "drizzle-orm";
import { events } from "@/db/schema";
import {
	eventChangesSchema,
	eventFields,
	eventSchema,
	groupChangesSchema,
	layerSchema,
	parseId,
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
		const tableColumns = getTableColumns(events);
		for (const key of Object.keys(eventChangesSchema.shape)) {
			expect(tableColumns[key as keyof typeof tableColumns]).toBeTruthy();
		}
	});

	test("the browser gets every wire field and not the owner", () => {
		expect(Object.keys(eventFields).sort()).toEqual(Object.keys(eventSchema.shape).sort());
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
