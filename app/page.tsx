"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import MapView from "@/components/MapView";
import Chat from "@/components/Chat";
import EventEditor from "@/components/EventEditor";
import { SettingsIcon, UserIcon } from "@/components/Icons";
import {
	COLOR_LABELS,
	EVENT_COLORS,
	EVENT_ICONS,
	EventColor,
	EventIcon,
	ICON_LABELS,
	MapEvent,
} from "@/utils/types";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useChat } from "@ai-sdk/react";
import { Show, SignInButton, UserButton, useAuth } from "@clerk/nextjs";
// Imported as a namespace so e.g. eventsSync.updateEvent (saves to the db) can't be mixed up
// with this page's updateEvent (updates the screen, then calls eventsSync.updateEvent)
import * as eventsSync from "@/utils/eventsSync";
import { formatNzDate, parseNzDate } from "@/utils/dates";
import { getOpenaiApiKey, setOpenaiApiKey, useOpenaiApiKey } from "@/utils/openaiApiKey";
import { AddEventInput, DeleteEventInput, EditEventInput } from "@/utils/chatTools";

// Created once, outside the component. The headers function runs on every request, so it
// always sends the key that's currently saved.
const chatTransport = new DefaultChatTransport({
	api: "/api/chat",
	headers: (): Record<string, string> => {
		const key = getOpenaiApiKey();
		return key ? { "x-openai-api-key": key } : {};
	},
});

/** Where the old localStorage-only version of the app saved events (it called them "points"). */
const LEGACY_STORAGE_KEY = "points";

type LegacyEvent = Omit<MapEvent, "date" | "description" | "visible"> & {
	date: string;
	description?: string;
	visable?: boolean;
};

/** Loads the user's events, first uploading any left over from the localStorage-only version. */
async function loadEvents(): Promise<MapEvent[]> {
	const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
	if (stored) {
		const legacy: MapEvent[] = (JSON.parse(stored) as LegacyEvent[]).map(
			({ visable, ...event }) => ({
				description: "",
				...event,
				date: new Date(event.date),
				visible: visable ?? true,
			}),
		);
		await eventsSync.createEvents(legacy);
		localStorage.removeItem(LEGACY_STORAGE_KEY);
	}
	return eventsSync.fetchEvents();
}

function sortByDate(events: MapEvent[]): MapEvent[] {
	return [...events].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export default function Home() {
	// The "add event" form
	const [name, setName] = useState("");
	const [date, setDate] = useState("");
	const [lat, setLat] = useState("");
	const [lng, setLng] = useState("");
	const [icon, setIcon] = useState<EventIcon>("indoor-athletics");
	const [color, setColor] = useState<EventColor>("red");

	const [events, setEvents] = useState<MapEvent[]>([]);
	const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [selectedTab, setSelectedTab] = useState<"events" | "chat">("events");
	const [settings, setSettings] = useState({ alwaysShowHoverMenus: false });
	const [copied, setCopied] = useState(false);
	const [showApiKey, setShowApiKey] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const openaiApiKey = useOpenaiApiKey();
	const eventsRef = useRef(events);
	const { isLoaded: authLoaded, isSignedIn, userId } = useAuth();

	const loaded = isSignedIn === true && loadedUserId === userId;
	const visibleEvents = loaded ? events.filter((event) => event.visible) : [];

	useEffect(() => {
		eventsRef.current = events;
	}, [events]);

	useEffect(() => {
		window.addEventListener("pagehide", eventsSync.flushAllUpdates);
		return () => window.removeEventListener("pagehide", eventsSync.flushAllUpdates);
	}, []);

	// The db is the source of truth: load the user's events once, then edit them locally and sync changes back
	useEffect(() => {
		if (!isSignedIn) return;

		let cancelled = false;
		loadEvents()
			.then((loadedEvents) => {
				if (cancelled) return;
				setEvents(loadedEvents);
				setLoadedUserId(userId);
				setLoadError(null);
			})
			.catch((err) => {
				console.error(err);
				if (!cancelled) setLoadError("Couldn't load your events.");
			});

		return () => {
			cancelled = true;
		};
	}, [isSignedIn, userId]);

	function updateEvent(id: number, changes: Partial<MapEvent>) {
		setEvents((prev) => {
			const next = prev.map((event) =>
				event.id === id ? { ...event, ...changes } : event,
			);
			return changes.date !== undefined ? sortByDate(next) : next;
		});
		eventsSync.updateEvent(id, changes);
	}

	function deleteEvent(id: number) {
		setEvents((prev) => prev.filter((event) => event.id !== id));
		eventsSync.deleteEvent(id);
	}

	/**
	 * Adds a new event. An empty date means today.
	 * @returns The new event, or null if the date is invalid.
	 */
	function addEvent(fields: {
		name: string;
		date: string;
		lat: number;
		lng: number;
		icon: EventIcon;
		iconColor: EventColor;
		description?: string;
	}): MapEvent | null {
		const parsedDate = fields.date.trim() === "" ? new Date() : parseNzDate(fields.date);
		if (!parsedDate) {
			setSubmitError("Invalid date, use DD/MM/YYYY.");
			return null;
		}
		if (Number.isNaN(fields.lat) || Number.isNaN(fields.lng)) {
			setSubmitError("Invalid coordinates.");
			return null;
		}

		const event: MapEvent = {
			description: "",
			...fields,
			id: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1, // The db wants a positive id
			date: parsedDate,
			visible: true,
		};
		setEvents((prev) => sortByDate([...prev, event]));
		eventsSync.createEvent(event);
		return event;
	}

	function handleAddEventSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const added = addEvent({
			name,
			date,
			lat: Number(lat),
			lng: Number(lng),
			icon,
			iconColor: color,
		});
		if (!added) return;
		setName("");
		setDate("");
		setLat("");
		setLng("");
	}

	function copyShareLink() {
		navigator.clipboard.writeText(`${window.location.origin}/share/${userId}`);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	const { messages, sendMessage, status, stop, addToolOutput, error } = useChat({
		transport: chatTransport,
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		async onToolCall({ toolCall }) {
			if (toolCall.dynamic) return;

			const respond = (output: string) =>
				addToolOutput({
					tool: toolCall.toolName,
					toolCallId: toolCall.toolCallId,
					output,
				});

			// The AI SDK has already checked each input against the schemas in utils/chatTools.ts
			if (toolCall.toolName === "addEvent") {
				const input = toolCall.input as AddEventInput;
				const event = addEvent({
					name: input.name,
					date: input.date,
					lat: input.latitude,
					lng: input.longitude,
					icon: input.icon ?? "outdoor-athletics",
					iconColor: input.iconColor ?? "grey",
					description: input.description,
				});
				respond(
					event
						? `Added event "${event.name}" with id ${event.id}`
						: `Invalid date "${input.date}", use DD/MM/YYYY`,
				);
			} else if (toolCall.toolName === "editEvent") {
				const input = toolCall.input as EditEventInput;
				if (!eventsRef.current.some((event) => event.id === input.id)) {
					respond(`No event with id ${input.id}`);
					return;
				}
				const changes: Partial<MapEvent> = {};
				if (input.name !== undefined) changes.name = input.name;
				if (input.description !== undefined) changes.description = input.description;
				if (input.latitude !== undefined) changes.lat = input.latitude;
				if (input.longitude !== undefined) changes.lng = input.longitude;
				if (input.date !== undefined) {
					const parsed = parseNzDate(input.date);
					if (!parsed) {
						respond(`Invalid date "${input.date}", use DD/MM/YYYY`);
						return;
					}
					changes.date = parsed;
				}
				updateEvent(input.id, changes);
				respond(`Edited event ${input.id}`);
			} else if (toolCall.toolName === "deleteEvent") {
				const input = toolCall.input as DeleteEventInput;
				if (!eventsRef.current.some((event) => event.id === input.id)) {
					respond(`No event with id ${input.id}`);
					return;
				}
				deleteEvent(input.id);
				respond(`Deleted event ${input.id}`);
			} else if (toolCall.toolName === "listEvents") {
				const list = eventsRef.current.map((event) => ({
					id: event.id,
					name: event.name,
					description: event.description,
					date: formatNzDate(event.date),
					latitude: event.lat,
					longitude: event.lng,
				}));
				respond(JSON.stringify(list));
			} else if (toolCall.toolName === "geoLookup") {
				// Executed on the server (OpenStreetMap), output arrives in the stream
				return;
			} else {
				respond(`Tool ${toolCall.toolName} is not implemented yet`);
			}
		},
	});

	return (
		<main>
			<div className="fixed top-0 right-0 flex flex-row justify-center items-center align-middle bg-panel border-l border-b border-line rounded-bl-2xl text-panel-foreground p-2 overflow-y-auto z-100">
				<Show when="signed-out">
					<SignInButton>
						<button aria-label="Sign in">
							<UserIcon />
						</button>
					</SignInButton>
				</Show>
				<Show when="signed-in">
					<div className="flex flex-row gap-2 justify-center items-center">
						<button
							className="border border-line rounded-md px-2"
							onClick={copyShareLink}
						>
							{copied ? "Copied!" : "Share"}
						</button>
						<UserButton>
							<UserButton.UserProfilePage
								label="Settings"
								labelIcon={<SettingsIcon size={16} />}
								url="settings"
							>
								<div className="flex flex-col">
									<h1 className="text-[17px] font-bold">Settings</h1>
									<div className="border-b border-modal-line mt-3.75 mb-5" />
									<label className="flex flex-row items-center gap-1 text-[13px]">
										<input
											type="checkbox"
											checked={settings.alwaysShowHoverMenus}
											onChange={(e) =>
												setSettings((prev) => ({
													...prev,
													alwaysShowHoverMenus: e.target.checked,
												}))
											}
										/>
										Always Show Hover Menus
									</label>
									<div className="border-b border-modal-line mt-3.75 mb-5" />
									<label htmlFor="openai-api-key" className="text-[13px] font-medium">
										OpenAI API Key
									</label>
									<div className="flex flex-row mt-1">
										<input
											id="openai-api-key"
											className="border border-modal-input rounded-md px-2 py-1 text-[13px] grow"
											type={showApiKey ? "text" : "password"}
											autoComplete="off"
											spellCheck={false}
											placeholder="sk-..."
											value={openaiApiKey}
											onChange={(e) => setOpenaiApiKey(e.target.value)}
										/>
										<button
											className="border border-modal-input rounded-md ml-1 px-2 text-[13px]"
											onClick={() => setShowApiKey((v) => !v)}
										>
											{showApiKey ? "Hide" : "Show"}
										</button>
										<button
											className="border border-modal-input rounded-md ml-1 px-2 text-[13px]"
											onClick={() => setOpenaiApiKey("")}
										>
											Clear
										</button>
									</div>
									<p className="text-[11px] text-modal-muted mt-1">
										Stored only in this browser&apos;s local storage. It&apos;s sent with
										each chat request to reach OpenAI, but never saved on the server.
									</p>
									<div className="border-b border-modal-line mt-3.75 mb-5" />
									<p className="text-[13px] text-center">More Settings Coming Soon!</p>
								</div>
							</UserButton.UserProfilePage>
						</UserButton>
					</div>
				</Show>
			</div>
			<MapView
				events={visibleEvents}
				alwaysShowHoverMenus={settings.alwaysShowHoverMenus}
				onUpdate={updateEvent}
				onDelete={deleteEvent}
			/>
			<div className="fixed top-0 left-0 h-full w-1/4 bg-panel border-r border-line text-panel-foreground p-2 overflow-y-auto">
				<div className="fixed top-0 left-0 w-1/4 px-2 flex flex-row justify-between border-b border-r border-line bg-panel">
					<button
						className={`text-lg ${selectedTab === "events" ? "underline" : ""}`}
						onClick={() => setSelectedTab("events")}
					>
						Events
					</button>
					<button
						className={`text-lg ${selectedTab === "chat" ? "underline" : ""}`}
						onClick={() => setSelectedTab("chat")}
					>
						Chat
					</button>
				</div>
				{selectedTab === "events" ? (
					<div>
						<div className="mb-30 mt-7">
							{!authLoaded ? (
								<div className="text-center">Loading...</div>
							) : !isSignedIn ? (
								<div className="text-center">Sign in to see your events.</div>
							) : loadError ? (
								<div className="text-center text-danger">{loadError}</div>
							) : loaded ? (
								events.map((event) => (
									<EventEditor
										key={event.id}
										event={event}
										onUpdate={updateEvent}
										onDelete={deleteEvent}
										className="border border-line rounded-xl m-2"
									/>
								))
							) : (
								<div className="text-center">Loading...</div>
							)}
						</div>
						{loaded ? (
							<form
								className="border border-line bg-panel rounded-xl m-1 flex flex-col fixed bottom-0 left-1 w-[calc(25%-16px)]"
								onSubmit={handleAddEventSubmit}
							>
								{submitError ? (
									<div className="text-danger mt-2 text-center">{submitError}</div>
								) : null}
								<div className="flex flex-row">
									<div className="flex flex-col">
										<div className="flex flex-row">
											<input
												className="border border-line rounded-md mt-2 ml-2 mr-1 px-2 w-1/2"
												value={name}
												onChange={(e) => setName(e.target.value)}
												placeholder="Name"
											/>
											<input
												className="border border-line rounded-md mt-2 ml-1 mr-2 px-2 w-1/2"
												value={date}
												onChange={(e) => setDate(e.target.value)}
												placeholder="Date (DD/MM/YYYY)"
											/>
										</div>

										<div className="flex flex-row">
											<input
												className="border border-line rounded-md mt-2 ml-2 mr-1 px-2 w-1/2"
												value={lat}
												onChange={(e) => setLat(e.target.value)}
												placeholder="Latitude"
											/>
											<input
												className="border border-line rounded-md mt-2 ml-1 mr-2 px-2 w-1/2"
												value={lng}
												onChange={(e) => setLng(e.target.value)}
												placeholder="Longitude"
											/>
										</div>
										<div className="flex flex-row">
											<select
												className="border border-line rounded-md mt-2 mb-2 ml-2 mr-1 px-2 w-1/2"
												value={icon}
												onChange={(e) => setIcon(e.target.value as EventIcon)}
											>
												{EVENT_ICONS.map((icon) => (
													<option key={icon} value={icon}>
														{ICON_LABELS[icon]}
													</option>
												))}
											</select>
											<select
												className="border border-line rounded-md mt-2 mb-2 ml-1 mr-2 px-2 w-1/2"
												value={color}
												onChange={(e) => setColor(e.target.value as EventColor)}
											>
												{EVENT_COLORS.map((color) => (
													<option key={color} value={color}>
														{COLOR_LABELS[color]}
													</option>
												))}
											</select>
										</div>
									</div>
									<button
										type="submit"
										className="border border-line rounded-md mt-2 mb-2 mr-2 px-2"
									>
										Add
									</button>
								</div>
							</form>
						) : null}
					</div>
				) : (
					<Chat
						messages={messages}
						sendMessage={sendMessage}
						status={status}
						stop={stop}
						hasApiKey={openaiApiKey !== ""}
						error={error}
					/>
				)}
			</div>
		</main>
	);
}
