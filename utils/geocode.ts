import type { GeoLookupResult } from "./geoLookup";

/** Client-side wrapper for /api/geocode. Returns null when nothing matched or the lookup failed. */
export async function geocodeAddress(address: string): Promise<GeoLookupResult | null> {
	const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
	if (!res.ok) return null;
	return res.json();
}
