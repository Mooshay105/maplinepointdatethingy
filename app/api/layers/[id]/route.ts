import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
	db,
	ensureSchema,
	layerChangesSchema,
	layerColumns,
	parseId,
	updateOwnedRow,
} from "@/utils/db";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/layers/[id]">) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const id = parseId((await ctx.params).id);
	if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

	const parsed = layerChangesSchema.safeParse(await req.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.message }, { status: 400 });
	}

	await ensureSchema();
	if (!(await updateOwnedRow("layers", layerColumns, id, userId, parsed.data))) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	return NextResponse.json({ ok: true });
}

/** Deletes the layer. Its events are kept and stay in the layer's group. */
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/layers/[id]">) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const id = parseId((await ctx.params).id);
	if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

	await ensureSchema();
	await db.batch(
		[
			{
				sql: "UPDATE events SET layer_id = NULL WHERE layer_id = ? AND user_id = ?",
				args: [id, userId],
			},
			{ sql: "DELETE FROM layers WHERE id = ? AND user_id = ?", args: [id, userId] },
		],
		"write",
	);
	return NextResponse.json({ ok: true });
}
