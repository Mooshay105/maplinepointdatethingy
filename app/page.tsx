"use client";

import { useEffect, useState } from "react";
import MapView from "./components/MapView";
import { Point } from "@/utils/types";

// Parses "DD/MM/YYYY" (en-NZ format). Returns null if invalid.
function parseNzDate(input: string): Date | null {
	const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim());
	if (!match) return null;

	const day = Number(match[1]);
	const month = Number(match[2]) - 1;
	const year = Number(match[3]);

	const d = new Date(year, month, day);
	if (d.getDate() !== day || d.getMonth() !== month) return null;
	return d;
}

export default function Home() {
	const [name, setName] = useState("");
	const [date, setDate] = useState("");
	const [lat, setLat] = useState("");
	const [lng, setLng] = useState("");
	const [drafts, setDrafts] = useState<Record<string, string>>({});
	const [points, setPoints] = useState<Point[]>([]);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		const stored = localStorage.getItem("points");
		if (stored) {
			const parsed: any[] = JSON.parse(stored);
			setPoints(parsed.map((p) => ({ ...p, date: new Date(p.date) })));
		}
		setLoaded(true);
	}, []);

	useEffect(() => {
		localStorage.setItem("points", JSON.stringify(points));
	}, [points]);

	function updatePoint(id: number, changes: Partial<Point>) {
		setPoints((prev) => {
			const next = prev.map((p) => (p.id === id ? { ...p, ...changes } : p));
			if (changes.date !== undefined) {
				next.sort((a, b) => a.date.getTime() - b.date.getTime());
			}
			return next;
		});
	}

	function setDraft(key: string, value: string) {
		setDrafts((prev) => ({ ...prev, [key]: value }));
	}

	function clearDraft(key: string) {
		setDrafts((prev) => {
			const next = { ...prev };
			delete next[key];
			return next;
		});
	}

	return (
		<main>
			<MapView points={points} />
			<div className="fixed top-0 left-0 h-full w-1/4 bg-[#0f0f0f] border-r border-[#f0f0f0] text-white p-2 overflow-y-auto">
				<div className="mb-20">
					{loaded ? (
						points.map((p) => {
							const dateKey = `${p.id}-date`;
							const latKey = `${p.id}-lat`;
							const lngKey = `${p.id}-lng`;

							return (
								<div key={p.id} className="border border-[#f0f0f0] rounded-xl m-2">
									<div className="flex flex-row">
										<input
											className="border border-[#f0f0f0] rounded-md mt-2 ml-2 mr-1 px-2 w-1/2"
											value={p.name}
											onChange={(e) => updatePoint(p.id, { name: e.target.value })}
											placeholder="Name"
										/>
										<input
											className="border border-[#f0f0f0] rounded-md mt-2 ml-1 mr-2 px-2 w-1/2"
											value={drafts[dateKey] ?? p.date.toLocaleDateString()}
											onChange={(e) => setDraft(dateKey, e.target.value)}
											onBlur={() => {
												const parsed = parseNzDate(drafts[dateKey] ?? "");
												if (parsed) {
													updatePoint(p.id, { date: parsed });
													clearDraft(dateKey);
												}
											}}
											placeholder="Date (DD/MM/YYYY)"
										/>
									</div>
									<div className="flex flex-row">
										<input
											className="border border-[#f0f0f0] rounded-md mt-2 mb-2 ml-2 mr-1 px-2 w-1/2"
											value={drafts[latKey] ?? p.lat}
											onChange={(e) => {
												const value = e.target.value;
												setDraft(latKey, value);
												const n = Number(value);
												if (value.trim() !== "" && Number.isFinite(n)) {
													updatePoint(p.id, { lat: n });
												}
											}}
											placeholder="Latitude"
										/>
										<input
											className="border border-[#f0f0f0] rounded-md mt-2 mb-2 ml-1 mr-2 px-2 w-1/2"
											value={drafts[lngKey] ?? p.lng}
											onChange={(e) => {
												const value = e.target.value;
												setDraft(lngKey, value);
												const n = Number(value);
												if (value.trim() !== "" && Number.isFinite(n)) {
													updatePoint(p.id, { lng: n });
												}
											}}
											placeholder="Longitude"
										/>
									</div>
								</div>
							);
						})
					) : (
						<div className="text-center">Loading...</div>
					)}
				</div>
				<div className="border border-[#f0f0f0] bg-[#0f0f0f] rounded-xl m-1 flex flex-row fixed bottom-0 left-1 w-[calc(25%-16px)]">
					<div className="flex flex-col">
						<div className="flex flex-row">
							<input
								className="border border-[#f0f0f0] rounded-md mt-2 ml-2 mr-1 px-2 w-1/2"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Name"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										setPoints((prev) => [
											...prev,
											{
												id: prev.length + 1,
												name,
												lat: 0,
												lng: 0,
												date: date === "" ? new Date() : new Date(date),
											},
										]);
										setName("");
										setDate("");
										setLat("");
										setLng("");
									}
								}}
							/>
							<input
								className="border border-[#f0f0f0] rounded-md mt-2 ml-1 mr-2 px-2 w-1/2"
								value={date}
								onChange={(e) => setDate(e.target.value)}
								placeholder="Date (DD/MM/YYYY)"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										setPoints((prev) => [
											...prev,
											{
												id: prev.length + 1,
												name,
												lat: 0,
												lng: 0,
												date: date === "" ? new Date() : new Date(date),
											},
										]);
										setName("");
										setDate("");
										setLat("");
										setLng("");
									}
								}}
							/>
						</div>

						<div className="flex flex-row">
							<input
								className="border border-[#f0f0f0] rounded-md mt-2 mb-2 ml-2 mr-1 px-2 w-1/2"
								value={lat}
								onChange={(e) => setLat(e.target.value)}
								placeholder="Latitude"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										setPoints((prev) => [
											...prev,
											{
												id: prev.length + 1,
												name,
												lat: 0,
												lng: 0,
												date: date === "" ? new Date() : new Date(date),
											},
										]);
										setName("");
										setDate("");
										setLat("");
										setLng("");
									}
								}}
							/>
							<input
								className="border border-[#f0f0f0] rounded-md mt-2 mb-2 ml-1 mr-2 px-2 w-1/2"
								value={lng}
								onChange={(e) => setLng(e.target.value)}
								placeholder="Longitude"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										setPoints((prev) => [
											...prev,
											{
												id: prev.length + 1,
												name,
												lat: Number(lat),
												lng: Number(lng),
												date: date === "" ? new Date() : new Date(date),
											},
										]);
										setName("");
										setDate("");
										setLat("");
										setLng("");
									}
								}}
							/>
						</div>
					</div>
					<button
						className="border border-[#f0f0f0] rounded-md mt-2 mb-2 mr-2 px-2"
						onClick={() => {
							setPoints((prev) => [
								...prev,
								{
									id: prev.length + 1,
									name,
									lat: Number(lat),
									lng: Number(lng),
									date: date === "" ? new Date() : new Date(date),
								},
							]);
							setName("");
							setDate("");
							setLat("");
							setLng("");
						}}
					>
						Add
					</button>
				</div>
			</div>
		</main>
	);
}
