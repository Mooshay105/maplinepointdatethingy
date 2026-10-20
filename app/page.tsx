"use client";

import { useEffect, useRef, useState } from "react";
import MapView from "../db/components/MapView";
import { Point } from "@/utils/types";
import Chat from "../db/components/Chat";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useChat } from "@ai-sdk/react";
import { Show, SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import {
	createEvent,
	createEvents,
	deleteEvent,
	fetchEvents,
	flushAllUpdates,
	updateEvent,
} from "@/utils/eventsSync";

/**
 * Parses "DD/MM/YYYY" (en-NZ format). Returns null if invalid.
 * @param input The date string to parse.
 * @returns The parsed date, or null if the input is invalid.
 */
export function parseNzDate(input: string): Date | null {
	const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim());
	if (!match) return null;

	const day = Number(match[1]);
	const month = Number(match[2]) - 1;
	const year = Number(match[3]);

	const d = new Date(year, month, day);
	if (d.getDate() !== day || d.getMonth() !== month) return null;
	return d;
}

export default function Home() {
	const [name, setName] = useState("");
	const [date, setDate] = useState("");
	const [lat, setLat] = useState("");
	const [lng, setLng] = useState("");
	const [icon, setIcon] = useState<Point["icon"]>("indoor-athletics");
	const [color, setColor] = useState<Point["iconColor"]>("red");
	const [drafts, setDrafts] = useState<Record<string, string>>({});
	const [points, setPoints] = useState<Point[]>([]);
	const [filteredPoints, setFilteredPoints] = useState<Point[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [selected, setSelected] = useState<"events" | "chat">("events");
	const [settings, setSettings] = useState({
		alwaysShowHoverMenus: "false",
		nameInHoverMenu: "false",
		dateInHoverMenu: "false",
	});
	const [copied, setCopied] = useState(false);
	const [openaiApiKey, setOpenaiApiKey] = useState("");
	const [showApiKey, setShowApiKey] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const pointsRef = useRef(points);
	const openaiApiKeyRef = useRef(openaiApiKey);
	const { isLoaded: authLoaded, isSignedIn, userId } = useAuth();

	useEffect(() => {
		const storedKey = localStorage.getItem("openaiApiKey") ?? "";
		openaiApiKeyRef.current = storedKey;
		setOpenaiApiKey(storedKey);

		window.addEventListener("pagehide", flushAllUpdates);
		return () => window.removeEventListener("pagehide", flushAllUpdates);
	}, []);

	// The db is the source of truth: load the user's events once, then edit them locally and sync changes back
	useEffect(() => {
		if (!authLoaded) return;
		setLoaded(false);
		setLoadError(null);
		setPoints([]);
		if (!isSignedIn) return;

		let cancelled = false;
		(async () => {
			let events = await fetchEvents();

			// One-time migration of events saved by the old localStorage-only version
			const stored = localStorage.getItem("points");
			if (stored) {
				const legacy: Point[] = JSON.parse(stored).map((p: any) => ({
					...p,
					date: new Date(p.date),
				}));
				await createEvents(legacy);
				localStorage.removeItem("points");
				events = await fetchEvents();
			}

			if (cancelled) return;
			setPoints(events);
			setLoaded(true);
		})().catch((err) => {
			console.error(err);
			if (!cancelled) setLoadError("Couldn't load your events.");
		});

		return () => {
			cancelled = true;
		};
	}, [authLoaded, isSignedIn, userId]);

	useEffect(() => {
		pointsRef.current = points;
		if (!loaded) return;
		points.sort((a, b) => a.date.getTime() - b.date.getTime());
		setPoints(points);
		const filtered = points.filter((p) => p.visable);
		setFilteredPoints(filtered);
	}, [points]);

	function updatePoint(id: number, changes: Partial<Point>) {
		setPoints((prev) => {
			const next = prev.map((p) => (p.id === id ? { ...p, ...changes } : p));
			if (changes.date !== undefined) {
				next.sort((a, b) => a.date.getTime() - b.date.getTime());
			}
			return next;
		});
		updateEvent(id, changes);
	}

	function setDraft(key: string, value: string) {
		setDrafts((prev) => ({ ...prev, [key]: value }));
	}

	function clearDraft(key: string) {
		setDrafts((prev) => {
			const next = { ...prev };
			delete next[key];
			return next;
		});
	}

	function deletePoint(id: number) {
		setPoints((prev) => prev.filter((p) => p.id !== id));
		deleteEvent(id);
	}

	/**
	 * Adds a new point. An empty date means today.
	 * @returns The new point, or null if the date is invalid.
	 */
	function createPoint(
		name: string,
		dateStr: string,
		lat: number,
		lng: number,
		icon: Point["icon"],
		color: Point["iconColor"],
	): Point | null {
		const parsedDate = dateStr.trim() === "" ? new Date() : parseNzDate(dateStr);
		if (!parsedDate) return null;

		const point: Point = {
			id: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
			name,
			lat,
			lng,
			date: parsedDate,
			icon: icon,
			iconColor: color,
			visable: true,
		};
		setPoints((prev) => [...prev, point]);
		createEvent(point);
		return point;
	}

	function addPoint() {
		if (!createPoint(name, date, Number(lat), Number(lng), icon, color)) return; // Invalid date: keep the input so it can be fixed
		setName("");
		setDate("");
		setLat("");
		setLng("");
	}

	/** The key only lives in this browser's localStorage; it's sent per request and never stored server-side. */
	function updateOpenaiApiKey(value: string) {
		const key = value.trim();
		openaiApiKeyRef.current = key;
		setOpenaiApiKey(key);
		if (key) localStorage.setItem("openaiApiKey", key);
		else localStorage.removeItem("openaiApiKey");
	}

	function updateSettings(value: any) {
		setSettings((prev) => ({ ...prev, ...value }));
	}

	const [transport] = useState(
		() =>
			new DefaultChatTransport({
				api: "/api/chat",
				headers: (): Record<string, string> =>
					openaiApiKeyRef.current ? { "x-openai-api-key": openaiApiKeyRef.current } : {},
			}),
	);

	const { messages, sendMessage, status, stop, addToolOutput, error } = useChat({
		transport,
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		async onToolCall({ toolCall }) {
			if (toolCall.dynamic) return;

			const input = toolCall.input as any;
			const respond = (output: string) =>
				addToolOutput({
					tool: toolCall.toolName,
					toolCallId: toolCall.toolCallId,
					output,
				});

			if (toolCall.toolName === "addEvent") {
				const point = createPoint(
					input.title,
					input.date,
					input.latitude,
					input.longitude,
					input.icon,
					input.iconColor,
				);
				respond(
					point
						? `Added event "${point.name}" with id ${point.id}`
						: `Invalid date "${input.date}", use DD/MM/YYYY`,
				);
			} else if (toolCall.toolName === "editEvent") {
				if (!pointsRef.current.some((p) => p.id === input.id)) {
					respond(`No event with id ${input.id}`);
					return;
				}
				const changes: Partial<Point> = {};
				if (input.title !== undefined) changes.name = input.title;
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
				updatePoint(input.id, changes);
				respond(`Edited event ${input.id}`);
			} else if (toolCall.toolName === "deleteEvent") {
				if (!pointsRef.current.some((p) => p.id === input.id)) {
					respond(`No event with id ${input.id}`);
					return;
				}
				deletePoint(input.id);
				respond(`Deleted event ${input.id}`);
			} else if (toolCall.toolName === "listEvents") {
				const events = pointsRef.current.map((p) => ({
					id: p.id,
					title: p.name,
					date: p.date.toLocaleDateString("en-NZ"),
					latitude: p.lat,
					longitude: p.lng,
				}));
				respond(JSON.stringify(events));
			} else if (toolCall.toolName === "gpsLookup") {
				// Executed on the server (OpenStreetMap), output arrives in the stream
				return;
			} else {
				respond(`Tool ${toolCall.toolName} is not implemented yet`);
			}
		},
	});

	return (
		<main>
			<div className="fixed top-0 right-0 flex flex-row justify-center items-center align-middle bg-[#0f0f0f] border-l border-b border-[#f0f0f0] rounded-bl-2xl text-white p-2 overflow-y-auto z-100">
				<Show when="signed-out">
					<SignInButton>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="30"
							height="30"
							viewBox="0 0 64 64"
							fill="none"
							stroke="#f0f0f0"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<circle cx="32" cy="32" r="30" />
							<circle cx="32" cy="22" r="10" />
							<path d="M14 50 C14 40 22 36 32 36 C42 36 50 40 50 50" />
						</svg>
					</SignInButton>
				</Show>
				<Show when="signed-in">
					<div className="flex flex-row gap-2 justify-center items-center">
						<button
							className="border border-[#f0f0f0] rounded-md px-2"
							onClick={() => {
								const host = window.location.host;
								navigator.clipboard.writeText(`https://${host}/share/${userId}`);

								setCopied(true);

								setTimeout(() => {
									setCopied(false);
								}, 2000);
							}}
						>
							{copied ? "Copied!" : "Share"}
						</button>
						<UserButton>
							<UserButton.UserProfilePage
								label="Settings"
								labelIcon={
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 64 64"
										fill="none"
										stroke="currentColor"
										strokeWidth="4"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M48.17 26.75 L53.67 28.18 L53.67 35.82 L48.17 37.25 L47.15 39.72 L50.02 44.62 L44.62 50.02 L39.72 47.15 L37.25 48.17 L35.82 53.67 L28.18 53.67 L26.75 48.17 L24.28 47.15 L19.38 50.02 L13.98 44.62 L16.85 39.72 L15.83 37.25 L10.33 35.82 L10.33 28.18 L15.83 26.75 L16.85 24.28 L13.98 19.38 L19.38 13.98 L24.28 16.85 L26.75 15.83 L28.18 10.33 L35.82 10.33 L37.25 15.83 L39.72 16.85 L44.62 13.98 L50.02 19.38 L47.15 24.28 Z" />
										<circle cx="32" cy="32" r="6" />
									</svg>
								}
								url="settings"
							>
								<div className="flex flex-col">
									<h1 className="text-[17px] font-bold">Settings</h1>
									<div className="border-b border-[#ededed] mt-3.75 mb-5" />
									<div className="flex flex-row">
										<input
											type="checkbox"
											checked={settings.alwaysShowHoverMenus === "true"}
											onChange={(e) =>
												updateSettings({
													alwaysShowHoverMenus: e.target.checked ? "true" : "false",
												})
											}
										/>
										<label className="ml-1 text-[13px]">Always Show Hover Menus</label>
									</div>
									<div className="border-b border-[#ededed] mt-3.75 mb-5" />
									<label className="text-[13px] font-medium">OpenAI API Key</label>
									<div className="flex flex-row mt-1">
										<input
											className="border border-[#d9d9d9] rounded-md px-2 py-1 text-[13px] grow"
											type={showApiKey ? "text" : "password"}
											autoComplete="off"
											spellCheck={false}
											placeholder="sk-..."
											value={openaiApiKey}
											onChange={(e) => updateOpenaiApiKey(e.target.value)}
										/>
										<button
											className="border border-[#d9d9d9] rounded-md ml-1 px-2 text-[13px]"
											onClick={() => setShowApiKey((v) => !v)}
										>
											{showApiKey ? "Hide" : "Show"}
										</button>
										<button
											className="border border-[#d9d9d9] rounded-md ml-1 px-2 text-[13px]"
											onClick={() => updateOpenaiApiKey("")}
										>
											Clear
										</button>
									</div>
									<p className="text-[11px] text-[#747686] mt-1">
										Stored only in this browser&apos;s local storage. It&apos;s sent with
										each chat request to reach OpenAI, but never saved on the server.
									</p>
									<div className="border-b border-[#ededed] mt-3.75 mb-5" />
									<p className="text-[13px] text-center">More Settings Coming Soon!</p>
								</div>
							</UserButton.UserProfilePage>
						</UserButton>
					</div>
				</Show>
			</div>
			<MapView points={filteredPoints} />
			<div className="fixed top-0 left-0 h-full w-1/4 bg-[#0f0f0f] border-r border-[#f0f0f0] text-white p-2 overflow-y-auto">
				<div className="fixed top-0 left-0 w-1/4 px-2 flex flex-row justify-between border-b border-r border-[#f0f0f0] bg-[#0f0f0f]">
					<div
						className={`text-lg ${selected === "events" ? "underline" : ""}`}
						onClick={() => setSelected("events")}
					>
						Events
					</div>
					<div
						className={`text-lg ${selected === "chat" ? "underline" : ""}`}
						onClick={() => setSelected("chat")}
					>
						Chat
					</div>
				</div>
				{selected === "events" ? (
					<div>
						<div className="mb-30 mt-7">
							{!authLoaded ? (
								<div className="text-center">Loading...</div>
							) : !isSignedIn ? (
								<div className="text-center">Sign in to see your events.</div>
							) : loadError ? (
								<div className="text-center text-red-400">{loadError}</div>
							) : loaded ? (
								<>
									{points.map((p) => (
										<div key={p.id} className="border border-[#f0f0f0] rounded-xl m-2">
											<div className="flex flex-row">
												<input
													className="border border-[#f0f0f0] rounded-md mt-2 ml-2 mr-1 px-2 w-1/2"
													value={p.name}
													onChange={(e) => updatePoint(p.id, { name: e.target.value })}
													placeholder="Name"
												/>
												<input
													className="border border-[#f0f0f0] rounded-md mt-2 ml-1 mr-2 px-2 w-1/2"
													value={
														drafts[`${p.id}-date`] ?? p.date.toLocaleDateString("en-NZ")
													}
													onChange={(e) => setDraft(`${p.id}-date`, e.target.value)}
													onBlur={() => {
														const parsed = parseNzDate(drafts[`${p.id}-date`] ?? "");
														if (parsed) {
															updatePoint(p.id, { date: parsed });
															clearDraft(`${p.id}-date`);
														}
													}}
													placeholder="Date (DD/MM/YYYY)"
												/>
												<button
													className="border border-[#f0f0f0] rounded-md mt-2 mr-2 px-2"
													onClick={() => {
														updatePoint(p.id, { visable: !p.visable });
													}}
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="28"
														height="28"
														viewBox="0 0 64 64"
														fill="none"
														stroke="#f0f0f0"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
													>
														<path d="M8 32 Q32 12 56 32 Q32 52 8 32 Z" />
														<circle cx="32" cy="32" r="8" />
														{!p.visable ? <line x1="12" y1="12" x2="52" y2="52" /> : null}
													</svg>
												</button>
											</div>
											<div className="flex flex-row">
												<input
													className="border border-[#f0f0f0] rounded-md mt-2 ml-2 mr-1 px-2 w-1/2"
													value={drafts[`${p.id}-lat`] ?? p.lat}
													onChange={(e) => {
														const value = e.target.value;
														setDraft(`${p.id}-lat`, value);
														const n = Number(value);
														if (value.trim() !== "" && Number.isFinite(n)) {
															updatePoint(p.id, { lat: n });
														}
													}}
													placeholder="Latitude"
												/>
												<input
													className="border border-[#f0f0f0] rounded-md mt-2 ml-1 mr-2 px-2 w-1/2"
													value={drafts[`${p.id}-lng`] ?? p.lng}
													onChange={(e) => {
														const value = e.target.value;
														setDraft(`${p.id}-lng`, value);
														const n = Number(value);
														if (value.trim() !== "" && Number.isFinite(n)) {
															updatePoint(p.id, { lng: n });
														}
													}}
													placeholder="Longitude"
												/>
												<button
													className="border border-[#f0f0f0] rounded-md mt-2 mr-2 px-2"
													onClick={() => {
														deletePoint(p.id);
													}}
												>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="28"
														height="28"
														viewBox="0 0 64 64"
														fill="none"
														stroke="#f0f0f0"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
													>
														<line x1="12" y1="18" x2="52" y2="18" />
														<path d="M26 18 V13 H38 V18" />
														<path d="M17 18 L20 56 H44 L47 18" />
														<line x1="28" y1="27" x2="28" y2="47" />
														<line x1="36" y1="27" x2="36" y2="47" />
													</svg>
												</button>
											</div>
											<div className="flex flex-row">
												<select
													className="border border-[#f0f0f0] rounded-md mt-2 mb-2 ml-2 mr-1 px-2 w-1/2"
													value={p.icon}
													onChange={(e) =>
														updatePoint(p.id, { icon: e.target.value as Point["icon"] })
													}
												>
													<option value="indoor-athletics">Indoor</option>
													<option value="outdoor-athletics">Outdoor</option>
													<option value="road-running">Road Running</option>
													<option value="cross-country">Cross Country</option>
													<option value="trail-running">Trail Running</option>
													<option value="combined-events">Combined Events</option>
													<option value="race-walking">Race Walking</option>
													<option value="diamond-league">Diamond League</option>
												</select>
												<select
													className="border border-[#f0f0f0] rounded-md mt-2 mb-2 ml-1 mr-2 px-2 w-1/2"
													value={p.iconColor}
													onChange={(e) =>
														updatePoint(p.id, {
															iconColor: e.target.value as Point["iconColor"],
														})
													}
												>
													<option value="red">Red</option>
													<option value="yellow">Yellow</option>
													<option value="orange">Orange</option>
													<option value="green">Green</option>
													<option value="blue">Blue</option>
													<option value="purple">Purple</option>
													<option value="black">Black</option>
													<option value="grey">Grey</option>
													<option value="white">White</option>
												</select>
											</div>
										</div>
									))}
								</>
							) : (
								<div className="text-center">Loading...</div>
							)}
						</div>
						{loaded && isSignedIn ? (
							<div className="border border-[#f0f0f0] bg-[#0f0f0f] rounded-xl m-1 flex flex-row fixed bottom-0 left-1 w-[calc(25%-16px)]">
								<div className="flex flex-col">
									<div className="flex flex-row">
										<input
											className="border border-[#f0f0f0] rounded-md mt-2 ml-2 mr-1 px-2 w-1/2"
											value={name}
											onChange={(e) => setName(e.target.value)}
											placeholder="Name"
											onKeyDown={(e) => {
												if (e.key === "Enter" && !e.repeat) addPoint();
											}}
										/>
										<input
											className="border border-[#f0f0f0] rounded-md mt-2 ml-1 mr-2 px-2 w-1/2"
											value={date}
											onChange={(e) => setDate(e.target.value)}
											placeholder="Date (DD/MM/YYYY)"
											onKeyDown={(e) => {
												if (e.key === "Enter" && !e.repeat) addPoint();
											}}
										/>
									</div>

									<div className="flex flex-row">
										<input
											className="border border-[#f0f0f0] rounded-md mt-2 ml-2 mr-1 px-2 w-1/2"
											value={lat}
											onChange={(e) => setLat(e.target.value)}
											placeholder="Latitude"
											onKeyDown={(e) => {
												if (e.key === "Enter" && !e.repeat) addPoint();
											}}
										/>
										<input
											className="border border-[#f0f0f0] rounded-md mt-2 ml-1 mr-2 px-2 w-1/2"
											value={lng}
											onChange={(e) => setLng(e.target.value)}
											placeholder="Longitude"
											onKeyDown={(e) => {
												if (e.key === "Enter" && !e.repeat) addPoint();
											}}
										/>
									</div>
									<div className="flex flex-row">
										<select
											className="border border-[#f0f0f0] rounded-md mt-2 mb-2 ml-2 mr-1 px-2 w-1/2"
											value={icon}
											onChange={(e) => setIcon(e.target.value as Point["icon"])}
										>
											<option value="indoor-athletics">Indoor</option>
											<option value="outdoor-athletics">Outdoor</option>
											<option value="road-running">Road Running</option>
											<option value="cross-country">Cross Country</option>
											<option value="trail-running">Trail Running</option>
											<option value="combined-events">Combined Events</option>
											<option value="race-walking">Race Walking</option>
											<option value="diamond-league">Diamond League</option>
										</select>
										<select
											className="border border-[#f0f0f0] rounded-md mt-2 mb-2 ml-1 mr-2 px-2 w-1/2"
											value={color}
											onChange={(e) => setColor(e.target.value as Point["iconColor"])}
										>
											<option value="red">Red</option>
											<option value="yellow">Yellow</option>
											<option value="orange">Orange</option>
											<option value="green">Green</option>
											<option value="blue">Blue</option>
											<option value="purple">Purple</option>
											<option value="black">Black</option>
											<option value="grey">Grey</option>
											<option value="white">White</option>
										</select>
									</div>
								</div>
								<button
									className="border border-[#f0f0f0] rounded-md mt-2 mb-2 mr-2 px-2"
									onClick={() => addPoint()}
								>
									Add
								</button>
							</div>
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
