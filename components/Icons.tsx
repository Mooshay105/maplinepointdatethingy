import { SVGProps } from "react";

// Every UI icon on the site comes from here so they share one look: drawn on a 24×24 grid with
// 2px round strokes, no fill, and coloured by the surrounding text colour (currentColor).
// To make a new one, add a component below that wraps its shapes in <Icon>.
// The map markers in /public/icons follow the same line style, drawn white on a coloured disc.

type IconProps = SVGProps<SVGSVGElement> & {
	/** Width and height in pixels. */
	size?: number;
};

function Icon({ size = 24, children, ...props }: IconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true" // Decorative: the button around it carries the label
			{...props}
		>
			{children}
		</svg>
	);
}

export function UserIcon(props: IconProps) {
	return (
		<Icon {...props}>
			<circle cx="12" cy="12" r="10" />
			<circle cx="12" cy="10" r="3.5" />
			<path d="M5.5 19.5c1.5-2.6 3.8-4 6.5-4s5 1.4 6.5 4" />
		</Icon>
	);
}

export function SettingsIcon(props: IconProps) {
	return (
		<Icon {...props}>
			<path d="M19.09 9.7 L21.5 10.33 L21.5 13.67 L19.09 14.3 L18.64 15.38 L19.9 17.53 L17.53 19.9 L15.38 18.64 L14.3 19.09 L13.67 21.5 L10.33 21.5 L9.7 19.09 L8.62 18.64 L6.47 19.9 L4.1 17.53 L5.36 15.38 L4.91 14.3 L2.5 13.67 L2.5 10.33 L4.91 9.7 L5.36 8.62 L4.1 6.47 L6.47 4.1 L8.62 5.36 L9.7 4.91 L10.33 2.5 L13.67 2.5 L14.3 4.91 L15.38 5.36 L17.53 4.1 L19.9 6.47 L18.64 8.62 Z" />
			<circle cx="12" cy="12" r="3" />
		</Icon>
	);
}

/** An eye, crossed out when `crossed` is true (e.g. for a hidden event). */
export function EyeIcon({ crossed = false, ...props }: IconProps & { crossed?: boolean }) {
	return (
		<Icon {...props}>
			<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
			<circle cx="12" cy="12" r="3" />
			{crossed ? <path d="M4 4l16 16" /> : null}
		</Icon>
	);
}

export function TrashIcon(props: IconProps) {
	return (
		<Icon {...props}>
			<path d="M3 6h18" />
			<path d="M9 6V3.5h6V6" />
			<path d="M5.5 6l1 15h11l1-15" />
			<path d="M10 10.5v6.5" />
			<path d="M14 10.5v6.5" />
		</Icon>
	);
}

export function ArrowUpIcon(props: IconProps) {
	return (
		<Icon {...props}>
			<path d="m5 12 7-7 7 7" />
			<path d="M12 19V5" />
		</Icon>
	);
}

export function StopIcon(props: IconProps) {
	return (
		<Icon {...props}>
			<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" />
		</Icon>
	);
}

/** Points right, or down when `open` is true (e.g. for an expanded group). */
export function ChevronIcon({ open = false, ...props }: IconProps & { open?: boolean }) {
	return <Icon {...props}>{open ? <path d="m6 9 6 6 6-6" /> : <path d="m9 6 6 6-6 6" />}</Icon>;
}
