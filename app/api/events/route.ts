import { auth } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";
import { events } from "@/db/schema";
import { db, eventFields, eventSchema } from "@/utils/db";

/**
 * Lists the signed-in user's events, or any user's with ?userId=... (used by the share page).
 * Shared maps are public on purpose: anyone with the link can view them without signing in,
 * so the user id in the link is the only thing keeping a map private. Only reading is public;
 * creating, editing and deleting still need you to be signed in as the owner.
 * Undated events come after the dated ones.
 */
export async function GET(req: NextRequest) {
	const ownerId = req.nextUrl.searchParams.get("userId") || (await auth()).userId;
	if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const rows = await db
		.select(eventFields)
		.from(events)
		.where(eq(events.userId, ownerId))
		.orderBy(sql`${events.date} is null`, events.date);
	return NextResponse.json(rows);
}

/** Creates one event, or several when given an array. Ids that already exist are skipped, so retries are safe. */
export async function POST(req: Request) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const parsed = z.union([eventSchema, z.array(eventSchema)]).safeParse(await req.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.message }, { status: 400 });
	}
	const created = Array.isArray(parsed.data) ? parsed.data : [parsed.data];

	const [first, ...rest] = created.map((event) =>
		db
			.insert(events)
			.values({ ...event, userId })
			.onConflictDoNothing(),
	);
	if (first) await db.batch([first, ...rest]);
	return NextResponse.json({ ok: true }, { status: 201 });
}
