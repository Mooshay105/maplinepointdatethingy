"use client";

// Google Maps is loaded from a script tag, so it has no TypeScript types here and is typed as `any`.
// Installing @types/google.maps would let us replace these.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
	colorHex,
	EventColor,
	EventIcon,
	Layer,
	MapEvent,
	MapGroup,
	readableOn,
} from "@/utils/types";
import { daysBetween, formatNzDate } from "@/utils/dates";
import EventEditor from "./EventEditor";
import { LayersIcon } from "./Icons";

// Maps JavaScript API keys are public by design (they end up in the browser); restrict them by
// HTTP referrer in the Google Cloud console instead of keeping them secret.
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

let mapsPromise: Promise<any> | null = null;

function loadGoogleMaps(): Promise<any> {
	if (mapsPromise) return mapsPromise;

	mapsPromise = new Promise((resolve, reject) => {
		if ((window as any).google?.maps) {
			return resolve((window as any).google);
		}
		const script = document.createElement("script");
		script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
		script.async = true;
		script.onload = () => resolve((window as any).google);
		script.onerror = () => {
			mapsPromise = null;
			reject(new Error("Failed to load Google Maps"));
		};
		document.head.appendChild(script);
	});

	return mapsPromise;
}

const urlCache = new Map<string, string>();

/**
 * Loads /public/icons/<icon>.svg and recolours it as a data URL for a map marker.
 * The files draw the disc in #707070 and the glyph in #ffffff, which are swapped for the marker's colours.
 */
async function iconUrl(icon: EventIcon, color: EventColor): Promise<string> {
	const key = `${icon}|${color}`;
	const hit = urlCache.get(key);
	if (hit) return hit;

	const disc = colorHex(color);
	const glyph = readableOn(disc);
	const svg = await (await fetch(`/icons/${icon}.svg`)).text();
	const url =
		"data:image/svg+xml;charset=UTF-8," +
		encodeURIComponent(svg.replaceAll("#707070", disc).replaceAll("#ffffff", glyph));

	urlCache.set(key, url);
	return url;
}

/** How long a hover menu lingers after the mouse leaves, so it can travel from the marker into the menu. */
const HOVER_HIDE_DELAY_MS = 250;

/** Remembers whether the map was last shown as satellite, across reloads. */
const SATELLITE_STORAGE_KEY = "mapSatellite";

const MARKER_SIZE = 20;
/** A highlighted marker (e.g. its event is hovered in the sidebar) is drawn bigger and on top. */
const HIGHLIGHTED_MARKER_SIZE = 32;

function markerIcon(google: any, url: string, highlighted: boolean) {
	const size = highlighted ? HIGHLIGHTED_MARKER_SIZE : MARKER_SIZE;
	return {
		url,
		scaledSize: new google.maps.Size(size, size),
		anchor: new google.maps.Point(size / 2, size / 2),
	};
}

function formatDays(days: number): string {
	if (days === 0) return "Same day";
	return `${days} ${Math.abs(days) === 1 ? "day" : "days"}`;
}

/** The point halfway along the great circle between two points, where the geodesic line passes. */
function midpoint(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
	const rad = Math.PI / 180;
	const lat1 = a.lat * rad;
	const lat2 = b.lat * rad;
	const dLng = (b.lng - a.lng) * rad;
	const bx = Math.cos(lat2) * Math.cos(dLng);
	const by = Math.cos(lat2) * Math.sin(dLng);
	const lat = Math.atan2(
		Math.sin(lat1) + Math.sin(lat2),
		Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2),
	);
	const lng = a.lng * rad + Math.atan2(by, Math.cos(lat1) + bx);
	// Wrap back into -180..180
	return { lat: lat / rad, lng: ((((lng / rad + 180) % 360) + 360) % 360) - 180 };
}

export default function MapView({
	events,
	fullScreen,
	alwaysShowHoverMenus = false,
	showDates = false,
	onUpdate,
	onDelete,
	groups,
	layers,
	highlightedId = null,
}: {
	events: MapEvent[];
	fullScreen?: boolean;
	alwaysShowHoverMenus?: boolean;
	/** Shows each event's date under its marker. */
	showDates?: boolean;
	onUpdate?: (id: number, changes: Partial<MapEvent>) => void;
	onDelete?: (id: number) => void;
	/** For the hover menus' group picker. */
	groups?: MapGroup[];
	layers?: Layer[];
	/** Event whose marker to make stand out, e.g. while it's hovered in the sidebar. */
	highlightedId?: number | null;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const mapRef = useRef<any>(null);
	const overlaysRef = useRef<any[]>([]);
	const markersRef = useRef(new Map<number, { marker: any; url: string }>());
	// Markers load asynchronously, so new ones read the current highlight through a ref
	const highlightedIdRef = useRef(highlightedId);
	const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const [map, setMap] = useState<any>(null);
	const [hoveredId, setHoveredId] = useState<number | null>(null);
	// Keeps a menu open while one of its inputs has focus, even if the mouse wanders off
	const [focusedId, setFocusedId] = useState<number | null>(null);
	const [satellite, setSatellite] = useState(false);
	// The stretch whose travel notes are open, drawn above the other labels so none of them covers it
	const [editingLeg, setEditingLeg] = useState<string | null>(null);
	// The markers are rebuilt whenever events change, so read the latest handler through a ref
	// instead of rebuilding them when only onUpdate changes
	const onUpdateRef = useRef(onUpdate);
	useEffect(() => {
		onUpdateRef.current = onUpdate;
	}, [onUpdate]);
	const draggable = onUpdate !== undefined;

	function showMenu(id: number) {
		clearTimeout(hideTimer.current);
		setHoveredId(id);
	}

	function hideMenuSoon() {
		clearTimeout(hideTimer.current);
		hideTimer.current = setTimeout(() => setHoveredId(null), HOVER_HIDE_DELAY_MS);
	}

	useEffect(() => () => clearTimeout(hideTimer.current), []);

	useEffect(() => {
		let cancelled = false;

		loadGoogleMaps().then((google) => {
			if (cancelled || !ref.current) return;

			if (!mapRef.current) {
				mapRef.current = new google.maps.Map(ref.current, {
					center: { lat: 0, lng: 0 },
					zoom: 2,
					disableDefaultUI: true,
				});
				if (localStorage.getItem(SATELLITE_STORAGE_KEY) === "1") setSatellite(true);
				// Touch screens have no hover, so tapping the map closes an open menu (and tapping a marker opens one, below)
				mapRef.current.addListener("click", () => setHoveredId(null));
				setMap(mapRef.current);
			}
			const map = mapRef.current;

			overlaysRef.current.forEach((o) => o.setMap(null));
			overlaysRef.current = [];
			markersRef.current.clear();

			events.forEach(async (event) => {
				const url = await iconUrl(event.icon, event.iconColor);
				// Events changed while the icon loaded; the newer run draws this marker instead
				if (cancelled) return;

				const marker = new google.maps.Marker({
					position: { lat: event.lat, lng: event.lng },
					map,
					// Dragging moves the event; the address is left as typed. Locked events stay put.
					draggable: draggable && !event.locked,
					icon: markerIcon(google, url, event.id === highlightedIdRef.current),
					zIndex: event.id === highlightedIdRef.current ? google.maps.Marker.MAX_ZINDEX : undefined,
				});
				markersRef.current.set(event.id, { marker, url });
				marker.addListener("mouseover", () => showMenu(event.id));
				marker.addListener("mouseout", hideMenuSoon);
				marker.addListener("click", () => showMenu(event.id));
				// Hide the menu while dragging so it doesn't sit over the spot being dropped on
				marker.addListener("dragstart", () => {
					clearTimeout(hideTimer.current);
					setHoveredId(null);
				});
				marker.addListener("dragend", (e: any) => {
					onUpdateRef.current?.(event.id, { lat: e.latLng.lat(), lng: e.latLng.lng() });
				});
				overlaysRef.current.push(marker);
			});

			overlaysRef.current.push(
				new google.maps.Polyline({
					path: events.map((event) => ({ lat: event.lat, lng: event.lng })),
					geodesic: true,
					strokeColor: "#FF0000",
					strokeOpacity: 1,
					strokeWeight: 3,
					map,
					icons: [
						{
							icon: {
								path: google.maps.SymbolPath.FORWARD_OPEN_ARROW,
								scale: 2,
								strokeColor: "#FF0000",
								strokeOpacity: 1,
								strokeWeight: 2,
							},
							offset: "50%",
							repeat: "80px",
						},
					],
				}),
			);
		});

		return () => {
			cancelled = true;
		};
	}, [events, draggable]);

	useEffect(() => {
		// "hybrid" is satellite imagery with the road and place labels on top
		map?.setMapTypeId(satellite ? "hybrid" : "roadmap");
	}, [map, satellite]);

	function toggleSatellite() {
		const next = !satellite;
		setSatellite(next);
		localStorage.setItem(SATELLITE_STORAGE_KEY, next ? "1" : "0");
	}

	useEffect(() => {
		const previous = highlightedIdRef.current;
		highlightedIdRef.current = highlightedId;
		const google = (window as any).google;
		if (!google?.maps) return;
		const old = previous !== null ? markersRef.current.get(previous) : undefined;
		if (old) {
			old.marker.setIcon(markerIcon(google, old.url, false));
			old.marker.setZIndex(undefined);
		}
		const next = highlightedId !== null ? markersRef.current.get(highlightedId) : undefined;
		if (next) {
			next.marker.setIcon(markerIcon(google, next.url, true));
			next.marker.setZIndex(google.maps.Marker.MAX_ZINDEX);
		}
	}, [highlightedId]);

	const highlightedEvent = events.find((event) => event.id === highlightedId);

	// One label per stretch of the line, i.e. between each event and the next (events come sorted by date)
	const legs = events.slice(1).map((to, i) => ({ from: events[i], to }));

	const menuEvents = events.filter(
		(event) => alwaysShowHoverMenus || event.id === hoveredId || event.id === focusedId,
	);

	return (
		<>
			{/* Beside the sidebar on wide screens, above it on phones (see app/page.tsx) */}
			<div
				className={`relative ${fullScreen ? "h-dvh w-full" : "h-[45dvh] shrink-0 md:h-full md:min-w-0 md:flex-1"}`}
			>
				<div ref={ref} className="w-full h-full" />
				{map ? (
					<button
						className="absolute right-3 bottom-8 flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-panel px-3 text-sm font-medium text-panel-foreground shadow-md shadow-black/40 hover:bg-panel-raised"
						aria-pressed={satellite}
						title={satellite ? "Switch to the map view" : "Switch to the satellite view"}
						onClick={toggleSatellite}
					>
						<LayersIcon size={16} />
						{satellite ? "Map" : "Satellite"}
					</button>
				) : null}
			</div>
			{map && highlightedEvent ? (
				<MapAnchor
					key={`highlight-${highlightedEvent.id}`}
					map={map}
					lat={highlightedEvent.lat}
					lng={highlightedEvent.lng}
					raised={false}
				>
					{/* A pulsing ring around the marker so it's easy to spot */}
					<div className="absolute -left-5 -top-5 w-10 h-10 rounded-full border-2 border-white animate-ping pointer-events-none motion-reduce:animate-none" />
				</MapAnchor>
			) : null}
			{map
				? legs.map(({ from, to }) => {
						const { lat, lng } = midpoint(from, to);
						const legKey = `leg-${from.id}-${to.id}`;
						return (
							<MapAnchor
								key={legKey}
								map={map}
								lat={lat}
								lng={lng}
								raised={editingLeg === legKey}
								// Below the hover menus, so a label never covers one
								pane="overlayMouseTarget"
							>
								<LegLabel
									days={daysBetween(from.date, to.date)}
									note={to.travelNote}
									title={`${from.name || "Untitled"} → ${to.name || "Untitled"}`}
									editing={editingLeg === legKey}
									onEditingChange={(editing) =>
										setEditingLeg((current) =>
											editing ? legKey : current === legKey ? null : current,
										)
									}
									// The notes are stored on the event the stretch leads to, so they lock with it
									onNoteChange={
										onUpdate && !to.locked
											? (travelNote) => onUpdate(to.id, { travelNote })
											: undefined
									}
								/>
							</MapAnchor>
						);
					})
				: null}
			{map && showDates
				? events.map((event) => (
						<MapAnchor
							key={`date-${event.id}`}
							map={map}
							lat={event.lat}
							lng={event.lng}
							raised={false}
							// Below the hover menus, so a date never covers one
							pane="overlayMouseTarget"
						>
							{/* Just under the marker, which is centred on the point (and bigger while highlighted) */}
							<div
								className={`absolute left-0 -translate-x-1/2 w-max bg-panel border border-line rounded-full text-panel-foreground text-xs font-medium tabular-nums shadow-md shadow-black/40 px-1.5 leading-4 pointer-events-none ${event.id === highlightedId ? "top-4.5" : "top-3"}`}
							>
								{formatNzDate(event.date)}
							</div>
						</MapAnchor>
					))
				: null}
			{map
				? menuEvents.map((event) => (
						<MapAnchor
							key={event.id}
							map={map}
							lat={event.lat}
							lng={event.lng}
							raised={event.id === hoveredId || event.id === focusedId}
						>
							<div
								className="absolute bottom-0 left-0 -translate-x-1/2 -translate-y-4 cursor-auto"
								onMouseEnter={() => showMenu(event.id)}
								onMouseLeave={hideMenuSoon}
								onFocus={() => setFocusedId(event.id)}
								onBlur={(e) => {
									if (!e.currentTarget.contains(e.relatedTarget)) {
										setFocusedId((id) => (id === event.id ? null : id));
									}
								}}
							>
								<EventEditor
									event={event}
									onUpdate={onUpdate}
									onDelete={onDelete}
									groups={groups}
									layers={layers}
									className="w-80 rounded-lg border border-line bg-panel text-sm text-panel-foreground shadow-lg shadow-black/40"
								/>
								<div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1.5 w-3 h-3 rotate-45 bg-panel border-r border-b border-line" />
							</div>
						</MapAnchor>
					))
				: null}
		</>
	);
}

/**
 * The days between two events, sitting on the line between them, with notes on the trip
 * (e.g. the train time). Clicking it edits the notes, unless it's read-only.
 */
function LegLabel({
	days,
	note,
	title,
	editing,
	onEditingChange: setEditing,
	onNoteChange,
}: {
	days: number;
	note: string;
	/** Which two events this is between, shown as a tooltip and above the notes box. */
	title: string;
	/** Whether the notes box is open. Kept by MapView, so it can draw the open one on top. */
	editing: boolean;
	onEditingChange: (editing: boolean) => void;
	onNoteChange?: (note: string) => void;
}) {

	return (
		<div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-auto">
			{editing && onNoteChange ? (
				<div
					className="w-60 rounded-lg border border-line bg-panel p-2.5 text-sm text-panel-foreground shadow-lg shadow-black/40"
					onBlur={(e) => {
						if (!e.currentTarget.contains(e.relatedTarget)) setEditing(false);
					}}
				>
					<div className="flex flex-row items-baseline justify-between gap-2 mb-1">
						<span className="line-clamp-2 text-muted text-xs">{title}</span>
						<span className="shrink-0 font-semibold">{formatDays(days)}</span>
					</div>
					<textarea
						className="field block h-auto w-full min-h-[2.5em] resize-y py-1"
						rows={2}
						autoFocus
						value={note}
						onChange={(e) => onNoteChange(e.target.value)}
						onKeyDown={(e) => {
							// Shift+Enter still adds a new line
							if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
								e.preventDefault();
								setEditing(false);
							}
						}}
						placeholder="Travel notes, e.g. ~4h by train"
					/>
				</div>
			) : (
				<button
					className={`block w-max max-w-48 bg-panel border border-line text-panel-foreground text-xs text-center shadow-md shadow-black/40 px-2 py-0.5 ${note ? "rounded-lg" : "rounded-full"} ${onNoteChange ? "cursor-pointer hover:bg-panel-raised" : "cursor-default"}`}
					title={onNoteChange ? `${title}\nClick to edit travel notes` : title}
					onClick={onNoteChange ? () => setEditing(true) : undefined}
				>
					<span className="block font-semibold whitespace-nowrap">{formatDays(days)}</span>
					{note ? (
						<span className="block text-muted whitespace-pre-line line-clamp-2">{note}</span>
					) : null}
				</button>
			)}
		</div>
	);
}

/** Renders children on the map, with the container's origin pinned to a lat/lng. */
function MapAnchor({
	map,
	lat,
	lng,
	raised,
	pane = "floatPane",
	children,
}: {
	map: any;
	lat: number;
	lng: number;
	/** Draws this one above the other menus, for when they're all shown at once. */
	raised: boolean;
	/** Which of the map's layers to draw in; floatPane is the top one. */
	pane?: "floatPane" | "overlayMouseTarget";
	children: ReactNode;
}) {
	const [container] = useState(() => {
		const div = document.createElement("div");
		div.style.position = "absolute";
		// Google Maps sets its own font on everything inside the map, so put the site's back
		div.className = "font-sans panel-scheme";
		// The map has keyboard shortcuts (arrows, +/-) that would otherwise fire while typing in the menu
		for (const type of ["keydown", "keyup", "keypress"]) {
			div.addEventListener(type, (e) => e.stopPropagation());
		}
		return div;
	});
	const overlayRef = useRef<any>(null);

	useEffect(() => {
		const google = (window as any).google;

		class Anchor extends google.maps.OverlayView {
			// Set by the effect below, which also follows the event as it moves
			position: any = null;

			onAdd() {
				this.getPanes()[pane].appendChild(container);
			}

			draw() {
				if (!this.position) return;
				const pixel = this.getProjection()?.fromLatLngToDivPixel(this.position);
				if (!pixel) return;
				container.style.left = `${pixel.x}px`;
				container.style.top = `${pixel.y}px`;
			}

			onRemove() {
				container.remove();
			}
		}

		google.maps.OverlayView.preventMapHitsAndGesturesFrom(container);
		const overlay = new Anchor();
		overlay.setMap(map);
		overlayRef.current = overlay;
		return () => {
			overlay.setMap(null);
			overlayRef.current = null;
		};
	}, [map, container, pane]);

	useEffect(() => {
		const overlay = overlayRef.current;
		if (!overlay) return;
		overlay.position = new (window as any).google.maps.LatLng(lat, lng);
		overlay.draw();
	}, [lat, lng]);

	useEffect(() => {
		container.style.zIndex = raised ? "1" : "";
	}, [container, raised]);

	return createPortal(children, container);
}
