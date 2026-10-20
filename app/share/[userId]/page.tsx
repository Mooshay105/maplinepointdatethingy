"use client";

import MapView from "@/db/components/MapView";
import { Point } from "@/utils/types";
import { Suspense, use, useEffect, useState } from "react";

export default function SharePage({ params }: { params: Promise<{ userId: string }> }) {
	const { userId } = use(params);
	const [points, setPoints] = useState<Point[]>([]);

	useEffect(() => {
		fetch(
			new Request("/api/events", {
				method: "GET",
				headers: {
					searchingUserId: userId,
				},
			}),
		)
			.then((r) => r.json())
			.then((r) => {
				const points: Point[] = r.map((e: any) => ({
					id: e.id,
					name: e.name,
					date: new Date(e.date),
					icon: e.icon,
					iconColor: e.iconColor,
					lat: e.lat,
					lng: e.lng,
					visable: e.visable,
				}));

				setPoints(points);
			})
			.catch((err) => console.error("Failed to load events:", err));
	}, [userId]);

	return (
		<main>
			<Suspense>
				<MapView points={points} fullScreen={true} />
			</Suspense>
		</main>
	);
}
