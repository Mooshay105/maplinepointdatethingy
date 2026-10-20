// Geocoding via OpenStreetMap Nominatim. Server-only: the usage policy requires an
// identifying User-Agent (browsers can't set one) and at most 1 request per second.
// https://operations.osmfoundation.org/policies/nominatim/

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Set NOMINATIM_USER_AGENT to include contact info (URL or email), as the policy asks
const USER_AGENT = process.env.NOMINATIM_USER_AGENT || "maplinepointdatethingy/0.1";
const MIN_INTERVAL_MS = 1100;

export type GeoLookupInput = {
	rawAddress: string;
	streetNumber?: string;
	streetName?: string;
	streetType?: string;
	suburb?: string;
	city?: string;
	state?: string;
	postcode?: string;
	country?: string;
};

export type GeoLookupResult = {
	latitude: number;
	longitude: number;
	displayName: string;
	type: string;
};

type NominatimPlace = {
	lat: string;
	lon: string;
	display_name: string;
	type: string;
};

// Serialise requests so concurrent tool calls in this process respect the rate limit
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
	const run = queue.then(async () => {
		const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
		if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
		lastRequestAt = Date.now();
		return fn();
	});
	queue = run.catch(() => {});
	return run;
}

async function search(params: Record<string, string>): Promise<GeoLookupResult[]> {
	const url = new URL(NOMINATIM_URL);
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	url.searchParams.set("format", "jsonv2");
	url.searchParams.set("limit", "3");

	const res = await throttled(() =>
		fetch(url, {
			headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
			signal: AbortSignal.timeout(10_000),
		}),
	);
	if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);

	const places = (await res.json()) as NominatimPlace[];
	return places.map((p) => ({
		latitude: Number(p.lat),
		longitude: Number(p.lon),
		displayName: p.display_name,
		type: p.type,
	}));
}

export async function geoLookup(input: GeoLookupInput): Promise<GeoLookupResult[]> {
	// Nominatim doesn't allow mixing free-form `q` with structured params, so try the
	// structured search first when we have parts, then fall back to the raw address
	const street = [input.streetNumber, input.streetName, input.streetType]
		.filter(Boolean)
		.join(" ");
	const structured: Record<string, string> = {};
	if (street) structured.street = street;
	if (input.suburb || input.city) structured.city = input.suburb || input.city!;
	if (input.state) structured.state = input.state;
	if (input.postcode) structured.postalcode = input.postcode;
	if (input.country) structured.country = input.country;

	if (Object.keys(structured).length > 0) {
		const results = await search(structured);
		if (results.length > 0) return results;
	}
	return search({ q: input.rawAddress });
}
