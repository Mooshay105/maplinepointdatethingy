"use client";

import MapView from "@/components/MapView";
import { MapEvent } from "@/utils/types";
import { fetchEvents } from "@/utils/eventsSync";
import { Suspense, use, useEffect, useState } from "react";

export default function SharePage({ params }: { params: Promise<{ userId: string }> }) {
	return (
		<main>
			{/* use(params) below suspends until the route params are ready */}
			<Suspense>
				<SharedMap params={params} />
			</Suspense>
		</main>
	);
}

function SharedMap({ params }: { params: Promise<{ userId: string }> }) {
	const { userId } = use(params);
	const [events, setEvents] = useState<MapEvent[]>([]);

	useEffect(() => {
		fetchEvents(userId)
			.then(setEvents)
			.catch((err) => console.error("Failed to load events:", err));
	}, [userId]);

	return <MapView events={events.filter((event) => event.visible)} fullScreen={true} />;
}
