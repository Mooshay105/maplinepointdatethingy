import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { layers, mapGroups } from "@/db/schema";
import { db, groupFields, groupSchema, layerFields } from "@/utils/db";

/**
 * Lists the signed-in user's groups and layers, or any user's with ?userId=... (used by the share page).
 * Public for the same reason as GET /api/events.
 */
export async function GET(req: NextRequest) {
	const ownerId = req.nextUrl.searchParams.get("userId") || (await auth()).userId;
	if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const [groups, groupLayers] = await db.batch([
		db
			.select(groupFields)
			.from(mapGroups)
			.where(eq(mapGroups.userId, ownerId))
			.orderBy(mapGroups.created),
		db.select(layerFields).from(layers).where(eq(layers.userId, ownerId)).orderBy(layers.created),
	]);
	return NextResponse.json({ groups, layers: groupLayers });
}

/** Creates a group. An id that already exists is skipped, so retries are safe. */
export async function POST(req: Request) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const parsed = groupSchema.safeParse(await req.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.message }, { status: 400 });
	}

	await db
		.insert(mapGroups)
		.values({ ...parsed.data, userId, created: Date.now() })
		.onConflictDoNothing();
	return NextResponse.json({ ok: true }, { status: 201 });
}
