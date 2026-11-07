import { afterEach, describe, expect, test } from "bun:test";
import { geoLookup } from "@/utils/geoLookup";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

/** Replaces fetch with one that answers each call from `responses` in turn, and records the URLs. */
function fakeFetch(responses: unknown[][], status = 200) {
	const urls: URL[] = [];
	globalThis.fetch = (async (input: URL) => {
		urls.push(new URL(input));
		return new Response(JSON.stringify(responses.shift() ?? []), { status });
	}) as typeof fetch;
	return urls;
}

const place = { lat: "-36.85", lon: "174.76", display_name: "Auckland", type: "city" };

describe("geoLookup", () => {
	test("free-form search when only a raw address is given", async () => {
		const urls = fakeFetch([[place]]);
		expect(await geoLookup({ rawAddress: "Auckland" })).toEqual([
			{ latitude: -36.85, longitude: 174.76, displayName: "Auckland", type: "city" },
		]);
		expect(urls).toHaveLength(1);
		expect(urls[0].searchParams.get("q")).toBe("Auckland");
		expect(urls[0].searchParams.get("format")).toBe("jsonv2");
	});

	test("tries a structured search first, then falls back to the raw address", async () => {
		const urls = fakeFetch([[], [place]]);
		const results = await geoLookup({
			rawAddress: "1 Queen St, Auckland",
			streetNumber: "1",
			streetName: "Queen",
			streetType: "St",
			city: "Auckland",
			country: "NZ",
		});
		expect(results).toHaveLength(1);
		expect(urls).toHaveLength(2);
		expect(urls[0].searchParams.get("street")).toBe("1 Queen St");
		expect(urls[0].searchParams.get("city")).toBe("Auckland");
		expect(urls[0].searchParams.get("q")).toBeNull();
		expect(urls[1].searchParams.get("q")).toBe("1 Queen St, Auckland");
	}, 10_000);

	test("throws when Nominatim errors", async () => {
		fakeFetch([], 503);
		await expect(geoLookup({ rawAddress: "x" })).rejects.toThrow("503");
	}, 10_000);
});
