"use client";

import MapView from "@/components/MapView";
import { Layer, MapEvent, MapGroup } from "@/utils/types";
import { fetchEvents } from "@/utils/eventsSync";
import { fetchGroups } from "@/utils/groupsSync";
import { isShownOnMap } from "@/utils/groups";
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
	const [groups, setGroups] = useState<MapGroup[]>([]);
	const [layers, setLayers] = useState<Layer[]>([]);

	useEffect(() => {
		// Loaded together, so events in hidden groups never flash up on the map
		Promise.all([fetchEvents(userId), fetchGroups(userId)])
			.then(([loadedEvents, loadedGroups]) => {
				setEvents(loadedEvents);
				setGroups(loadedGroups.groups);
				setLayers(loadedGroups.layers);
			})
			.catch((err) => console.error("Failed to load events:", err));
	}, [userId]);

	return (
		<MapView
			events={events.filter((event) => isShownOnMap(event, groups, layers))}
			fullScreen={true}
		/>
	);
}
