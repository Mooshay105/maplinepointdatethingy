// Client-side sync with the /api routes. The UI updates its local state first, then calls these to persist in the background.

const UPDATE_DEBOUNCE_MS = 400;

/** A new random id. Ids are made client-side so the UI doesn't wait for the server, and the db wants a positive one. */
export function newId() {
	return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1;
}

export function sendJson(url: string, method: string, body: unknown, keepalive = false) {
	return fetch(url, {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		keepalive,
	});
}

const allSyncs: { flushAll: () => void }[] = [];

/**
 * Creates, updates and deletes items of one kind through `${url}` and `${url}/<id>`.
 * @param label What an item is called in error messages, e.g. "event".
 * @param toWire Converts an item, or some of its fields, to what the API expects.
 */
export function createSync<T extends { id: number }>(
	url: string,
	label: string,
	toWire: (fields: Partial<T>) => Record<string, unknown> = (fields) => fields,
) {
	/** Requests for the same item run one after another, so e.g. an edit can't land before its create. */
	const chains = new Map<number, Promise<void>>();
	const pendingChanges = new Map<number, Record<string, unknown>>();
	const pendingTimers = new Map<number, ReturnType<typeof setTimeout>>();

	function enqueue(id: number, action: string, request: () => Promise<Response>) {
		const next = (chains.get(id) ?? Promise.resolve())
			.then(request)
			.then(async (res) => {
				if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
			})
			.catch((err) => console.error(`Failed to ${action} ${label} ${id}:`, err));
		chains.set(id, next);
		next.finally(() => {
			if (chains.get(id) === next) chains.delete(id);
		});
	}

	function flushUpdate(id: number) {
		clearTimeout(pendingTimers.get(id));
		pendingTimers.delete(id);
		const changes = pendingChanges.get(id);
		pendingChanges.delete(id);
		if (changes) enqueue(id, "update", () => sendJson(`${url}/${id}`, "PATCH", changes, true));
	}

	const sync = {
		create(item: T) {
			enqueue(item.id, "create", () => sendJson(url, "POST", toWire(item), true));
		},

		/** Merges changes into a pending update that's sent once edits to this item pause, so typing doesn't fire a request per key. */
		update(id: number, changes: Partial<T>) {
			pendingChanges.set(id, { ...pendingChanges.get(id), ...toWire(changes) });
			clearTimeout(pendingTimers.get(id));
			pendingTimers.set(
				id,
				setTimeout(() => flushUpdate(id), UPDATE_DEBOUNCE_MS),
			);
		},

		remove(id: number) {
			clearTimeout(pendingTimers.get(id));
			pendingTimers.delete(id);
			pendingChanges.delete(id);
			enqueue(id, "delete", () => fetch(`${url}/${id}`, { method: "DELETE", keepalive: true }));
		},

		flushAll() {
			for (const id of [...pendingChanges.keys()]) flushUpdate(id);
		},
	};
	allSyncs.push(sync);
	return sync;
}

/** Sends any debounced updates right away, e.g. before the page unloads. */
export function flushAllUpdates() {
	for (const sync of allSyncs) sync.flushAll();
}
