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
	return date.toLocaleDateString("en-NZ");
}
