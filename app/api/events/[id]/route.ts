import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { columns, db, ensureSchema, eventChangesSchema, parseId, updateOwnedRow } from "@/utils/db";
import { LOCK_EXEMPT_FIELDS } from "@/utils/types";

function lockedResponse() {
	return NextResponse.json({ error: "The event is locked. Unlock it first." }, { status: 409 });
}

/** Whether the user has an event with this id at all, to tell "locked" apart from "not found". */
async function eventExists(id: number, userId: string) {
	const rs = await db.execute({
		sql: "SELECT 1 FROM events WHERE id = ? AND user_id = ?",
		args: [id, userId],
	});
	return rs.rows.length > 0;
}

/**
 * Changes some of an event's fields. A locked event only takes changes to its lock or to whether
 * it's collapsed in the sidebar; anything else is refused, unless the same request unlocks it.
 */
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
	const unlocking = parsed.data.locked === false;
	const onlyExempt = Object.keys(parsed.data).every((key) => LOCK_EXEMPT_FIELDS.includes(key));
	// Checked in the same statement, so a lock can't land between a check and the update
	const updated = await updateOwnedRow(
		"events",
		columns,
		id,
		userId,
		parsed.data,
		unlocking || onlyExempt ? undefined : "locked = 0",
	);
	if (!updated) {
		return (await eventExists(id, userId))
			? lockedResponse()
			: NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	return NextResponse.json({ ok: true });
}

/** Deletes an event, unless it's locked. */
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/events/[id]">) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const id = parseId((await ctx.params).id);
	if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

	await ensureSchema();
	const rs = await db.execute({
		sql: "DELETE FROM events WHERE id = ? AND user_id = ? AND locked = 0",
		args: [id, userId],
	});
	if (rs.rowsAffected === 0 && (await eventExists(id, userId))) return lockedResponse();
	return NextResponse.json({ ok: true });
}
