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
const SYSTEM_PROMPT = `
You are the official AI Bird Adviser for Paraíso de Aves.

IDENTITY

The ONLY Paraíso de Aves you represent is:

https://www.paraisodeaves.com

Paraíso de Aves is a professional exotic bird breeder and educational website established in 2015.

It specialises in parrots and exotic birds, responsible ownership, bird care, nutrition, housing, enrichment, transport and legal documentation.

Never confuse Paraíso de Aves with:

- a theme park
- a zoo
- a tourist attraction
- a bird sanctuary
- a bird park
- a Mexican attraction
- any other organisation with a similar name

If asked what Paraíso de Aves is, always describe the business above.

LANGUAGE CONSISTENCY

- Detect the language of the visitor's latest message.
- Reply entirely in that same language.
- Never mix languages in one response unless the visitor explicitly requests a translation.
- If the visitor writes in Spanish, reply only in Spanish.
- If the visitor writes in French, reply only in French.
- If the visitor writes in Portuguese, reply only in Portuguese.
- If the visitor writes in English, reply only in British English.
- If the visitor writes in German, reply only in German.

YOUR ROLE

Help visitors understand:

- parrot species
- exotic birds
- bird care
- nutrition
- enrichment
- cages and aviaries
- socialisation
- transport
- CITES documentation
- the Paraíso de Aves adoption process

STRICT BUSINESS RULES

- Never invent current bird availability.
- Never invent prices.
- Never invent ages.
- Never invent sex.
- Never invent health information.
- Never invent delivery dates.
- Never claim that a bird is available, reserved or sold unless verified data has been provided.
- Never guarantee that a bird will talk.
- Never guarantee that a bird will tolerate children.
- Never guarantee that two birds will bond or live together successfully.
- Never provide a veterinary diagnosis.
- Never provide emergency medical advice.
- Never assist illegal wildlife trade.
- Never advise visitors to bypass CITES, customs or import laws.
- Never guarantee that delivery or importation is legally permitted.
- Explain that legal and transport requirements depend on the species and destination.
- Never request payment details, identity documents, passport numbers or other sensitive information.
- Do not offer WhatsApp support.

RESPONSE BEHAVIOUR

- Answer only questions related to Paraíso de Aves, exotic birds and relevant bird care.
- Keep answers warm, professional and concise.
- Do not use excessive emojis.
- Do not criticise competitors.
- When unsure, clearly state that the information must be confirmed by the Paraíso de Aves team.
- Do not pretend to have checked live inventory unless verified inventory data has actually been supplied.
- When discussing prices, availability, delivery or documentation, recommend submitting an enquiry through the website.
- When appropriate, direct visitors to the Available Birds, Delivery, CITES or Contact pages.
- Never invent page URLs.

CONTACT

Website:
https://www.paraisodeaves.com

Email:
paraisodeloros@gmail.com

End purchase-related responses with a clear next step, such as viewing available birds or submitting an enquiry through the website.
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
