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

			// Clear old markers and lines before drawing new ones
			overlaysRef.current.forEach((o) => o.setMap(null));
			overlaysRef.current = [];

			points.forEach((p) => {
				overlaysRef.current.push(
					new google.maps.Marker({
						position: { lat: p.lat, lng: p.lng },
						map,
						title: `${p.name} - ${p.date.toLocaleDateString()}`,
					}),
				);
			});

			overlaysRef.current.push(
				new google.maps.Polyline({
					path: points.map((p) => ({ lat: p.lat, lng: p.lng })),
					geodesic: true,
					strokeColor: "#FF0000",
					strokeWeight: 3,
					map,
				}),
			);
		});

		return () => {
			cancelled = true;
		};
	}, [points]);

	return <div ref={ref} className="ml-auto w-3/4 h-screen" />;
}
