import { beforeEach, describe, expect, test } from "bun:test";
import * as events from "@/app/api/events/route";
import * as event from "@/app/api/events/[id]/route";
import { params, request, signInAsNewUser, signOut, wireEvent } from "./helpers";

type Ctx = Parameters<typeof event.PATCH>[1];
const ctx = (id: string | number) => params(id) as unknown as Ctx;

async function list(userId?: string) {
	const res = await events.GET(request(userId ? `/api/events?userId=${userId}` : "/api/events"));
	expect(res.status).toBe(200);
	return (await res.json()) as ReturnType<typeof wireEvent>[] & { locked: boolean }[];
}

async function create(body: unknown) {
	return events.POST(request("/api/events", "POST", body));
}

beforeEach(() => {
	signInAsNewUser();
});

describe("auth", () => {
	test("signed-out users can't list their own events or write", async () => {
		signOut();
		expect((await events.GET(request("/api/events"))).status).toBe(401);
		expect((await create(wireEvent(1))).status).toBe(401);
		expect((await event.PATCH(request("/api/events/1", "PATCH", {}), ctx(1))).status).toBe(401);
		expect((await event.DELETE(request("/api/events/1", "DELETE"), ctx(1))).status).toBe(401);
	});

	test("anyone can read a shared map by user id", async () => {
		const owner = signInAsNewUser();
		await create(wireEvent(1001));
		signOut();
		expect((await list(owner)).map((e) => e.id)).toEqual([1001]);
	});
});

describe("POST /api/events", () => {
	test("creates one event or a batch, ordered by date", async () => {
		expect((await create(wireEvent(2002))).status).toBe(201);
		expect((await create([wireEvent(2001), wireEvent(2003)])).status).toBe(201);
		const listed = await list();
		expect(listed.map((e) => e.id)).toEqual([2001, 2002, 2003]);
		expect(listed[0]).toEqual({ ...wireEvent(2001), locked: false });
	});

	test("repeating a create is a no-op", async () => {
		await create(wireEvent(3001, { name: "first" }));
		await create(wireEvent(3001, { name: "second" }));
		const listed = await list();
		expect(listed).toHaveLength(1);
		expect(listed[0].name).toBe("first");
	});

	test("rejects invalid events", async () => {
		expect((await create(wireEvent(3002, { icon: "nope" }))).status).toBe(400);
		expect((await create({ id: 3003 })).status).toBe(400);
		expect(await list()).toHaveLength(0);
	});

	test("users only see their own events", async () => {
		await create(wireEvent(3004));
		signInAsNewUser();
		expect(await list()).toHaveLength(0);
	});
});

describe("PATCH /api/events/[id]", () => {
	test("updates fields", async () => {
		await create(wireEvent(4001));
		const res = await event.PATCH(
			request("/api/events/4001", "PATCH", { name: "Renamed", visible: false, groupId: 5 }),
			ctx(4001),
		);
		expect(res.status).toBe(200);
		const [e] = await list();
		expect(e).toMatchObject({ name: "Renamed", visible: false, groupId: 5 });
	});

	test("404 for another user's or a missing event, 400 for bad input", async () => {
		await create(wireEvent(4002));
		expect(
			(await event.PATCH(request("/api/events/x", "PATCH", {}), ctx("x"))).status,
		).toBe(400);
		expect(
			(await event.PATCH(request("/api/events/4002", "PATCH", { icon: "nope" }), ctx(4002))).status,
		).toBe(400);
		signInAsNewUser();
		expect(
			(await event.PATCH(request("/api/events/4002", "PATCH", { name: "x" }), ctx(4002))).status,
		).toBe(404);
	});

	test("a locked event refuses edits and deletes, but can be collapsed and unlocked", async () => {
		await create(wireEvent(4003, { locked: true }));
		const patch = (body: unknown) =>
			event.PATCH(request("/api/events/4003", "PATCH", body), ctx(4003));

		expect((await patch({ name: "x" })).status).toBe(409);
		expect((await event.DELETE(request("/api/events/4003", "DELETE"), ctx(4003))).status).toBe(409);
		expect((await patch({ collapsed: true })).status).toBe(200);
		expect((await list())[0]).toMatchObject({ name: "Event 4003", collapsed: true, locked: true });

		// Unlocking in the same request lets the other changes through
		expect((await patch({ locked: false, name: "Edited" })).status).toBe(200);
		expect((await list())[0]).toMatchObject({ name: "Edited", locked: false });
	});
});

describe("DELETE /api/events/[id]", () => {
	test("can't delete another user's event", async () => {
		const owner = signInAsNewUser();
		await create(wireEvent(5001));
		signInAsNewUser();
		expect((await event.DELETE(request("/api/events/5001", "DELETE"), ctx(5001))).status).toBe(200);
		expect((await list(owner)).map((e) => e.id)).toEqual([5001]);
	});

	test("removes the event", async () => {
		await create(wireEvent(5002));
		expect((await event.DELETE(request("/api/events/5002", "DELETE"), ctx(5002))).status).toBe(200);
		expect(await list()).toHaveLength(0);
	});
});
