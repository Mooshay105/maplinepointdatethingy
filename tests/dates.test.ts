import { describe, expect, test } from "bun:test";
import { daysBetween, formatNzDate, parseNzDate } from "@/utils/dates";

describe("parseNzDate", () => {
	test("reads DD/MM/YYYY as day first", () => {
		const d = parseNzDate("03/04/2025");
		expect(d?.getFullYear()).toBe(2025);
		expect(d?.getMonth()).toBe(3); // April
		expect(d?.getDate()).toBe(3);
	});

	test("accepts single-digit parts and surrounding whitespace", () => {
		const d = parseNzDate("  1/2/2024 ");
		expect(d?.getMonth()).toBe(1);
		expect(d?.getDate()).toBe(1);
	});

	test("rejects dates that don't exist", () => {
		expect(parseNzDate("31/02/2025")).toBeNull();
		expect(parseNzDate("29/02/2023")).toBeNull();
		expect(parseNzDate("00/01/2025")).toBeNull();
		expect(parseNzDate("01/13/2025")).toBeNull();
	});

	test("accepts 29 February in a leap year", () => {
		expect(parseNzDate("29/02/2024")?.getDate()).toBe(29);
	});

	test("rejects other formats", () => {
		for (const input of ["2025-04-03", "3/4/25", "03-04-2025", "", "abc", "03/04/2025x"]) {
			expect(parseNzDate(input)).toBeNull();
		}
	});
});

describe("formatNzDate", () => {
	test("round-trips through parseNzDate", () => {
		const date = new Date(2025, 11, 25);
		expect(parseNzDate(formatNzDate(date))?.getTime()).toBe(date.getTime());
	});

	test("pads the day and month to two digits", () => {
		expect(formatNzDate(new Date(2026, 6, 1))).toBe("01/07/2026");
	});
});

describe("daysBetween", () => {
	test("counts whole calendar days, ignoring the time of day", () => {
		expect(daysBetween(new Date(2025, 0, 1, 23, 59), new Date(2025, 0, 2, 0, 1))).toBe(1);
		expect(daysBetween(new Date(2025, 0, 1), new Date(2025, 0, 1, 18))).toBe(0);
	});

	test("is negative going backwards", () => {
		expect(daysBetween(new Date(2025, 0, 10), new Date(2025, 0, 3))).toBe(-7);
	});

	test("spans months, leap days and daylight saving changes", () => {
		expect(daysBetween(new Date(2024, 1, 28), new Date(2024, 2, 1))).toBe(2);
		expect(daysBetween(new Date(2025, 0, 1), new Date(2026, 0, 1))).toBe(365);
		// NZ and EU daylight saving both change somewhere in March/April and September/October
		expect(daysBetween(new Date(2025, 2, 1), new Date(2025, 4, 1))).toBe(61);
		expect(daysBetween(new Date(2025, 8, 1), new Date(2025, 10, 1))).toBe(61);
	});
});
