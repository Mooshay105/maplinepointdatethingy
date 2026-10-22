import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema, groupSchema, rowToGroup, rowToLayer } from "@/utils/db";

/**
 * Lists the signed-in user's groups and layers, or any user's with ?userId=... (used by the share page).
 * Public for the same reason as GET /api/events.
 */
export async function GET(req: NextRequest) {
	const ownerId = req.nextUrl.searchParams.get("userId") || (await auth()).userId;
	if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	await ensureSchema();
	const [groups, layers] = await db.batch(
		[
			{ sql: "SELECT * FROM map_groups WHERE user_id = ? ORDER BY created", args: [ownerId] },
			{ sql: "SELECT * FROM layers WHERE user_id = ? ORDER BY created", args: [ownerId] },
		],
		"read",
	);
	return NextResponse.json({
		groups: groups.rows.map(rowToGroup),
		layers: layers.rows.map(rowToLayer),
	});
}

/** Creates a group. An id that already exists is skipped, so retries are safe. */
export async function POST(req: Request) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const parsed = groupSchema.safeParse(await req.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.message }, { status: 400 });
	}
	const g = parsed.data;

	await ensureSchema();
	await db.execute({
		sql: `INSERT OR IGNORE INTO map_groups (id, user_id, name, visible, created)
			VALUES (?, ?, ?, ?, ?)`,
		args: [g.id, userId, g.name, g.visible ? 1 : 0, Date.now()],
	});
	return NextResponse.json({ ok: true }, { status: 201 });
}
