export type Point = {
	id: number;
	name: string;
	lat: number;
	lng: number;
	date: Date;
	icon:
		| "indoor-athletics"
		| "outdoor-athletics"
		| "road-running"
		| "cross-country"
		| "trail-running"
		| "combined-events"
		| "race-walking"
		| "diamond-league";
	iconColor:
		| "red"
		| "yellow"
		| "orange"
		| "green"
		| "blue"
		| "purple"
		| "black"
		| "grey"
		| "white";
	visable: boolean;
};
