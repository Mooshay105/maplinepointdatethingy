import { beforeEach, describe, expect, test } from "bun:test";
import * as events from "@/app/api/events/route";
import * as groups from "@/app/api/groups/route";
import * as group from "@/app/api/groups/[id]/route";
import * as layers from "@/app/api/layers/route";
import * as layer from "@/app/api/layers/[id]/route";
import { params, request, signInAsNewUser, signOut, wireEvent } from "./helpers";

type GroupCtx = Parameters<typeof group.PATCH>[1];
type LayerCtx = Parameters<typeof layer.PATCH>[1];
const groupCtx = (id: string | number) => params(id) as unknown as GroupCtx;
const layerCtx = (id: string | number) => params(id) as unknown as LayerCtx;

const newGroup = (id: number, name = `Group ${id}`) => ({ id, name, visible: true, collapsed: false });
const newLayer = (id: number, groupId: number) => ({
	id,
	groupId,
	name: `Layer ${id}`,
	visible: true,
	collapsed: false,
});

async function listGroups(userId?: string) {
	const res = await groups.GET(request(userId ? `/api/groups?userId=${userId}` : "/api/groups"));
	expect(res.status).toBe(200);
	return res.json();
}

async function listEvents() {
	return (await events.GET(request("/api/events"))).json();
}

beforeEach(() => {
	signInAsNewUser();
});

test("signed-out users can't write", async () => {
	signOut();
	expect((await groups.GET(request("/api/groups"))).status).toBe(401);
	expect((await groups.POST(request("/api/groups", "POST", newGroup(1)))).status).toBe(401);
	expect((await layers.POST(request("/api/layers", "POST", newLayer(2, 1)))).status).toBe(401);
	expect((await group.DELETE(request("/api/groups/1", "DELETE"), groupCtx(1))).status).toBe(401);
	expect((await layer.DELETE(request("/api/layers/1", "DELETE"), layerCtx(1))).status).toBe(401);
});

describe("groups and layers", () => {
	test("creates and lists them in creation order, also for share links", async () => {
		const owner = signInAsNewUser();
		expect((await groups.POST(request("/api/groups", "POST", newGroup(12)))).status).toBe(201);
		await Bun.sleep(2);
		await groups.POST(request("/api/groups", "POST", newGroup(11)));
		expect((await layers.POST(request("/api/layers", "POST", newLayer(21, 12)))).status).toBe(201);
		// Retrying is safe
		await groups.POST(request("/api/groups", "POST", newGroup(12, "Renamed?")));

		signOut();
		const listed = await listGroups(owner);
		expect(listed.groups).toEqual([newGroup(12), newGroup(11)]);
		expect(listed.layers).toEqual([newLayer(21, 12)]);
	});

	test("rejects invalid input", async () => {
		expect((await groups.POST(request("/api/groups", "POST", { id: 1 }))).status).toBe(400);
		expect(
			(await layers.POST(request("/api/layers", "POST", { ...newGroup(1) }))).status,
		).toBe(400);
		expect(
			(await group.PATCH(request("/api/groups/abc", "PATCH", {}), groupCtx("abc"))).status,
		).toBe(400);
	});

	test("PATCH updates the user's own rows only", async () => {
		await groups.POST(request("/api/groups", "POST", newGroup(31)));
		await layers.POST(request("/api/layers", "POST", newLayer(32, 31)));
		expect(
			(await group.PATCH(request("/api/groups/31", "PATCH", { visible: false }), groupCtx(31)))
				.status,
		).toBe(200);
		expect(
			(await layer.PATCH(request("/api/layers/32", "PATCH", { name: "New" }), layerCtx(32))).status,
		).toBe(200);
		const listed = await listGroups();
		expect(listed.groups[0].visible).toBe(false);
		expect(listed.layers[0].name).toBe("New");

		signInAsNewUser();
		expect(
			(await group.PATCH(request("/api/groups/31", "PATCH", { name: "x" }), groupCtx(31))).status,
		).toBe(404);
		expect(
			(await layer.PATCH(request("/api/layers/32", "PATCH", { name: "x" }), layerCtx(32))).status,
		).toBe(404);
	});

	test("deleting a group deletes its layers and moves unlocked events out", async () => {
		await groups.POST(request("/api/groups", "POST", newGroup(41)));
		await layers.POST(request("/api/layers", "POST", newLayer(42, 41)));
		await events.POST(
			request("/api/events", "POST", [
				wireEvent(43, { groupId: 41 }),
				wireEvent(44, { groupId: 41, layerId: 42 }),
				wireEvent(45, { groupId: 41, layerId: 42, locked: true }),
			]),
		);

		expect((await group.DELETE(request("/api/groups/41", "DELETE"), groupCtx(41))).status).toBe(200);
		expect(await listGroups()).toEqual({ groups: [], layers: [] });
		const placements = (await listEvents()).map(
			(e: { id: number; groupId: number | null; layerId: number | null }) => [e.id, e.groupId, e.layerId],
		);
		expect(placements).toEqual([
			[43, null, null],
			[44, null, null],
			[45, 41, 42],
		]);
	});

	test("deleting a layer keeps its unlocked events in the group", async () => {
		await groups.POST(request("/api/groups", "POST", newGroup(51)));
		await layers.POST(request("/api/layers", "POST", newLayer(52, 51)));
		await events.POST(
			request("/api/events", "POST", [
				wireEvent(53, { groupId: 51, layerId: 52 }),
				wireEvent(54, { groupId: 51, layerId: 52, locked: true }),
			]),
		);

		expect((await layer.DELETE(request("/api/layers/52", "DELETE"), layerCtx(52))).status).toBe(200);
		const listed = await listGroups();
		expect(listed.groups).toHaveLength(1);
		expect(listed.layers).toHaveLength(0);
		const placements = (await listEvents()).map(
			(e: { id: number; groupId: number | null; layerId: number | null }) => [e.id, e.groupId, e.layerId],
		);
		expect(placements).toEqual([
			[53, 51, null],
			[54, 51, 52],
		]);
	});
});
