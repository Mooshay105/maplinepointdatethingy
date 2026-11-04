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
import EventEditor from "./EventEditor";

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

export default function MapView({
	events,
	fullScreen,
	alwaysShowHoverMenus = false,
	onUpdate,
	onDelete,
	groups,
	layers,
	highlightedId = null,
}: {
	events: MapEvent[];
	fullScreen?: boolean;
	alwaysShowHoverMenus?: boolean;
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
					// Dragging moves the event; the address is left as typed
					draggable,
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

	const menuEvents = events.filter(
		(event) => alwaysShowHoverMenus || event.id === hoveredId || event.id === focusedId,
	);

	return (
		<>
			<div ref={ref} className={`ml-auto ${fullScreen ? "w-full" : "w-3/4"} h-dvh`} />
			{map && highlightedEvent ? (
				<MapAnchor
					key={`highlight-${highlightedEvent.id}`}
					map={map}
					lat={highlightedEvent.lat}
					lng={highlightedEvent.lng}
					raised={false}
				>
					{/* A pulsing ring around the marker so it's easy to spot */}
					<div className="absolute -left-5 -top-5 w-10 h-10 rounded-full border-2 border-white animate-ping pointer-events-none" />
				</MapAnchor>
			) : null}
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
									className="w-72 bg-panel border border-line rounded-xl text-panel-foreground text-sm shadow-lg shadow-black/50"
								/>
								<div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1.5 w-3 h-3 rotate-45 bg-panel border-r border-b border-line" />
							</div>
						</MapAnchor>
					))
				: null}
		</>
	);
}

/** Renders children on the map, with the container's origin pinned to a lat/lng. */
function MapAnchor({
	map,
	lat,
	lng,
	raised,
	children,
}: {
	map: any;
	lat: number;
	lng: number;
	/** Draws this one above the other menus, for when they're all shown at once. */
	raised: boolean;
	children: ReactNode;
}) {
	const [container] = useState(() => {
		const div = document.createElement("div");
		div.style.position = "absolute";
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
				this.getPanes().floatPane.appendChild(container);
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
	}, [map, container]);

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
