"use client";

import { UseChatHelpers } from "@ai-sdk/react";
import { useUser } from "@clerk/nextjs";
import { getToolName, isToolUIPart, UIMessage } from "ai";
import { useState } from "react";
import { ArrowUpIcon, StopIcon } from "./Icons";

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
	const { isSignedIn } = useUser();

	if (!isSignedIn) return <div className="text-center">Sign in to use the chat.</div>;
	if (!hasApiKey)
		return (
			<div className="text-center">
				Add your OpenAI API key in Settings (profile menu, top right) to use the chat.
			</div>
		);

	const isLoading = status === "submitted" || status === "streaming";

	function send() {
		if (input.trim() === "") return;
		sendMessage({ text: input });
		setInput("");
	}

	return (
		<div className="flex flex-col w-full max-w-md mx-auto">
			{messages.map((message) => (
				<div
					key={message.id}
					className={`whitespace-pre-wrap ${message.role === "user" ? "bg-panel-raised" : "bg-panel"} rounded-md px-2`}
				>
					{message.parts.map((part, i) => {
						if (part.type === "text") {
							return <div key={`${message.id}-${i}`}>{part.text}</div>;
						}
						if (isToolUIPart(part)) {
							const output =
								typeof part.output === "string" ? part.output : JSON.stringify(part.output);
							return (
								<div key={`${message.id}-${i}`} className="text-xs text-muted">
									{getToolName(part)}: {part.state === "output-available" ? output : part.state}
								</div>
							);
						}
						return null;
					})}
				</div>
			))}

			{error && <div className="text-xs text-danger px-2">Error: {error.message}</div>}

			<input
				className="fixed bg-panel bottom-0 w-[calc(22vw-50px)] p-2 m-2 mb-8 border border-line rounded shadow-xl"
				value={input}
				placeholder="Ask something..."
				onChange={(e) => setInput(e.currentTarget.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.repeat) send();
				}}
			/>

			<button
				type="button"
				className="fixed bg-panel bottom-0 ml-[19vw] p-1.75 m-2 mb-8 border border-line rounded shadow-xl"
				aria-label={isLoading ? "Stop" : "Send"}
				onClick={() => (isLoading ? stop() : send())}
			>
				{isLoading ? <StopIcon /> : <ArrowUpIcon />}
			</button>
		</div>
	);
}
