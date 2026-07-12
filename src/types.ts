/**
 * Type definitions for the LLM chat application.
 */

export interface Env {
	/**
	 * Binding for the Workers AI API.
	 */
	AI: Ai;

	/**
	 * Binding for the Cloudflare AI Search instance.
	 */
	PARAISO_SEARCH: AiSearchInstance;

	/**
	 * Binding for static assets.
	 */
	ASSETS: {
		fetch: (request: Request) => Promise<Response>;
	};
}

/**
 * Represents a chat message.
 */
export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}
