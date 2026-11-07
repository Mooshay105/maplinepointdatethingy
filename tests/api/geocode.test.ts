import { afterEach, expect, test } from "bun:test";
import { GET } from "@/app/api/geocode/route";
import { request, signInAsNewUser, signOut } from "./helpers";

const realFetch = globalThis.fetch;
const realConsoleError = console.error;
afterEach(() => {
	globalThis.fetch = realFetch;
	console.error = realConsoleError;
});

function fakeNominatim(places: unknown[], status = 200) {
	globalThis.fetch = (async () =>
		new Response(JSON.stringify(places), { status })) as unknown as typeof fetch;
}

test("signed-out users can't geocode", async () => {
	signOut();
	expect((await GET(request("/api/geocode?address=x"))).status).toBe(401);
});

test("needs an address", async () => {
	signInAsNewUser();
	expect((await GET(request("/api/geocode?address=%20"))).status).toBe(400);
});

test("returns the best match", async () => {
	signInAsNewUser();
	fakeNominatim([
		{ lat: "1", lon: "2", display_name: "First", type: "city" },
		{ lat: "3", lon: "4", display_name: "Second", type: "city" },
	]);
	const res = await GET(request("/api/geocode?address=Somewhere"));
	expect(res.status).toBe(200);
	expect(await res.json()).toEqual({ latitude: 1, longitude: 2, displayName: "First", type: "city" });
}, 10_000);

test("404 when nothing matches, 502 when the lookup fails", async () => {
	signInAsNewUser();
	console.error = () => {};
	fakeNominatim([]);
	expect((await GET(request("/api/geocode?address=Nowhere"))).status).toBe(404);
	fakeNominatim([], 500);
	expect((await GET(request("/api/geocode?address=Nowhere"))).status).toBe(502);
}, 10_000);
