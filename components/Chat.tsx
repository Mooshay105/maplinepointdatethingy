"use client";

import { UseChatHelpers } from "@ai-sdk/react";
import { useUser } from "@clerk/nextjs";
import { getToolName, isToolUIPart, UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
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
	const endRef = useRef<HTMLDivElement>(null);

	// Keep the newest message in view as replies stream in
	useEffect(() => {
		endRef.current?.scrollIntoView({ block: "end" });
	}, [messages]);

	if (!isSignedIn)
		return <p className="px-4 py-6 text-muted">Sign in above to plan your events with the chat.</p>;
	if (!hasApiKey)
		return (
			<p className="px-4 py-6 text-muted">
				The chat needs your OpenAI API key. Open your profile picture above, choose Manage
				account, then Settings, and paste it in.
			</p>
		);

	const isLoading = status === "submitted" || status === "streaming";

	function send() {
		if (input.trim() === "") return;
		sendMessage({ text: input });
		setInput("");
	}

	return (
		<>
			<div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
				{messages.length === 0 ? (
					<p className="px-1 py-3 text-muted">
						Ask for changes in plain words, like &ldquo;add the Zurich Diamond League on
						28/08/2026&rdquo; or &ldquo;hide every cross country event&rdquo;.
					</p>
				) : null}
				<div className="flex flex-col gap-2">
					{messages.map((message) => (
						<div
							key={message.id}
							className={`max-w-full overflow-x-auto whitespace-pre-wrap ${message.role === "user" ? "ml-8 self-end rounded-lg bg-panel-raised px-3 py-2" : "px-1"}`}
						>
							{message.parts.map((part, i) => {
								if (part.type === "text") {
									return <div key={`${message.id}-${i}`}>{part.text}</div>;
								}
								if (isToolUIPart(part)) {
									const output =
										typeof part.output === "string"
											? part.output
											: JSON.stringify(part.output);
									return (
										<div
											key={`${message.id}-${i}`}
											className="my-1 border-l-2 border-line pl-2 text-xs text-muted"
										>
											<span className="font-medium">{getToolName(part)}</span>:{" "}
											{part.state === "output-available" ? output : part.state}
										</div>
									);
								}
								return null;
							})}
						</div>
					))}
				</div>
				{error ? (
					<p role="alert" className="mt-2 text-sm text-danger">
						The chat stopped with an error: {error.message}
					</p>
				) : null}
				<p className="sr-only" aria-live="polite">
					{status === "submitted" || status === "streaming" ? "Replying" : ""}
				</p>
				<div ref={endRef} />
			</div>
			<form
				className="flex shrink-0 gap-2 border-t border-line bg-panel-sunken/60 p-3"
				onSubmit={(e) => {
					e.preventDefault();
					// Enter while a reply streams does nothing; only the stop button stops it
					if (!isLoading) send();
				}}
			>
				<input
					className="field h-9 flex-1"
					aria-label="Message"
					value={input}
					placeholder="Ask for a change"
					onChange={(e) => setInput(e.currentTarget.value)}
				/>
				<button
					type={isLoading ? "button" : "submit"}
					className="button-primary w-9 px-0"
					aria-label={isLoading ? "Stop" : "Send"}
					title={isLoading ? "Stop" : "Send"}
					onClick={isLoading ? () => stop() : undefined}
				>
					{isLoading ? <StopIcon size={18} /> : <ArrowUpIcon size={18} />}
				</button>
			</form>
		</>
	);
}
