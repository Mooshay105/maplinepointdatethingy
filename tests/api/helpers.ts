import { NextRequest } from "next/server";
import { authState } from "../setup";

let userCount = 0;

/** Signs in as a fresh user, so tests sharing the database don't see each other's rows. */
export function signInAsNewUser() {
	authState.userId = `user_${++userCount}_${Date.now()}`;
	return authState.userId;
}

export function signOut() {
	authState.userId = null;
}

export function request(path: string, method = "GET", body?: unknown) {
	return new NextRequest(new URL(path, "http://localhost"), {
		method,
		body: body === undefined ? undefined : JSON.stringify(body),
		headers: body === undefined ? undefined : { "Content-Type": "application/json" },
	});
}

/** The second argument Next.js passes to a dynamic route handler. */
export function params(id: string | number) {
	return { params: Promise.resolve({ id: String(id) }) };
}

export function wireEvent(id: number, overrides: Record<string, unknown> = {}) {
	return {
		id,
		name: `Event ${id}`,
		description: "",
		address: "",
		lat: -36.8,
		lng: 174.7,
		date: 1_700_000_000_000 + id,
		icon: "road-running",
		iconColor: "red",
		visible: true,
		groupId: null,
		layerId: null,
		travelNote: "",
		collapsed: false,
		...overrides,
	};
}
