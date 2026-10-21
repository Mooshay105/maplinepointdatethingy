"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Point } from "../../utils/types";
import EventEditor from "./EventEditor";

const API_KEY = "AIzaSyA1sD6rmLPNBxuZuG0l9xHiYwdN8sl7nzY";

let mapsPromise: Promise<any> | null = null;

function loadGoogleMaps(): Promise<any> {
	if (mapsPromise) return mapsPromise;

	mapsPromise = new Promise((resolve, reject) => {
		if ((window as any).google?.maps) {
			return resolve((window as any).google);
		}
		const script = document.createElement("script");
		script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}`;
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

async function iconUrl(name: string, color: Point["iconColor"]): Promise<string> {
	const key = `${name}|${color}`;
	const hit = urlCache.get(key);
	if (hit) return hit;

	const colorTable = {
		red: "#fc413d",
		orange: "#e65100",
		yellow: "#ffea00",
		green: "#097138",
		blue: "#1a237e",
		purple: "#9c27b0",
		black: "#0f0f0f",
		grey: "#707070",
		white: "#f0f0f0",
	};

	const svg = await (await fetch(`/icons/${name}.svg`)).text();
	const url =
		"data:image/svg+xml;charset=UTF-8," +
		encodeURIComponent(svg.replaceAll("#707070", colorTable[color]));

	urlCache.set(key, url);
	return url;
}

/** How long a hover menu lingers after the mouse leaves, so it can travel from the marker into the menu. */
const HOVER_HIDE_DELAY_MS = 250;

export default function MapView({
	points,
	fullScreen,
	alwaysShowHoverMenus = false,
	onUpdate,
	onDelete,
}: {
	points: Point[];
	fullScreen?: boolean;
	alwaysShowHoverMenus?: boolean;
	onUpdate?: (id: number, changes: Partial<Point>) => void;
	onDelete?: (id: number) => void;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const mapRef = useRef<any>(null);
	const overlaysRef = useRef<any[]>([]);
	const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const [map, setMap] = useState<any>(null);
	const [hoveredId, setHoveredId] = useState<number | null>(null);
	// Keeps a menu open while one of its inputs has focus, even if the mouse wanders off
	const [focusedId, setFocusedId] = useState<number | null>(null);

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
				setMap(mapRef.current);
			}
			const map = mapRef.current;

			overlaysRef.current.forEach((o) => o.setMap(null));
			overlaysRef.current = [];

			points.forEach(async (p) => {
				const url = await iconUrl(p.icon ?? "outdoor-athletics", p.iconColor ?? "grey");
				// Points changed while the icon loaded; the newer run draws this marker instead
				if (cancelled) return;

				const marker = new google.maps.Marker({
					position: { lat: p.lat, lng: p.lng },
					map,
					icon: {
						url,
						scaledSize: new google.maps.Size(20, 20),
						anchor: new google.maps.Point(10, 10),
					},
				});
				marker.addListener("mouseover", () => showMenu(p.id));
				marker.addListener("mouseout", hideMenuSoon);
				overlaysRef.current.push(marker);
			});

			overlaysRef.current.push(
				new google.maps.Polyline({
					path: points.map((p) => ({ lat: p.lat, lng: p.lng })),
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
	}, [points]);

	const menuPoints = points.filter(
		(p) => alwaysShowHoverMenus || p.id === hoveredId || p.id === focusedId,
	);

	return (
		<>
			<div ref={ref} className={`ml-auto ${fullScreen ? "w-full" : "w-3/4"} h-screen`} />
			{map
				? menuPoints.map((p) => (
						<MapAnchor
							key={p.id}
							map={map}
							lat={p.lat}
							lng={p.lng}
							raised={p.id === hoveredId || p.id === focusedId}
						>
							<div
								className="absolute bottom-0 left-0 -translate-x-1/2 -translate-y-4 cursor-auto"
								onMouseEnter={() => showMenu(p.id)}
								onMouseLeave={hideMenuSoon}
								onFocus={() => setFocusedId(p.id)}
								onBlur={(e) => {
									if (!e.currentTarget.contains(e.relatedTarget)) {
										setFocusedId((id) => (id === p.id ? null : id));
									}
								}}
							>
								<EventEditor
									point={p}
									onUpdate={onUpdate}
									onDelete={onDelete}
									className="w-72 bg-[#0f0f0f] border border-[#f0f0f0] rounded-xl text-white text-sm shadow-lg shadow-black/50"
								/>
								<div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1.5 w-3 h-3 rotate-45 bg-[#0f0f0f] border-r border-b border-[#f0f0f0]" />
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
			// Set by the effect below, which also follows the point as it moves
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
