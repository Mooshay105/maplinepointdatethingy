import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { geoLookup } from "@/utils/geoLookup";

/** Looks up ?address=... and returns the best match. Signed-in only, to protect the shared Nominatim rate limit. */
export async function GET(req: NextRequest) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const address = req.nextUrl.searchParams.get("address")?.trim();
	if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

	try {
		const [best] = await geoLookup({ rawAddress: address });
		if (!best) return NextResponse.json({ error: "No location found" }, { status: 404 });
		return NextResponse.json(best);
	} catch (err) {
		console.error("Geocode failed:", err);
		return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
	}
}
