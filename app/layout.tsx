import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

// Barlow for reading, its condensed cut for names and headings: narrow enough to fit long meet
// names in the sidebar, and close to the lettering on results boards. Used through
// font-sans and font-display, see app/globals.css.
const barlow = Barlow({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-barlow",
});
const barlowCondensed = Barlow_Condensed({
	subsets: ["latin"],
	weight: ["500", "600", "700"],
	variable: "--font-barlow-condensed",
});

export const metadata: Metadata = {
	title: "Mapline Point Date Thingy",
	description: "A custom tool",
};

// Lets the page shrink when a phone's keyboard opens, so the add form and chat input stay above it
export const viewport: Viewport = {
	interactiveWidget: "resizes-content",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`h-full antialiased ${barlow.variable} ${barlowCondensed.variable}`}
		>
			<body className="h-full font-sans">
				<ClerkProvider>{children}</ClerkProvider>
			</body>
		</html>
	);
}
