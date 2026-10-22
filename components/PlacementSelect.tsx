"use client";

import { Layer, MapGroup } from "@/utils/types";
import { parsePlacementValue, Placement, placementValue } from "@/utils/groups";

/** Picks which group or layer an event goes in. */
export default function PlacementSelect({
	value,
	groups,
	layers,
	onChange,
	className = "",
}: {
	value: Placement;
	groups: MapGroup[];
	layers: Layer[];
	onChange: (placement: Placement) => void;
	className?: string;
}) {
	return (
		<select
			className={className}
			value={placementValue(value, groups, layers)}
			onChange={(e) => onChange(parsePlacementValue(e.target.value, layers))}
		>
			<option value="">No group</option>
			{groups.map((group) => [
				<option key={`g:${group.id}`} value={`g:${group.id}`}>
					{group.name || "Untitled group"}
				</option>,
				...layers
					.filter((layer) => layer.groupId === group.id)
					.map((layer) => (
						<option key={`l:${layer.id}`} value={`l:${layer.id}`}>
							{`${group.name || "Untitled group"} › ${layer.name || "Untitled layer"}`}
						</option>
					)),
			])}
		</select>
	);
}
