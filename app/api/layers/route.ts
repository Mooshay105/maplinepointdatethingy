import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { layers } from "@/db/schema";
import { db, layerSchema } from "@/utils/db";

/** Creates a layer. An id that already exists is skipped, so retries are safe. Layers are listed by GET /api/groups. */
export async function POST(req: Request) {
	const { userId } = await auth();
	if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const parsed = layerSchema.safeParse(await req.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.message }, { status: 400 });
	}

	await db
		.insert(layers)
		.values({ ...parsed.data, userId, created: Date.now() })
		.onConflictDoNothing();
	return NextResponse.json({ ok: true }, { status: 201 });
}
