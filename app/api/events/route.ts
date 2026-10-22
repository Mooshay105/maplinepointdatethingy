import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";
import { db, ensureSchema, eventSchema, rowToEvent } from "@/utils/db";

/**
 * Lists the signed-in user's events, or any user's with ?userId=... (used by the share page).
 * Shared maps are public on purpose: anyone with the link can view them without signing in,
 * so the user id in the link is the only thing keeping a map private. Only reading is public;
 * creating, editing and deleting still need you to be signed in as the owner.
 */
export async function GET(req: NextRequest) {
	const ownerId = req.nextUrl.searchParams.get("userId") || (await auth()).userId;
	if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	await ensureSchema();
	const rs = await db.execute({
		sql: "SELECT * FROM events WHERE user_id = ? ORDER BY date",
		args: [ownerId],
	});
	return NextResponse.json(rs.rows.map(rowToEvent));
}

/** Creates one event, or several when given an array. Ids that already exist are skipped, so retries are safe. */
export async function POST(req: Request) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const parsed = z.union([eventSchema, z.array(eventSchema)]).safeParse(await req.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.message }, { status: 400 });
	}
	const events = Array.isArray(parsed.data) ? parsed.data : [parsed.data];

	await ensureSchema();
	await db.batch(
		events.map((e) => ({
			sql: `INSERT OR IGNORE INTO events (id, user_id, name, description, address, lat, lng, date, icon, icon_color, visible)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				e.id,
				userId,
				e.name,
				e.description,
				e.address,
				e.lat,
				e.lng,
				e.date,
				e.icon,
				e.iconColor,
				e.visible ? 1 : 0,
			],
		})),
		"write",
	);
	return NextResponse.json({ ok: true }, { status: 201 });
}
