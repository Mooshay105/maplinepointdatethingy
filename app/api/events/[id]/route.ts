import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { columns, db, ensureSchema, EventChanges, eventChangesSchema } from "@/utils/db";

async function parseId(ctx: RouteContext<"/api/events/[id]">) {
	const id = Number((await ctx.params).id);
	return Number.isSafeInteger(id) ? id : null;
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/events/[id]">) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const id = await parseId(ctx);
	if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

	const parsed = eventChangesSchema.safeParse(await req.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.message }, { status: 400 });
	}

	const entries = Object.entries(parsed.data) as [keyof EventChanges, unknown][];
	if (entries.length === 0) return NextResponse.json({ ok: true });

	await ensureSchema();
	const rs = await db.execute({
		sql: `UPDATE events SET ${entries.map(([k]) => `${columns[k]} = ?`).join(", ")}
			WHERE id = ? AND user_id = ?`,
		args: [
			...entries.map(([, v]) => (typeof v === "boolean" ? (v ? 1 : 0) : (v as string | number))),
			id,
			userId,
		],
	});
	if (rs.rowsAffected === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
	return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/events/[id]">) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const id = await parseId(ctx);
	if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

	await ensureSchema();
	await db.execute({
		sql: "DELETE FROM events WHERE id = ? AND user_id = ?",
		args: [id, userId],
	});
	return NextResponse.json({ ok: true });
}
