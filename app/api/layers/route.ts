import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db, ensureSchema, layerSchema } from "@/utils/db";

// Layers are listed along with their groups by GET /api/groups

/** Creates a layer. An id that already exists is skipped, so retries are safe. */
export async function POST(req: Request) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const parsed = layerSchema.safeParse(await req.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.message }, { status: 400 });
	}
	const l = parsed.data;

	await ensureSchema();
	await db.execute({
		sql: `INSERT OR IGNORE INTO layers (id, user_id, group_id, name, visible, created)
			VALUES (?, ?, ?, ?, ?, ?)`,
		args: [l.id, userId, l.groupId, l.name, l.visible ? 1 : 0, Date.now()],
	});
	return NextResponse.json({ ok: true }, { status: 201 });
}
