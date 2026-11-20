import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { events, layers, mapGroups } from "@/db/schema";
import { db, groupChangesSchema, ownedRow, parseId } from "@/utils/db";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/groups/[id]">) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const id = parseId((await ctx.params).id);
	if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

	const parsed = groupChangesSchema.safeParse(await req.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.message }, { status: 400 });
	}
	if (Object.keys(parsed.data).length === 0) return NextResponse.json({ ok: true });

	const result = await db.update(mapGroups).set(parsed.data).where(ownedRow(mapGroups, id, userId));
	if (result.rowsAffected === 0) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	return NextResponse.json({ ok: true });
}

/**
 * Deletes the group and its layers. Their events are kept and moved out of the group, apart from
 * locked ones: those keep pointing at the deleted group, which the app shows as being in no group.
 */
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/groups/[id]">) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const id = parseId((await ctx.params).id);
	if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

	await db.batch([
		db
			.update(events)
			.set({ groupId: null, layerId: null })
			.where(and(eq(events.groupId, id), eq(events.userId, userId), eq(events.locked, false))),
		db.delete(layers).where(and(eq(layers.groupId, id), eq(layers.userId, userId))),
		db.delete(mapGroups).where(ownedRow(mapGroups, id, userId)),
	]);
	return NextResponse.json({ ok: true });
}
