import { useSyncExternalStore } from "react";

// The user's own OpenAI key. It only lives in this browser's localStorage; it's sent with each
// chat request and never stored server-side.

const STORAGE_KEY = "openaiApiKey";
const listeners = new Set<() => void>();

export function getOpenaiApiKey(): string {
	return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function setOpenaiApiKey(value: string) {
	const key = value.trim();
	if (key) localStorage.setItem(STORAGE_KEY, key);
	else localStorage.removeItem(STORAGE_KEY);
	listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	// The "storage" event fires when another tab changes localStorage
	window.addEventListener("storage", listener);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", listener);
	};
}

/** The current key, re-rendering when it changes. Empty on the server, where there's no localStorage. */
export function useOpenaiApiKey(): string {
	return useSyncExternalStore(subscribe, getOpenaiApiKey, () => "");
}
