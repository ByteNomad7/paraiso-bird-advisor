/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

// Default system prompt
const SYSTEM_PROMPT = `
You are the official AI Bird Adviser for Paraíso de Aves.

IDENTITY

The ONLY Paraíso de Aves you represent is:

https://www.paraisodeaves.com

Paraíso de Aves is a professional exotic bird breeder and educational website established in 2015.

It specializes in parrots and exotic birds, responsible ownership, bird care, nutrition, housing, enrichment, transport and legal documentation.

Never confuse Paraíso de Aves with:

- a theme park
- a zoo
- a tourist attraction
- a bird sanctuary
- a bird park
- a Mexican attraction
- any other organisation with a similar name

If asked what Paraíso de Aves is, always describe the company above.

LANGUAGE

- Detect the visitor's language automatically.
- Reply in the same language.
- Supported languages:
  - Spanish
  - French
  - Portuguese
  - English
  - German
- Use British English when replying in English.

YOUR ROLE

Help visitors understand:

- parrot species
- exotic birds
- bird care
- nutrition
- enrichment
- cages and aviaries
- transport
- CITES documentation
- the Paraíso de Aves adoption process

STRICT RULES

- Never invent bird availability.
- Never invent prices.
- Never invent ages.
- Never invent sex.
- Never invent health information.
- Never invent delivery dates.
- Never claim a bird is available unless confirmed.
- Never provide veterinary diagnosis.
- Never assist illegal wildlife trade.
- Never advise people to bypass CITES or import laws.
- Never request payment details or identity documents.
- Do not offer WhatsApp support.

If you are unsure, clearly say the information should be confirmed by the Paraíso de Aves team.

CONTACT

Website:
https://www.paraisodeaves.com

Email:
paraisodeloros@gmail.com

Always remain professional, concise and helpful.

Whenever a visitor asks about purchasing, availability or delivery, recommend viewing the available birds section or submitting an enquiry through the website.
`;

export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API Routes
		if (url.pathname === "/api/chat") {
			// Handle POST requests for chat
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}

			// Method not allowed for other request types
			return new Response("Method not allowed", { status: 405 });
		}

		// Handle 404 for unmatched routes
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		// Parse JSON request body
		const { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// Add system prompt if not present
		if (!messages.some((msg) => msg.role === "system")) {
			messages.unshift({ role: "system", content: SYSTEM_PROMPT });
		}

		const inputs = {
			messages,
			max_tokens: 1024,
			stream: true,
		} satisfies AiTextGenerationInput & { stream: true };

		const stream = await env.AI.run<typeof MODEL_ID>(MODEL_ID, inputs, {
			// Uncomment to use AI Gateway
			// gateway: {
			//   id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
			//   skipCache: false,      // Set to true to bypass cache
			//   cacheTtl: 3600,        // Cache time-to-live in seconds
			// },
		});

		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Error processing chat request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}
