import { afterEach, describe, expect, test } from "bun:test";
import { createSync, flushAllUpdates, hasUnsavedChanges, newId } from "@/utils/sync";

type Item = { id: number; name: string };
type Call = { url: string; method: string; body: unknown };

const realFetch = globalThis.fetch;
const realConsoleError = console.error;
afterEach(() => {
	globalThis.fetch = realFetch;
	console.error = realConsoleError;
});

/** Records every request. `respond` picks the status for each one (200 by default). */
function fakeFetch(respond: (call: Call) => number = () => 200) {
	const calls: Call[] = [];
	globalThis.fetch = (async (url: string, init: RequestInit) => {
		const call = {
			url,
			method: String(init.method),
			body: init.body ? JSON.parse(String(init.body)) : undefined,
		};
		calls.push(call);
		return new Response("{}", { status: respond(call) });
	}) as typeof fetch;
	return calls;
}

/** Waits until nothing is left to send. */
async function settled() {
	for (let i = 0; i < 200 && hasUnsavedChanges(); i++) await Bun.sleep(10);
	expect(hasUnsavedChanges()).toBe(false);
}

describe("newId", () => {
	test("is a positive safe integer", () => {
		for (let i = 0; i < 100; i++) {
			const id = newId();
			expect(Number.isSafeInteger(id)).toBe(true);
			expect(id).toBeGreaterThan(0);
		}
	});
});

describe("createSync", () => {
	test("creates, then sends debounced updates merged into one PATCH", async () => {
		const calls = fakeFetch();
		const sync = createSync<Item>("/api/things", "thing");
		sync.create({ id: 1, name: "a" });
		sync.update(1, { name: "b" });
		sync.update(1, { name: "c" });
		expect(hasUnsavedChanges()).toBe(true);
		await settled();
		expect(calls).toEqual([
			{ url: "/api/things", method: "POST", body: { id: 1, name: "a" } },
			{ url: "/api/things/1", method: "PATCH", body: { name: "c" } },
		]);
	});

	test("batches creates into one request when the API takes arrays", async () => {
		const calls = fakeFetch();
		const sync = createSync<Item>("/api/things", "thing", undefined, true);
		sync.create({ id: 1, name: "a" });
		sync.create({ id: 2, name: "b" });
		await settled();
		expect(calls).toEqual([
			{ url: "/api/things", method: "POST", body: [{ id: 1, name: "a" }, { id: 2, name: "b" }] },
		]);
	});

	test("a failed batch is retried one by one so the good items are saved", async () => {
		console.error = () => {};
		const calls = fakeFetch((c) => (Array.isArray(c.body) ? 400 : 201));
		const sync = createSync<Item>("/api/things", "thing", undefined, true);
		sync.create({ id: 1, name: "a" });
		sync.create({ id: 2, name: "b" });
		await settled();
		expect(calls.map((c) => c.body)).toEqual([
			[{ id: 1, name: "a" }, { id: 2, name: "b" }],
			{ id: 1, name: "a" },
			{ id: 2, name: "b" },
		]);
	});

	test("deleting drops a pending update and waits for the create", async () => {
		const calls = fakeFetch();
		const sync = createSync<Item>("/api/things", "thing", undefined, true);
		sync.create({ id: 1, name: "a" });
		sync.update(1, { name: "b" });
		sync.remove(1);
		await settled();
		expect(calls.map((c) => c.method)).toEqual(["POST", "DELETE"]);
	});

	test("flushAllUpdates sends pending updates right away", async () => {
		const calls = fakeFetch();
		const sync = createSync<Item>("/api/things", "thing");
		sync.update(5, { name: "x" });
		flushAllUpdates();
		await Bun.sleep(20);
		expect(calls).toEqual([{ url: "/api/things/5", method: "PATCH", body: { name: "x" } }]);
		await settled();
	});

	test("retries server errors but not client errors", async () => {
		console.error = () => {};
		let failures = 1;
		const calls = fakeFetch((c) => (c.method === "DELETE" ? 404 : failures-- > 0 ? 503 : 200));
		const sync = createSync<Item>("/api/things", "thing");
		sync.create({ id: 1, name: "a" });
		sync.remove(2);
		await settled();
		expect(calls.filter((c) => c.method === "POST")).toHaveLength(2);
		expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(1);
	});

	test("uses toWire for creates and updates", async () => {
		const calls = fakeFetch();
		const sync = createSync<Item>("/api/things", "thing", (f) => ({ ...f, wire: true }));
		sync.create({ id: 1, name: "a" });
		sync.update(1, { name: "b" });
		await settled();
		expect(calls.map((c) => c.body)).toEqual([
			{ id: 1, name: "a", wire: true },
			{ name: "b", wire: true },
		]);
	});
});
