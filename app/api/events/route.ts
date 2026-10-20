import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import z from "zod";
import { db, ensureSchema, eventSchema, rowToEvent } from "@/utils/db";

export async function GET(req: Request) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	await ensureSchema();
	const rs = await db.execute({
		sql: "SELECT * FROM events WHERE user_id = ? ORDER BY date",
		args: [req.headers.get("searchingUserId")! || userId],
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
			sql: `INSERT OR IGNORE INTO events (id, user_id, name, lat, lng, date, icon, icon_color, visable)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				e.id,
				userId,
				e.name,
				e.lat,
				e.lng,
				e.date,
				e.icon,
				e.iconColor,
				e.visable ? 1 : 0,
			],
		})),
		"write",
	);
	return NextResponse.json({ ok: true }, { status: 201 });
}
