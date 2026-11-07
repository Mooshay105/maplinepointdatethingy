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

	if (!isSignedIn)
		return <p className="px-4 py-6 text-muted">Sign in to plan your events with the chat.</p>;
	if (!hasApiKey)
		return (
			<p className="px-4 py-6 text-muted">
				The chat needs your OpenAI API key. Add it under Settings, in the profile menu at the
				top of this panel.
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
			<div className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-live="polite">
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
			</div>
			<form
				className="flex shrink-0 gap-2 border-t border-line bg-panel-sunken/60 p-3"
				onSubmit={(e) => {
					e.preventDefault();
					if (isLoading) stop();
					else send();
				}}
			>
				<input
					className="field h-9 flex-1"
					aria-label="Message"
					value={input}
					placeholder="Ask for a change"
					onChange={(e) => setInput(e.currentTarget.value)}
					onKeyDown={(e) => {
						// Holding Enter would otherwise send, then stop the reply it just started
						if (e.key === "Enter" && e.repeat) e.preventDefault();
					}}
				/>
				<button
					type="submit"
					className="button-primary w-9 px-0"
					aria-label={isLoading ? "Stop" : "Send"}
					title={isLoading ? "Stop" : "Send"}
				>
					{isLoading ? <StopIcon size={18} /> : <ArrowUpIcon size={18} />}
				</button>
			</form>
		</>
	);
}
