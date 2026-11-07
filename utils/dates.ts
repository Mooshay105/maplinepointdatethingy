/**
 * Parses "DD/MM/YYYY" (en-NZ format). Returns null if invalid.
 * @param input The date string to parse.
 * @returns The parsed date, or null if the input is invalid.
 */
export function parseNzDate(input: string): Date | null {
	const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim());
	if (!match) return null;

	const day = Number(match[1]);
	const month = Number(match[2]) - 1;
	const year = Number(match[3]);

	const d = new Date(year, month, day);
	if (d.getDate() !== day || d.getMonth() !== month) return null;
	return d;
}

/** Formats a date as "DD/MM/YYYY", the format parseNzDate reads. */
export function formatNzDate(date: Date): string {
	// Padded by hand, as en-NZ's toLocaleDateString gives "1/07/2026", which lines up badly in a list
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole calendar days from one date to another, ignoring the time of day and daylight saving. */
export function daysBetween(from: Date, to: Date): number {
	const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
	return Math.round((day(to) - day(from)) / DAY_MS);
}
