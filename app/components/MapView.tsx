"use client";

import { useEffect, useRef } from "react";
import { Point } from "../../utils/types";

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

export default function MapView({ points }: { points: Point[] }) {
	const ref = useRef<HTMLDivElement>(null);
	const mapRef = useRef<any>(null);
	const overlaysRef = useRef<any[]>([]);

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
			}
			const map = mapRef.current;

			overlaysRef.current.forEach((o) => o.setMap(null));
			overlaysRef.current = [];

			points.forEach(async (p) => {
				const url = await iconUrl(p.icon ?? "outdoor-athletics", p.iconColor ?? "grey");

				overlaysRef.current.push(
					new google.maps.Marker({
						position: { lat: p.lat, lng: p.lng },
						map,
						title: `${p.name} - ${p.date.toLocaleDateString()}`,
						icon: {
							url,
							scaledSize: new google.maps.Size(20, 20),
							anchor: new google.maps.Point(10, 10),
						},
					}),
				);
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

	return <div ref={ref} className="ml-auto w-3/4 h-screen" />;
}
