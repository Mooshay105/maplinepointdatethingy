"use client";

import { COLOR_LABELS, colorHex, EVENT_COLORS, EventColor, isPresetColor } from "@/utils/types";

const CUSTOM = "custom";

/** Picks a preset marker colour from a dropdown, or any custom colour from the swatch beside it. */
export default function ColorSelect({
	value,
	onChange,
	disabled,
	className = "",
	selectClassName = "",
}: {
	value: EventColor;
	onChange: (color: EventColor) => void;
	disabled?: boolean;
	/** For the wrapper holding the dropdown and the swatch. */
	className?: string;
	selectClassName?: string;
}) {
	const preset = isPresetColor(value);

	return (
		<div className={`flex flex-row items-stretch gap-1 ${className}`}>
			<select
				className={`flex-1 min-w-0 ${selectClassName}`}
				value={preset ? value : CUSTOM}
				disabled={disabled}
				onChange={(e) => {
					// Choosing "Custom" starts from the current colour; the swatch then changes it
					if (e.target.value !== CUSTOM) onChange(e.target.value as EventColor);
					else if (preset) onChange(colorHex(value) as EventColor);
				}}
			>
				{EVENT_COLORS.map((color) => (
					<option key={color} value={color}>
						{COLOR_LABELS[color]}
					</option>
				))}
				<option value={CUSTOM}>Custom</option>
			</select>
			<input
				type="color"
				aria-label="Custom colour"
				title="Custom colour"
				className="w-7 shrink-0 cursor-pointer rounded-md border border-line bg-transparent disabled:cursor-default"
				value={colorHex(value)}
				disabled={disabled}
				onChange={(e) => onChange(e.target.value as EventColor)}
			/>
		</div>
	);
}
