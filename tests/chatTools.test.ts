import { describe, expect, test } from "bun:test";
import { addEventInput, editEventInput, setLockedInput } from "@/utils/chatTools";

describe("chat tool inputs", () => {
	test("addEvent needs a name, date and coordinates", () => {
		expect(addEventInput.safeParse({ name: "x" }).success).toBe(false);
		expect(
			addEventInput.safeParse({ name: "x", date: "01/01/2025", latitude: 1, longitude: 2 }).success,
		).toBe(true);
	});

	test("addEvent validates icon and colour", () => {
		const base = { name: "x", date: "01/01/2025", latitude: 1, longitude: 2 };
		expect(addEventInput.safeParse({ ...base, icon: "nope" }).success).toBe(false);
		expect(addEventInput.parse({ ...base, iconColor: "#ABCDEF" }).iconColor).toBe("#abcdef");
	});

	test("editEvent can move events out of groups and layers with null", () => {
		expect(editEventInput.parse({ id: 1, groupId: null, layerId: null })).toEqual({
			id: 1,
			groupId: null,
			layerId: null,
		});
	});

	test("setLocked needs both fields", () => {
		expect(setLockedInput.safeParse({ eventIds: [1] }).success).toBe(false);
		expect(setLockedInput.safeParse({ eventIds: [1], locked: true }).success).toBe(true);
	});
});
