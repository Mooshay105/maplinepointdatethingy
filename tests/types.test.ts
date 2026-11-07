import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	COLOR_LABELS,
	EVENT_COLORS,
	EVENT_ICONS,
	ICON_LABELS,
	PRESET_HEX,
	colorHex,
	editsLockedEvent,
	eventColorSchema,
	isPresetColor,
	readableOn,
} from "@/utils/types";

describe("icons and colours", () => {
	test("every icon has a label and an svg file", () => {
		for (const icon of EVENT_ICONS) {
			expect(ICON_LABELS[icon]).toBeTruthy();
			expect(existsSync(join(import.meta.dir, "..", "public", "icons", `${icon}.svg`))).toBe(true);
		}
	});

	test("every preset colour has a label and a hex code", () => {
		for (const color of EVENT_COLORS) {
			expect(COLOR_LABELS[color]).toBeTruthy();
			expect(PRESET_HEX[color]).toMatch(/^#[0-9a-f]{6}$/);
		}
	});
});

describe("eventColorSchema", () => {
	test("accepts preset names", () => {
		expect(eventColorSchema.parse("blue")).toBe("blue");
	});

	test("accepts hex codes and lowercases them", () => {
		expect(eventColorSchema.parse("#FF8800")).toBe("#ff8800");
	});

	test("rejects anything else", () => {
		for (const bad of ["pink", "#fff", "#gggggg", "ff8800", "#ff88001", 3]) {
			expect(eventColorSchema.safeParse(bad).success).toBe(false);
		}
	});
});

describe("colorHex", () => {
	test("maps presets to their hex code and lowercases custom ones", () => {
		expect(isPresetColor("red")).toBe(true);
		expect(isPresetColor("#123456")).toBe(false);
		expect(colorHex("red")).toBe(PRESET_HEX.red);
		expect(colorHex("#ABCDEF")).toBe("#abcdef");
	});
});

describe("readableOn", () => {
	test("white on dark discs, near-black on light ones", () => {
		expect(readableOn("#000000")).toBe("#ffffff");
		expect(readableOn(PRESET_HEX.blue)).toBe("#ffffff");
		expect(readableOn("#ffffff")).toBe("#0f0f0f");
		expect(readableOn(PRESET_HEX.yellow)).toBe("#0f0f0f");
		expect(readableOn(PRESET_HEX.white)).toBe("#0f0f0f");
	});
});

describe("editsLockedEvent", () => {
	test("unlocked events can be changed freely", () => {
		expect(editsLockedEvent({ locked: false }, { name: "x" })).toBe(false);
	});

	test("locked events refuse changes other than the lock and collapsed", () => {
		expect(editsLockedEvent({ locked: true }, { name: "x" })).toBe(true);
		expect(editsLockedEvent({ locked: true }, { collapsed: true, visible: false })).toBe(true);
		expect(editsLockedEvent({ locked: true }, { collapsed: true })).toBe(false);
		expect(editsLockedEvent({ locked: true }, { locked: false })).toBe(false);
		expect(editsLockedEvent({ locked: true }, {})).toBe(false);
	});
});
