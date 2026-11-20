import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { events } from "@/db/schema";
import { db, eventChangesSchema, ownedRow, parseId } from "@/utils/db";
import { LOCK_EXEMPT_FIELDS } from "@/utils/types";

function lockedResponse() {
	return NextResponse.json({ error: "The event is locked. Unlock it first." }, { status: 409 });
}

async function eventExists(id: number, userId: string) {
	const rows = await db
		.select({ id: events.id })
		.from(events)
		.where(ownedRow(events, id, userId));
	return rows.length > 0;
}

/**
 * Changes some of an event's fields. A locked event only takes changes to its lock or to whether
 * it's collapsed in the sidebar; anything else is refused, unless the same request unlocks it.
 * The lock is checked in the same statement as the update, so a lock can't land between the two.
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
	if (Object.keys(parsed.data).length === 0) return NextResponse.json({ ok: true });

	const unlocking = parsed.data.locked === false;
	const onlyExempt = Object.keys(parsed.data).every((key) => LOCK_EXEMPT_FIELDS.includes(key));
	const result = await db
		.update(events)
		.set(parsed.data)
		.where(
			and(
				ownedRow(events, id, userId),
				unlocking || onlyExempt ? undefined : eq(events.locked, false),
			),
		);
	if (result.rowsAffected === 0) {
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

	const result = await db
		.delete(events)
		.where(and(ownedRow(events, id, userId), eq(events.locked, false)));
	if (result.rowsAffected === 0 && (await eventExists(id, userId))) return lockedResponse();
	return NextResponse.json({ ok: true });
}
