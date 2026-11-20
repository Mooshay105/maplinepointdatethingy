import { SVGProps } from "react";

/** Props for the site logo. */
type LogoProps = SVGProps<SVGSVGElement> & {
	/** Width and height in pixels. */
	size?: number;
};

export function Logo({ size = 28, ...props }: LogoProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 32 32"
			aria-hidden="true"
			{...props}
		>
			<rect width="32" height="32" rx="7" className="fill-panel-raised" />
			<path
				d="M7.5 11.5V16.5A8 8 0 0 0 15.5 24.5H17"
				fill="none"
				className="stroke-panel-foreground"
				strokeWidth={2.2}
				strokeLinecap="round"
				strokeDasharray="2.6 2.6"
			/>
			<circle cx="7.5" cy="8" r="2.5" className="fill-panel-raised stroke-panel-foreground" strokeWidth={2} />
			<path
				d="M21 24.5C21 24.5 14.5 18.4 14.5 14.5A6.5 6.5 0 0 1 27.5 14.5C27.5 18.4 21 24.5 21 24.5Z"
				className="fill-accent"
			/>
			<circle cx="21" cy="14.5" r="2.4" className="fill-panel-raised" />
		</svg>
	);
}
