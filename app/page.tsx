"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import MapView from "@/components/MapView";
import Chat from "@/components/Chat";
import EventTree from "@/components/EventTree";
import PlacementSelect from "@/components/PlacementSelect";
import ColorSelect from "@/components/ColorSelect";
import { SettingsIcon, UserIcon } from "@/components/Icons";
import {
	editsLockedEvent,
	EVENT_ICONS,
	EventColor,
	EventIcon,
	ICON_LABELS,
	Layer,
	MapEvent,
	MapGroup,
} from "@/utils/types";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useChat } from "@ai-sdk/react";
import { Show, SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import * as eventsSync from "@/utils/eventsSync";
import * as groupsSync from "@/utils/groupsSync";
import { flushAllUpdates, hasUnsavedChanges, newId } from "@/utils/sync";
import {
	isShownOnMap,
	parsePlacementValue,
	Placement,
	placementOf,
	UNGROUPED,
} from "@/utils/groups";
import { daysBetween, formatNzDate, parseNzDate } from "@/utils/dates";
import { getOpenaiApiKey, setOpenaiApiKey, useOpenaiApiKey } from "@/utils/openaiApiKey";
import {
	AddEventInput,
	AddGroupInput,
	AddLayerInput,
	DeleteEventInput,
	DeleteGroupInput,
	DeleteLayerInput,
	EditEventInput,
	EditGroupInput,
	EditLayerInput,
	SetCollapsedInput,
	SetLockedInput,
	SetTravelNoteInput,
	SetVisibilityInput,
} from "@/utils/chatTools";
import { loadEvents } from "@/utils/migrate";
import { geocodeAddress } from "@/utils/geocode";

const chatTransport = new DefaultChatTransport({
	api: "/api/chat",
	headers: (): Record<string, string> => {
		const key = getOpenaiApiKey();
		return key ? { "x-openai-api-key": key } : {};
	},
});

export default function Home() {
	const [name, setName] = useState("");
	const [date, setDate] = useState("");
	const [address, setAddress] = useState("");
	const [lat, setLat] = useState("");
	const [lng, setLng] = useState("");
	const [icon, setIcon] = useState<EventIcon>("indoor-athletics");
	const [color, setColor] = useState<EventColor>("red");
	const [placement, setPlacement] = useState<Placement>(UNGROUPED);
	const [events, setEvents] = useState<MapEvent[]>([]);
	const [groups, setGroups] = useState<MapGroup[]>([]);
	const [layers, setLayers] = useState<Layer[]>([]);
	const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [hoveredEventId, setHoveredEventId] = useState<number | null>(null);
	const [selectedTab, setSelectedTab] = useState<"events" | "chat">("events");
	const [settings, setSettings] = useState({ alwaysShowHoverMenus: false, showDatesOnMap: false });
	const [copied, setCopied] = useState(false);
	const [showApiKey, setShowApiKey] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [addFormOpen, setAddFormOpen] = useState(false);
	const addNameRef = useRef<HTMLInputElement>(null);
	const openaiApiKey = useOpenaiApiKey();
	const eventsRef = useRef(events);
	const groupsRef = useRef(groups);
	const layersRef = useRef(layers);
	// The add form's last address lookup, reused until the address changes (e.g. blur then submit)
	const formLookup = useRef<{
		address: string;
		result: Promise<{ lat: string; lng: string } | null>;
	}>(null);
	const { isLoaded: authLoaded, isSignedIn, userId } = useAuth();

	const loaded = isSignedIn === true && loadedUserId === userId;
	const visibleEvents = loaded
		? events.filter((event) => isShownOnMap(event, groups, layers))
		: [];

	useEffect(() => {
		eventsRef.current = events;
	}, [events]);

	useEffect(() => {
		groupsRef.current = groups;
	}, [groups]);

	useEffect(() => {
		layersRef.current = layers;
	}, [layers]);

	useEffect(() => {
		// Ask before leaving while changes are still saving, since requests cut off by the reload are lost
		function warnIfUnsaved(e: BeforeUnloadEvent) {
			flushAllUpdates();
			if (hasUnsavedChanges()) e.preventDefault();
		}
		window.addEventListener("beforeunload", warnIfUnsaved);
		window.addEventListener("pagehide", flushAllUpdates);
		return () => {
			window.removeEventListener("beforeunload", warnIfUnsaved);
			window.removeEventListener("pagehide", flushAllUpdates);
		};
	}, []);

	useEffect(() => {
		// Ready to type on opening, but not on phones, where it would throw the keyboard over the form
		if (addFormOpen && window.matchMedia("(min-width: 768px)").matches) addNameRef.current?.focus();
	}, [addFormOpen]);

	useEffect(() => {
		if (!isSignedIn) return;

		let cancelled = false;
		Promise.all([loadEvents(), groupsSync.fetchGroups()])
			.then(([loadedEvents, loadedGroups]) => {
				if (cancelled) return;
				setEvents(loadedEvents);
				setGroups(loadedGroups.groups);
				setLayers(loadedGroups.layers);
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

	/** Changes an event. Does nothing to a locked one, unless the change is just to its lock. */
	function updateEvent(id: number, changes: Partial<MapEvent>) {
		const event = eventsRef.current.find((e) => e.id === id);
		if (!event || editsLockedEvent(event, changes)) return;
		// Keep the ref current, so a second change in the same tick (e.g. unlock then edit) sees this one
		eventsRef.current = eventsRef.current.map((e) => (e.id === id ? { ...e, ...changes } : e));
		setEvents((prev) => {
			const next = prev.map((event) =>
				event.id === id ? { ...event, ...changes } : event,
			);
			return changes.date !== undefined
				? next.sort((a, b) => a.date.getTime() - b.date.getTime())
				: next;
		});
		if ("locked" in changes) {
			// Send the lock on its own, after any edits still waiting to go out. Merged into one
			// request, "unlock, edit, lock again" would reach the server as an edit to a locked event.
			flushAllUpdates();
			eventsSync.updateEvent(id, changes);
			flushAllUpdates();
		} else {
			eventsSync.updateEvent(id, changes);
		}
	}

	/** Shows or hides many events, groups and layers at once. Locked events are left as they are. */
	function setVisibility(
		visible: boolean,
		ids: { eventIds: number[]; groupIds: number[]; layerIds: number[] },
	) {
		const locked = new Set(eventsRef.current.filter((e) => e.locked).map((e) => e.id));
		const eventIds = new Set(ids.eventIds.filter((id) => !locked.has(id)));
		const groupIds = new Set(ids.groupIds);
		const layerIds = new Set(ids.layerIds);
		setEvents((prev) =>
			prev.map((event) => (eventIds.has(event.id) ? { ...event, visible } : event)),
		);
		setGroups((prev) =>
			prev.map((group) => (groupIds.has(group.id) ? { ...group, visible } : group)),
		);
		setLayers((prev) =>
			prev.map((layer) => (layerIds.has(layer.id) ? { ...layer, visible } : layer)),
		);
		for (const id of eventIds) eventsSync.updateEvent(id, { visible });
		for (const id of groupIds) groupsSync.updateGroup(id, { visible });
		for (const id of layerIds) groupsSync.updateLayer(id, { visible });
	}

	/** Collapses or expands many events, groups and layers in the sidebar at once. */
	function setCollapsed(
		collapsed: boolean,
		ids: { eventIds: number[]; groupIds: number[]; layerIds: number[] },
	) {
		const eventIds = new Set(ids.eventIds);
		const groupIds = new Set(ids.groupIds);
		const layerIds = new Set(ids.layerIds);
		setEvents((prev) =>
			prev.map((event) => (eventIds.has(event.id) ? { ...event, collapsed } : event)),
		);
		setGroups((prev) =>
			prev.map((group) => (groupIds.has(group.id) ? { ...group, collapsed } : group)),
		);
		setLayers((prev) =>
			prev.map((layer) => (layerIds.has(layer.id) ? { ...layer, collapsed } : layer)),
		);
		for (const id of eventIds) eventsSync.updateEvent(id, { collapsed });
		for (const id of groupIds) groupsSync.updateGroup(id, { collapsed });
		for (const id of layerIds) groupsSync.updateLayer(id, { collapsed });
	}

	/** Deletes an event, unless it's locked. */
	function deleteEvent(id: number) {
		if (eventsRef.current.find((e) => e.id === id)?.locked) return;
		setEvents((prev) => prev.filter((event) => event.id !== id));
		eventsSync.deleteEvent(id);
	}

	function addGroup(fields: Partial<Omit<MapGroup, "id">> = {}): MapGroup {
		const group: MapGroup = {
			name: "",
			visible: true,
			collapsed: false,
			...fields,
			id: newId(),
		};
		setGroups((prev) => [...prev, group]);
		groupsSync.createGroup(group);
		return group;
	}

	function updateGroup(id: number, changes: Partial<MapGroup>) {
		setGroups((prev) =>
			prev.map((group) => (group.id === id ? { ...group, ...changes } : group)),
		);
		groupsSync.updateGroup(id, changes);
	}

	/**
	 * Deletes the group and its layers, but keeps their events, moving them out of the group.
	 * Locked events keep the deleted group's id, which shows them as being in no group.
	 */
	function deleteGroup(id: number) {
		setGroups((prev) => prev.filter((group) => group.id !== id));
		setLayers((prev) => prev.filter((layer) => layer.groupId !== id));
		// Events in the group's layers store the group too, so this catches them as well
		setEvents((prev) =>
			prev.map((event) =>
				event.groupId === id && !event.locked ? { ...event, ...UNGROUPED } : event,
			),
		);
		groupsSync.deleteGroup(id);
	}

	function addLayer(
		groupId: number,
		fields: Partial<Omit<Layer, "id" | "groupId">> = {},
	): Layer {
		const layer: Layer = {
			name: "",
			visible: true,
			collapsed: false,
			...fields,
			id: newId(),
			groupId,
		};
		setLayers((prev) => [...prev, layer]);
		groupsSync.createLayer(layer);
		return layer;
	}

	function updateLayer(id: number, changes: Partial<Layer>) {
		setLayers((prev) =>
			prev.map((layer) => (layer.id === id ? { ...layer, ...changes } : layer)),
		);
		groupsSync.updateLayer(id, changes);
	}

	/**
	 * Deletes the layer, but keeps its events in the layer's group. Locked events keep the deleted
	 * layer's id, which shows them as being straight in the group.
	 */
	function deleteLayer(id: number) {
		setLayers((prev) => prev.filter((layer) => layer.id !== id));
		setEvents((prev) =>
			prev.map((event) =>
				event.layerId === id && !event.locked ? { ...event, layerId: null } : event,
			),
		);
		groupsSync.deleteLayer(id);
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
		address?: string;
		travelNote?: string;
		groupId?: number | null;
		layerId?: number | null;
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
			...UNGROUPED,
			...fields,
			// After the spread, as optional fields can be passed in as undefined, which the API rejects
			description: fields.description ?? "",
			address: fields.address ?? "",
			travelNote: fields.travelNote ?? "",
			id: newId(),
			date: parsedDate,
			visible: true,
			collapsed: false,
			locked: false,
		};
		setEvents((prev) =>
			[...prev, event].sort((a, b) => a.date.getTime() - b.date.getTime()),
		);
		eventsSync.createEvent(event);
		return event;
	}

	/**
	 * Fills the add form's lat/lng from its address. Typing lat/lng by hand afterwards
	 * leaves the address alone.
	 * @returns The coordinates, or null if the address is empty or not found.
	 */
	function lookUpFormAddress(): Promise<{ lat: string; lng: string } | null> {
		const trimmed = address.trim();
		if (trimmed === "") return Promise.resolve(null);
		if (formLookup.current?.address === trimmed) return formLookup.current.result;

		const result = geocodeAddress(trimmed).then((found) => {
			if (formLookup.current?.result !== result) return null; // Superseded by a newer address
			if (!found) {
				setSubmitError(`Couldn't find "${trimmed}".`);
				return null;
			}
			setSubmitError(null);
			const coords = { lat: String(found.latitude), lng: String(found.longitude) };
			setLat(coords.lat);
			setLng(coords.lng);
			return coords;
		});
		formLookup.current = { address: trimmed, result };
		return result;
	}

	async function handleAddEventSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		let coords = { lat, lng };
		// Pressing Enter in the address box submits before it blurs, so look it up here too
		if (lat.trim() === "" || lng.trim() === "") {
			const found = await lookUpFormAddress();
			if (!found) {
				if (address.trim() === "") setSubmitError("Enter an address or coordinates.");
				return;
			}
			coords = found;
		}
		// The picked group or layer may have been deleted since
		const { group, layer } = placementOf(placement, groups, layers);
		const added = addEvent({
			name,
			date,
			address,
			lat: Number(coords.lat),
			lng: Number(coords.lng),
			icon,
			iconColor: color,
			groupId: group?.id ?? null,
			layerId: layer?.id ?? null,
		});
		if (!added) return;
		setSubmitError(null);
		setName("");
		setDate("");
		setAddress("");
		formLookup.current = null;
		setLat("");
		setLng("");
	}

	function copyShareLink() {
		navigator.clipboard.writeText(`${window.location.origin}/share/${userId}`);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	/** Each stretch of the map's route line: every shown event to the next one, by date. */
	function shownLegs() {
		const shown = eventsRef.current.filter((event) =>
			isShownOnMap(event, groupsRef.current, layersRef.current),
		);
		return shown.slice(1).map((to, i) => ({ from: shown[i], to }));
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

			const lockedMessage = (id: number) =>
				`Event ${id} is locked, so it can't be changed. Only unlock it (with setEventsLocked) if the user asks to.`;

			// The AI SDK has already checked each input against the schemas in utils/chatTools.ts
			if (toolCall.toolName === "addEvent") {
				const input = toolCall.input as AddEventInput;
				if (
					input.groupId !== undefined &&
					!groupsRef.current.some((group) => group.id === input.groupId)
				) {
					respond(`No group with id ${input.groupId}`);
					return;
				}
				if (
					input.layerId !== undefined &&
					!layersRef.current.some((layer) => layer.id === input.layerId)
				) {
					respond(`No layer with id ${input.layerId}`);
					return;
				}
				// A layer's own group wins over a separately given group
				const placement = parsePlacementValue(
					input.layerId !== undefined
						? `l:${input.layerId}`
						: input.groupId !== undefined
							? `g:${input.groupId}`
							: "",
					layersRef.current,
				);
				const event = addEvent({
					name: input.name,
					date: input.date,
					lat: input.latitude,
					lng: input.longitude,
					icon: input.icon ?? "outdoor-athletics",
					iconColor: input.iconColor ?? "grey",
					description: input.description,
					address: input.address,
					travelNote: input.travelNote,
					...placement,
				});
				respond(
					event
						? `Added event "${event.name}" with id ${event.id}`
						: `Invalid date "${input.date}", use DD/MM/YYYY`,
				);
			} else if (toolCall.toolName === "editEvent") {
				const input = toolCall.input as EditEventInput;
				const existing = eventsRef.current.find((event) => event.id === input.id);
				if (!existing) {
					respond(`No event with id ${input.id}`);
					return;
				}
				if (existing.locked) {
					respond(lockedMessage(input.id));
					return;
				}
				const changes: Partial<MapEvent> = {};
				if (input.name !== undefined) changes.name = input.name;
				if (input.description !== undefined) changes.description = input.description;
				if (input.address !== undefined) changes.address = input.address;
				if (input.travelNote !== undefined) changes.travelNote = input.travelNote;
				if (input.latitude !== undefined) changes.lat = input.latitude;
				if (input.longitude !== undefined) changes.lng = input.longitude;
				if (input.icon !== undefined) changes.icon = input.icon;
				if (input.iconColor !== undefined) changes.iconColor = input.iconColor;
				if (
					typeof input.groupId === "number" &&
					!groupsRef.current.some((group) => group.id === input.groupId)
				) {
					respond(`No group with id ${input.groupId}`);
					return;
				}
				if (
					typeof input.layerId === "number" &&
					!layersRef.current.some((layer) => layer.id === input.layerId)
				) {
					respond(`No layer with id ${input.layerId}`);
					return;
				}
				// Group and layer are always set together, like the placement dropdown does, as a
				// leftover layer would otherwise keep the event in that layer's group
				if (typeof input.layerId === "number") {
					Object.assign(changes, parsePlacementValue(`l:${input.layerId}`, layersRef.current));
				} else if (typeof input.groupId === "number") {
					changes.groupId = input.groupId;
					changes.layerId = null;
				} else if (input.groupId === null) {
					Object.assign(changes, UNGROUPED);
				} else if (input.layerId === null) {
					// Out of its layer, into the bare group it was in
					const current = eventsRef.current.find((event) => event.id === input.id)!;
					const { group } = placementOf(current, groupsRef.current, layersRef.current);
					changes.groupId = group?.id ?? null;
					changes.layerId = null;
				}
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
				const existing = eventsRef.current.find((event) => event.id === input.id);
				if (!existing) {
					respond(`No event with id ${input.id}`);
					return;
				}
				if (existing.locked) {
					respond(lockedMessage(input.id));
					return;
				}
				deleteEvent(input.id);
				respond(`Deleted event ${input.id}`);
			} else if (toolCall.toolName === "listEvents") {
				const list = eventsRef.current.map((event) => ({
					id: event.id,
					name: event.name,
					description: event.description,
					address: event.address,
					date: formatNzDate(event.date),
					latitude: event.lat,
					longitude: event.lng,
					icon: event.icon,
					iconColor: event.iconColor,
					visible: event.visible,
					collapsed: event.collapsed,
					groupId: event.groupId,
					layerId: event.layerId,
					travelNote: event.travelNote,
					locked: event.locked,
				}));
				respond(JSON.stringify(list));
			} else if (toolCall.toolName === "listLegs") {
				const list = shownLegs().map(({ from, to }) => ({
					fromEventId: from.id,
					fromName: from.name,
					fromDate: formatNzDate(from.date),
					toEventId: to.id,
					toName: to.name,
					toDate: formatNzDate(to.date),
					days: daysBetween(from.date, to.date),
					travelNote: to.travelNote,
					// The notes are stored on the event the stretch leads to, so they lock with it
					locked: to.locked,
				}));
				respond(JSON.stringify(list));
			} else if (toolCall.toolName === "setTravelNote") {
				const input = toolCall.input as SetTravelNoteInput;
				const leg = shownLegs().find(
					({ from, to }) => from.id === input.fromEventId && to.id === input.toEventId,
				);
				if (!leg) {
					respond(
						`Events ${input.fromEventId} and ${input.toEventId} aren't next to each other on the map. Use listLegs to find the stretches.`,
					);
					return;
				}
				if (leg.to.locked) {
					respond(lockedMessage(leg.to.id));
					return;
				}
				// The notes for a stretch are stored on the event it leads to
				updateEvent(leg.to.id, { travelNote: input.travelNote });
				respond(`Set the travel notes from event ${leg.from.id} to event ${leg.to.id}`);
			} else if (toolCall.toolName === "listGroups") {
				const list = groupsRef.current.map((group) => ({
					id: group.id,
					name: group.name,
					visible: group.visible,
					collapsed: group.collapsed,
					layers: layersRef.current
						.filter((layer) => layer.groupId === group.id)
						.map((layer) => ({
							id: layer.id,
							name: layer.name,
							visible: layer.visible,
							collapsed: layer.collapsed,
						})),
				}));
				respond(JSON.stringify(list));
			} else if (toolCall.toolName === "addGroup") {
				const input = toolCall.input as AddGroupInput;
				const group = addGroup({ name: input.name, visible: input.visible ?? true });
				respond(`Added group "${group.name}" with id ${group.id}`);
			} else if (toolCall.toolName === "editGroup") {
				const input = toolCall.input as EditGroupInput;
				if (!groupsRef.current.some((group) => group.id === input.id)) {
					respond(`No group with id ${input.id}`);
					return;
				}
				const changes: Partial<MapGroup> = {};
				if (input.name !== undefined) changes.name = input.name;
				if (input.visible !== undefined) changes.visible = input.visible;
				updateGroup(input.id, changes);
				respond(`Edited group ${input.id}`);
			} else if (toolCall.toolName === "deleteGroup") {
				const input = toolCall.input as DeleteGroupInput;
				if (!groupsRef.current.some((group) => group.id === input.id)) {
					respond(`No group with id ${input.id}`);
					return;
				}
				deleteGroup(input.id);
				respond(`Deleted group ${input.id}`);
			} else if (toolCall.toolName === "addLayer") {
				const input = toolCall.input as AddLayerInput;
				if (!groupsRef.current.some((group) => group.id === input.groupId)) {
					respond(`No group with id ${input.groupId}`);
					return;
				}
				const layer = addLayer(input.groupId, {
					name: input.name,
					visible: input.visible ?? true,
				});
				respond(`Added layer "${layer.name}" with id ${layer.id}`);
			} else if (toolCall.toolName === "editLayer") {
				const input = toolCall.input as EditLayerInput;
				if (!layersRef.current.some((layer) => layer.id === input.id)) {
					respond(`No layer with id ${input.id}`);
					return;
				}
				const changes: Partial<Layer> = {};
				if (input.name !== undefined) changes.name = input.name;
				if (input.visible !== undefined) changes.visible = input.visible;
				updateLayer(input.id, changes);
				respond(`Edited layer ${input.id}`);
			} else if (toolCall.toolName === "deleteLayer") {
				const input = toolCall.input as DeleteLayerInput;
				if (!layersRef.current.some((layer) => layer.id === input.id)) {
					respond(`No layer with id ${input.id}`);
					return;
				}
				deleteLayer(input.id);
				respond(`Deleted layer ${input.id}`);
			} else if (toolCall.toolName === "hideItems" || toolCall.toolName === "showItems") {
				const input = toolCall.input as SetVisibilityInput;
				const visible = toolCall.toolName === "showItems";
				const eventIds = input.allEvents
					? eventsRef.current.map((event) => event.id)
					: (input.eventIds ?? []);
				const groupIds = input.groupIds ?? [];
				const layerIds = input.layerIds ?? [];
				const missing = [
					...eventIds
						.filter((id) => !eventsRef.current.some((event) => event.id === id))
						.map((id) => `event ${id}`),
					...groupIds
						.filter((id) => !groupsRef.current.some((group) => group.id === id))
						.map((id) => `group ${id}`),
					...layerIds
						.filter((id) => !layersRef.current.some((layer) => layer.id === id))
						.map((id) => `layer ${id}`),
				];
				if (missing.length > 0) {
					respond(`Nothing changed. These don't exist: ${missing.join(", ")}`);
					return;
				}
				if (eventIds.length + groupIds.length + layerIds.length === 0) {
					respond("Nothing changed, no ids were given");
					return;
				}
				// Locked events are skipped, and the rest still go ahead
				const skipped = eventIds.filter(
					(id) => eventsRef.current.find((event) => event.id === id)?.locked,
				);
				setVisibility(visible, { eventIds, groupIds, layerIds });
				respond(
					`${visible ? "Showed" : "Hid"} ${eventIds.length - skipped.length} events, ${groupIds.length} groups and ${layerIds.length} layers` +
						(skipped.length > 0
							? `. Skipped ${skipped.length} locked events: ${skipped.join(", ")}`
							: ""),
				);
			} else if (
				toolCall.toolName === "collapseItems" ||
				toolCall.toolName === "expandItems"
			) {
				const input = toolCall.input as SetCollapsedInput;
				const collapsed = toolCall.toolName === "collapseItems";
				const eventIds = input.allEvents
					? eventsRef.current.map((event) => event.id)
					: (input.eventIds ?? []);
				const groupIds = input.allGroups
					? groupsRef.current.map((group) => group.id)
					: (input.groupIds ?? []);
				const layerIds = input.allLayers
					? layersRef.current.map((layer) => layer.id)
					: (input.layerIds ?? []);
				const missing = [
					...eventIds
						.filter((id) => !eventsRef.current.some((event) => event.id === id))
						.map((id) => `event ${id}`),
					...groupIds
						.filter((id) => !groupsRef.current.some((group) => group.id === id))
						.map((id) => `group ${id}`),
					...layerIds
						.filter((id) => !layersRef.current.some((layer) => layer.id === id))
						.map((id) => `layer ${id}`),
				];
				if (missing.length > 0) {
					respond(`Nothing changed. These don't exist: ${missing.join(", ")}`);
					return;
				}
				if (eventIds.length + groupIds.length + layerIds.length === 0) {
					respond("Nothing changed, no ids were given");
					return;
				}
				setCollapsed(collapsed, { eventIds, groupIds, layerIds });
				respond(
					`${collapsed ? "Collapsed" : "Expanded"} ${eventIds.length} events, ${groupIds.length} groups and ${layerIds.length} layers`,
				);
			} else if (toolCall.toolName === "setEventsLocked") {
				const input = toolCall.input as SetLockedInput;
				const missing = input.eventIds.filter(
					(id) => !eventsRef.current.some((event) => event.id === id),
				);
				if (missing.length > 0) {
					respond(`Nothing changed. No events with ids ${missing.join(", ")}`);
					return;
				}
				if (input.eventIds.length === 0) {
					respond("Nothing changed, no ids were given");
					return;
				}
				for (const id of input.eventIds) updateEvent(id, { locked: input.locked });
				respond(`${input.locked ? "Locked" : "Unlocked"} ${input.eventIds.length} events`);
			} else if (toolCall.toolName === "geoLookup") {
				// Executed on the server (OpenStreetMap), output arrives in the stream
				return;
			} else {
				respond(`Tool ${toolCall.toolName} is not implemented yet`);
			}
		},
	});


	const tabs = [
		{ id: "events", label: "Events" },
		{ id: "chat", label: "Chat" },
	] as const;

	return (
		// Side by side on wide screens, sidebar on the left; on phones the map sits on top and the
		// sidebar below. The sidebar comes first in the page, so on phones keyboard and screen
		// reader order reach it before the map even though it's drawn underneath.
		<main className="flex h-dvh flex-col-reverse overflow-hidden md:flex-row">
			<aside className="panel-scheme flex min-h-0 flex-1 flex-col border-t border-line bg-panel text-panel-foreground md:w-[clamp(380px,30vw,460px)] md:flex-none md:border-t-0 md:border-r">
				<header className="px-4 pt-3">
					<div className="flex items-center justify-between gap-3">
						<h1 className="font-display text-xl leading-tight font-semibold">
							Mapline Point Date Thingy
						</h1>
						<div className="flex shrink-0 items-center gap-2">
							<Show when="signed-out">
								<SignInButton>
									<button className="button">
										<UserIcon size={18} />
										Sign in
									</button>
								</SignInButton>
							</Show>
							<Show when="signed-in">
								<button
									className="button"
									title="Copy a link to a read-only copy of your map"
									onClick={copyShareLink}
								>
									<span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
								</button>
								<UserButton>
									<UserButton.UserProfilePage
										label="Settings"
										labelIcon={<SettingsIcon size={16} />}
										url="settings"
									>
										<div className="flex flex-col">
											<h1 className="text-[17px] font-bold">Settings</h1>
											<div className="border-b border-current/15 mt-3.75 mb-5" />
											<label className="flex flex-row items-center gap-1 text-[13px]">
												<input
													className="size-4"
													type="checkbox"
													checked={settings.alwaysShowHoverMenus}
													onChange={(e) =>
														setSettings((prev) => ({
															...prev,
															alwaysShowHoverMenus: e.target.checked,
														}))
													}
												/>
												Always show every event&apos;s menu on the map
											</label>
											<label className="flex flex-row items-center gap-1 text-[13px] mt-2">
												<input
													className="size-4"
													type="checkbox"
													checked={settings.showDatesOnMap}
													onChange={(e) =>
														setSettings((prev) => ({
															...prev,
															showDatesOnMap: e.target.checked,
														}))
													}
												/>
												Show dates on the map
											</label>
											<div className="border-b border-current/15 mt-3.75 mb-5" />
											<label htmlFor="openai-api-key" className="text-[13px] font-medium">
												OpenAI API key
											</label>
											<div className="flex flex-row mt-1">
												<input
													id="openai-api-key"
													className="border border-current/30 rounded-md px-2 py-1 text-[13px] grow"
													type={showApiKey ? "text" : "password"}
													autoComplete="off"
													spellCheck={false}
													placeholder="sk-..."
													value={openaiApiKey}
													onChange={(e) => setOpenaiApiKey(e.target.value)}
												/>
												<button
													className="border border-current/30 rounded-md ml-1 px-2 text-[13px]"
													onClick={() => setShowApiKey((v) => !v)}
												>
													{showApiKey ? "Hide" : "Show"}
												</button>
												<button
													className="border border-current/30 rounded-md ml-1 px-2 text-[13px]"
													onClick={() => setOpenaiApiKey("")}
												>
													Clear
												</button>
											</div>
											<p className="text-[11px] opacity-70 mt-1">
												Stored only in this browser&apos;s local storage. It&apos;s sent with
												each chat request to reach OpenAI, but never saved on the server.
											</p>
										</div>
									</UserButton.UserProfilePage>
								</UserButton>
							</Show>
						</div>
					</div>
					<div
						role="tablist"
						aria-label="Sidebar"
						className="mt-3 flex gap-6"
						onKeyDown={(e) => {
							// Arrow keys move between the tabs, as for any tab list
							if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
							const next = selectedTab === "events" ? "chat" : "events";
							setSelectedTab(next);
							document.getElementById(`tab-${next}`)?.focus();
						}}
					>
						{tabs.map((tab) => (
							<button
								key={tab.id}
								id={`tab-${tab.id}`}
								role="tab"
								aria-selected={selectedTab === tab.id}
								// Only the shown panel exists, so only its tab points at it
								aria-controls={selectedTab === tab.id ? `panel-${tab.id}` : undefined}
								tabIndex={selectedTab === tab.id ? 0 : -1}
								className={`relative z-10 -mb-0.5 border-b-2 pt-1 pb-2 font-display text-lg font-semibold ${selectedTab === tab.id ? "border-accent text-panel-foreground" : "border-transparent text-muted hover:text-panel-foreground"}`}
								onClick={() => setSelectedTab(tab.id)}
							>
								{tab.label}
							</button>
						))}
					</div>
				</header>
				{/* Lane lines, the panel's one ornament, closing off the header */}
				<div
					aria-hidden="true"
					className="h-[10px] shrink-0 border-t-2 border-panel-foreground/40 bg-[linear-gradient(to_bottom,transparent_4px,rgb(238_242_252/0.25)_4px,rgb(238_242_252/0.25)_6px,transparent_6px)]"
				/>
				{selectedTab === "events" ? (
					<div
						id="panel-events"
						role="tabpanel"
						aria-labelledby="tab-events"
						className="flex min-h-0 flex-1 flex-col"
					>
						{/* On phones an open add form takes the list's place, as there's no room for both */}
						<div
							className={`min-h-0 flex-1 overflow-y-auto px-2 pb-3 ${addFormOpen ? "max-md:hidden" : ""}`}
						>
							{!authLoaded ? (
								<p className="px-2 py-6 text-muted">Loading…</p>
							) : !isSignedIn ? (
								<p className="px-2 py-6 text-muted">
									Sign in to plan your events and see them on the map.
								</p>
							) : loadError ? (
								<p className="px-2 py-6 text-danger">
									{loadError} Reload the page to try again.
								</p>
							) : loaded ? (
								<>
									<div className="flex items-center justify-between px-2 pt-1 pb-1">
										<p className="text-sm text-muted">
											{events.length === 1 ? "1 event" : `${events.length} events`}
											{groups.length > 0
												? `, ${groups.length === 1 ? "1 group" : `${groups.length} groups`}`
												: ""}
										</p>
										<button className="button h-7 px-2 text-sm pointer-coarse:h-10" onClick={() => addGroup()}>
											New group
										</button>
									</div>
									{events.length === 0 && groups.length === 0 ? (
										<p className="px-2 py-6 text-muted">
											No events yet. Add your first one below, or ask the chat to add a few.
										</p>
									) : (
										<EventTree
											events={events}
											groups={groups}
											layers={layers}
											onUpdateEvent={updateEvent}
											onDeleteEvent={deleteEvent}
											onUpdateGroup={updateGroup}
											onDeleteGroup={deleteGroup}
											onAddLayer={addLayer}
											onUpdateLayer={updateLayer}
											onDeleteLayer={deleteLayer}
											onHoverEvent={setHoveredEventId}
										/>
									)}
								</>
							) : (
								<p className="px-2 py-6 text-muted">Loading your events…</p>
							)}
						</div>
						{loaded && !addFormOpen ? (
							<div className="shrink-0 border-t border-line px-4 py-3">
								<button
									className="button-primary w-full"
									onClick={() => setAddFormOpen(true)}
								>
									Add an event
								</button>
							</div>
						) : null}
						{loaded && addFormOpen ? (
							<form
								id="add-event-form"
								// Scrolls on its own when there isn't room, e.g. on a phone with the keyboard open
								className="shrink-0 overflow-y-auto border-t max-md:min-h-0 max-md:flex-1 md:max-h-[65%] border-line bg-panel-sunken/60 px-4 pt-3 pb-4"
								aria-labelledby="add-event-heading"
								onSubmit={handleAddEventSubmit}
							>
								<div className="flex items-center justify-between">
									<h2
										id="add-event-heading"
										className="font-display text-base leading-tight font-semibold"
									>
										Add an event
									</h2>
									<button
										type="button"
										className="button h-7 border-transparent px-2 text-sm text-muted pointer-coarse:h-10 hover:text-panel-foreground"
										onClick={() => {
											setAddFormOpen(false);
											setSubmitError(null);
										}}
									>
										Close
									</button>
								</div>
								<div className="mt-2 grid grid-cols-2 gap-2">
									<input
										className="field"
										aria-label="Name"
										ref={addNameRef}
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="Name"
									/>
									<input
										className="field tabular-nums"
										aria-label="Date, DD/MM/YYYY. Leave empty for today."
										value={date}
										onChange={(e) => setDate(e.target.value)}
										placeholder="DD/MM/YYYY"
									/>
									<input
										className="field col-span-2"
										aria-label="Address"
										value={address}
										onChange={(e) => setAddress(e.target.value)}
										onBlur={lookUpFormAddress}
										placeholder="Address, or fill in the coordinates"
									/>
									<input
										className="field tabular-nums"
										aria-label="Latitude"
										value={lat}
										onChange={(e) => setLat(e.target.value)}
										placeholder="Latitude"
									/>
									<input
										className="field tabular-nums"
										aria-label="Longitude"
										value={lng}
										onChange={(e) => setLng(e.target.value)}
										placeholder="Longitude"
									/>
									<select
										className="field"
										aria-label="Icon"
										value={icon}
										onChange={(e) => setIcon(e.target.value as EventIcon)}
									>
										{EVENT_ICONS.map((icon) => (
											<option key={icon} value={icon}>
												{ICON_LABELS[icon]}
											</option>
										))}
									</select>
									<ColorSelect
										className="flex min-w-0 gap-2"
										selectClassName="field flex-1"
										value={color}
										onChange={setColor}
									/>
									<PlacementSelect
										className="field col-span-2"
										value={placement}
										groups={groups}
										layers={layers}
										onChange={setPlacement}
									/>
								</div>
								{submitError ? (
									<p role="alert" className="mt-2 text-sm text-danger">
										{submitError}
									</p>
								) : null}
								<button type="submit" className="button-primary mt-3 w-full">
									Add event
								</button>
							</form>
						) : null}
					</div>
				) : (
					<div
						id="panel-chat"
						role="tabpanel"
						aria-labelledby="tab-chat"
						className="flex min-h-0 flex-1 flex-col"
					>
						<Chat
							messages={messages}
							sendMessage={sendMessage}
							status={status}
							stop={stop}
							hasApiKey={openaiApiKey !== ""}
							error={error}
						/>
					</div>
				)}
			</aside>
			<MapView
				events={visibleEvents}
				alwaysShowHoverMenus={settings.alwaysShowHoverMenus}
				showDates={settings.showDatesOnMap}
				onUpdate={updateEvent}
				onDelete={deleteEvent}
				groups={groups}
				layers={layers}
				highlightedId={hoveredEventId}
			/>

		</main>
	);
}
