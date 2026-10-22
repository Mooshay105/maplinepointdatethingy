import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { columns, db, ensureSchema, eventChangesSchema, parseId, updateOwnedRow } from "@/utils/db";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/events/[id]">) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const id = parseId((await ctx.params).id);
	if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

	const parsed = eventChangesSchema.safeParse(await req.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.message }, { status: 400 });
	}

	await ensureSchema();
	if (!(await updateOwnedRow("events", columns, id, userId, parsed.data))) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/events/[id]">) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const id = parseId((await ctx.params).id);
	if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

	await ensureSchema();
	await db.execute({
		sql: "DELETE FROM events WHERE id = ? AND user_id = ?",
		args: [id, userId],
	});
	return NextResponse.json({ ok: true });
}
