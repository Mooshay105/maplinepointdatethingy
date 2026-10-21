import {
	streamText,
	UIMessage,
	convertToModelMessages,
	createUIMessageStreamResponse,
	toUIMessageStream,
	tool,
	isStepCount,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import z from "zod";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { geoLookup } from "@/utils/geoLookup";
import { addEventInput, deleteEventInput, editEventInput } from "@/utils/chatTools";
import { formatNzDate } from "@/utils/dates";

export async function POST(req: Request) {
	const { isAuthenticated } = await auth();

	if (!isAuthenticated) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// BYO key: sent by the client from its localStorage on every request, used for this request only and never stored
	const apiKey = req.headers.get("x-openai-api-key")?.trim();
	if (!apiKey) {
		return NextResponse.json(
			{ error: "Missing OpenAI API key. Add one in Settings." },
			{ status: 400 },
		);
	}
	const openai = createOpenAI({ apiKey });

	const { messages }: { messages: UIMessage[] } = await req.json();

	const result = streamText({
		model: openai("gpt-6-luna"),
		instructions: `You manage a calendar of events shown on a map. Dates must be in DD/MM/YYYY format. Today is ${formatNzDate(new Date())}. Use listEvents to find event ids before editing or deleting. Use geoLookup to get coordinates for an address or place before adding or moving an event there. Do not use markdown in your responses.`,
		tools: {
			addEvent: tool({
				description: "Add an event to the calendar",
				inputSchema: addEventInput,
			}),
			editEvent: tool({
				description: "Edit an event in the calendar. Only the provided fields are changed.",
				inputSchema: editEventInput,
			}),
			deleteEvent: tool({
				description: "Delete an event from the calendar",
				inputSchema: deleteEventInput,
			}),
			listEvents: tool({
				description: "List all events in the calendar, including their ids",
				inputSchema: z.object({}),
			}),
			geoLookup: tool({
				description:
					"Look up the latitude and longitude of an address or place name using OpenStreetMap. Returns up to 3 candidate matches.",
				inputSchema: z.object({
					rawAddress: z.string().describe("The full address or place name as written"),
					streetNumber: z.string().optional().describe("The street number"),
					streetName: z.string().optional().describe("The street name"),
					streetType: z.string().optional().describe("The street type, e.g. Road, Street"),
					suburb: z.string().optional().describe("The suburb"),
					city: z.string().optional().describe("The city or town"),
					state: z.string().optional().describe("The state or region"),
					postcode: z.string().optional().describe("The postcode"),
					country: z.string().optional().describe("The country"),
				}),
				execute: async (input) => {
					try {
						const results = await geoLookup(input);
						return results.length > 0 ? results : `No location found for "${input.rawAddress}"`;
					} catch (err) {
						return `Lookup failed: ${err instanceof Error ? err.message : String(err)}`;
					}
				},
			}),
		},
		// Lets the model continue after server-side tools (geoLookup); client-side tools still end the step
		stopWhen: isStepCount(5),
		messages: await convertToModelMessages(messages),
	});

	return createUIMessageStreamResponse({
		stream: toUIMessageStream({ stream: result.stream }),
	});
}
