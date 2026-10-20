"use client";

import { UseChatHelpers } from "@ai-sdk/react";
import { useUser } from "@clerk/nextjs";
import { isToolUIPart, UIMessage } from "ai";
import { useState } from "react";

interface ChatProps {
	messages: UIMessage[];
	sendMessage: UseChatHelpers<UIMessage>["sendMessage"];
	status: UseChatHelpers<UIMessage>["status"];
	stop: UseChatHelpers<UIMessage>["stop"];
	hasApiKey: boolean;
	error: UseChatHelpers<UIMessage>["error"];
}

export default function Chat({
	messages,
	sendMessage,
	status,
	stop,
	hasApiKey,
	error,
}: ChatProps) {
	const [input, setInput] = useState("");
	const { isSignedIn, user, isLoaded } = useUser();

	if (!isSignedIn) return <div className="text-center">Sign in to use the chat.</div>;
	if (!hasApiKey)
		return (
			<div className="text-center">
				Add your OpenAI API key in Settings (profile menu, top right) to use the chat.
			</div>
		);

	const isLoading = (status === "submitted" || status === "streaming") && isLoaded;
	return (
		<div className="flex flex-col w-full max-w-md mx-auto stretch">
			{messages.map((message) => (
				<div
					key={message.id}
					className={`whitespace-pre-wrap ${message.role === "user" ? "bg-[#1f1f1f]" : "bg-[#0f0f0f]"} rounded-md px-2`}
				>
					{message.parts.map((part, i) => {
						switch (part.type) {
							case "text":
								return <div key={`${message.id}-${i}`}>{part.text}</div>;
						}
						if (isToolUIPart(part)) {
							const toolName =
								part.type === "dynamic-tool" ? part.toolName : part.type.slice(5);
							return (
								<div key={`${message.id}-${i}`} className="text-xs text-zinc-400">
									{toolName}:{" "}
									{part.state === "output-available" ? String(part.output) : part.state}
								</div>
							);
						}
					})}
				</div>
			))}

			{error && <div className="text-xs text-red-400 px-2">Error: {error.message}</div>}

			<input
				className="fixed dark:bg-zinc-900 bottom-0 w-[calc(22vw-50px)] p-2 m-2 mb-8 border border-zinc-300 dark:border-zinc-800 rounded shadow-xl"
				value={input}
				placeholder="Ask something..."
				onChange={(e) => setInput(e.currentTarget.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.repeat) {
						sendMessage({ text: input });
						setInput("");
					}
				}}
			/>

			<button
				type="button"
				className="fixed dark:bg-zinc-900 bottom-0 ml-[19vw] p-1.25 m-2 mb-8 border border-zinc-300 dark:border-zinc-800 rounded shadow-xl"
				onClick={() => {
					if (isLoading) {
						stop();
					} else {
						sendMessage({ text: input });
						setInput("");
					}
				}}
			>
				{isLoading ? (
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="30"
						height="30"
						viewBox="0 0 100 100"
					>
						<rect
							x="10"
							y="10"
							width="80"
							height="80"
							rx="12"
							ry="12"
							fill="white"
							stroke="white"
							strokeWidth="4"
						/>
					</svg>
				) : (
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="30"
						height="30"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="m5 12 7-7 7 7"></path>
						<path d="M12 19V5"></path>
					</svg>
				)}
			</button>
		</div>
	);
}
