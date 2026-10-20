import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
	title: "Mapline Point Date Thingy",
	description: "A custom tool",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={`h-full antialiased`}>
			<body className="min-h-full flex flex-col">
				<ClerkProvider>{children}</ClerkProvider>
			</body>
		</html>
	);
}
