// Client-side sync with the /api routes. The UI updates its local state first, then calls these to persist in the background.

const UPDATE_DEBOUNCE_MS = 400;
/** Creates made within this window go out together, so e.g. the chatbot adding 50 events is one request, not 50. */
const CREATE_BATCH_MS = 50;
const MAX_ATTEMPTS = 4;

/**
 * Browsers cap keepalive requests: the bodies of all keepalive requests in flight may add up to
 * at most 64 KiB, and there's a limit on how many can be open at once. Going over makes fetch
 * reject straight away, so we only ask for keepalive while there's room and send normally otherwise.
 */
const KEEPALIVE_MAX_BYTES = 60_000;
const KEEPALIVE_MAX_REQUESTS = 8;
let keepaliveBytes = 0;
let keepaliveRequests = 0;

/** Requests that haven't finished yet, plus changes still waiting to be sent. Used to warn before leaving the page. */
let unsaved = 0;

/** A new random id. Ids are made client-side so the UI doesn't wait for the server, and the db wants a positive one. */
export function newId() {
	return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1;
}

/** Sends a request, with keepalive (so it survives the page closing) when the browser has room for it. */
export async function sendJson(url: string, method: string, body?: unknown) {
	const text = body === undefined ? undefined : JSON.stringify(body);
	const size = text ? new Blob([text]).size : 0;
	const keepalive =
		keepaliveRequests < KEEPALIVE_MAX_REQUESTS && keepaliveBytes + size <= KEEPALIVE_MAX_BYTES;
	if (keepalive) {
		keepaliveBytes += size;
		keepaliveRequests++;
	}
	try {
		return await fetch(url, {
			method,
			headers: text === undefined ? undefined : { "Content-Type": "application/json" },
			body: text,
			keepalive,
		});
	} finally {
		if (keepalive) {
			keepaliveBytes -= size;
			keepaliveRequests--;
		}
	}
}

/** Sends a request, retrying on network errors and server errors. All our writes are safe to repeat. */
async function sendWithRetry(url: string, method: string, body?: unknown) {
	for (let attempt = 1; ; attempt++) {
		try {
			const res = await sendJson(url, method, body);
			if (res.ok) return;
			// 4xx means the request itself is wrong, so trying again won't help
			if (res.status < 500 || attempt >= MAX_ATTEMPTS) {
				throw new Error(`${res.status} ${await res.text()}`);
			}
		} catch (err) {
			if (attempt >= MAX_ATTEMPTS || (err instanceof Error && /^\d{3} /.test(err.message))) {
				throw err;
			}
		}
		await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
	}
}

const allSyncs: { flushAll: () => void }[] = [];

/**
 * Creates, updates and deletes items of one kind through `${url}` and `${url}/<id>`.
 * @param label What an item is called in error messages, e.g. "event".
 * @param toWire Converts an item, or some of its fields, to what the API expects.
 * @param batchCreates Whether POST `${url}` accepts an array, so creates can be sent together.
 */
export function createSync<T extends { id: number }>(
	url: string,
	label: string,
	toWire: (fields: Partial<T>) => Record<string, unknown> = (fields) => fields,
	batchCreates = false,
) {
	/** Requests for the same item run one after another, so e.g. an edit can't land before its create. */
	const chains = new Map<number, Promise<void>>();
	const pendingChanges = new Map<number, Record<string, unknown>>();
	const pendingTimers = new Map<number, ReturnType<typeof setTimeout>>();
	let pendingCreates: {
		id: number;
		body: Record<string, unknown>;
		settle: (sent: Promise<void>) => void;
	}[] = [];

	/** Runs `request` after the earlier requests for these items, and makes later ones wait for it. */
	function enqueue(ids: number[], action: string, request: () => Promise<void>) {
		unsaved++;
		const before = Promise.all(ids.map((id) => chains.get(id)));
		const next = before
			.then(request)
			.catch((err) => console.error(`Failed to ${action} ${label} ${ids.join(", ")}:`, err))
			.finally(() => unsaved--);
		for (const id of ids) {
			chains.set(id, next);
			next.finally(() => {
				if (chains.get(id) === next) chains.delete(id);
			});
		}
		return next;
	}

	function flushCreates() {
		const batch = pendingCreates;
		pendingCreates = [];
		if (batch.length === 0) return;
		// Drop the placeholders so the batch doesn't wait on itself
		for (const c of batch) chains.delete(c.id);
		unsaved -= batch.length;
		const sent = enqueue(
			batch.map((c) => c.id),
			"create",
			async () => {
				try {
					await sendWithRetry(url, "POST", batch.map((c) => c.body));
				} catch (err) {
					if (batch.length === 1) throw err;
					// One bad item fails the whole batch, so send them one by one to save the rest
					const results = await Promise.allSettled(
						batch.map((c) => sendWithRetry(url, "POST", c.body)),
					);
					results.forEach((r, i) => {
						if (r.status === "rejected") {
							console.error(`Failed to create ${label} ${batch[i].id}:`, r.reason);
						}
					});
				}
			},
		);
		for (const c of batch) c.settle(sent);
	}

	function flushUpdate(id: number) {
		clearTimeout(pendingTimers.get(id));
		pendingTimers.delete(id);
		const changes = pendingChanges.get(id);
		pendingChanges.delete(id);
		if (!changes) return;
		unsaved--;
		enqueue([id], "update", () => sendWithRetry(`${url}/${id}`, "PATCH", changes));
	}

	const sync = {
		create(item: T) {
			if (!batchCreates) {
				enqueue([item.id], "create", () => sendWithRetry(url, "POST", toWire(item)));
				return;
			}
			if (pendingCreates.length === 0) setTimeout(flushCreates, CREATE_BATCH_MS);
			unsaved++;
			// Until the batch is sent, edits and deletes for this item wait on this, which settles with the batch
			let settle!: (sent: Promise<void>) => void;
			chains.set(item.id, new Promise<void>((resolve) => (settle = resolve)));
			pendingCreates.push({ id: item.id, body: toWire(item), settle });
		},

		/** Merges changes into a pending update that's sent once edits to this item pause, so typing doesn't fire a request per key. */
		update(id: number, changes: Partial<T>) {
			if (!pendingChanges.has(id)) unsaved++;
			pendingChanges.set(id, { ...pendingChanges.get(id), ...toWire(changes) });
			clearTimeout(pendingTimers.get(id));
			pendingTimers.set(
				id,
				setTimeout(() => flushUpdate(id), UPDATE_DEBOUNCE_MS),
			);
		},

		remove(id: number) {
			flushCreates();
			clearTimeout(pendingTimers.get(id));
			pendingTimers.delete(id);
			if (pendingChanges.delete(id)) unsaved--;
			enqueue([id], "delete", () => sendWithRetry(`${url}/${id}`, "DELETE"));
		},

		flushAll() {
			flushCreates();
			for (const id of [...pendingChanges.keys()]) flushUpdate(id);
		},
	};
	allSyncs.push(sync);
	return sync;
}

/** Sends any batched creates and debounced updates right away, e.g. before the page unloads. */
export function flushAllUpdates() {
	for (const sync of allSyncs) sync.flushAll();
}

/** Whether some changes haven't reached the server yet. */
export function hasUnsavedChanges() {
	return unsaved > 0;
}
