import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { events, layers } from "@/db/schema";
import { db, layerChangesSchema, ownedRow, parseId } from "@/utils/db";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/layers/[id]">) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const id = parseId((await ctx.params).id);
	if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

	const parsed = layerChangesSchema.safeParse(await req.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.message }, { status: 400 });
	}
	if (Object.keys(parsed.data).length === 0) return NextResponse.json({ ok: true });

	const result = await db.update(layers).set(parsed.data).where(ownedRow(layers, id, userId));
	if (result.rowsAffected === 0) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	return NextResponse.json({ ok: true });
}

/**
 * Deletes the layer. Its events are kept and stay in the layer's group. Locked events keep pointing
 * at the deleted layer, which the app shows as being straight in the group.
 */
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/layers/[id]">) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const id = parseId((await ctx.params).id);
	if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

	await db.batch([
		db
			.update(events)
			.set({ layerId: null })
			.where(and(eq(events.layerId, id), eq(events.userId, userId), eq(events.locked, false))),
		db.delete(layers).where(ownedRow(layers, id, userId)),
	]);
	return NextResponse.json({ ok: true });
}
