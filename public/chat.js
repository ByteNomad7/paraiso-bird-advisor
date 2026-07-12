const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const messagesContainer = document.getElementById("messages");
const quickActions = document.getElementById("quick-actions");

const conversation = [];

let isSubmitting = false;

function scrollToBottom() {
	messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(value) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function formatMessage(value) {
	const escaped = escapeHtml(value);

	const linked = escaped.replace(
		/(https?:\/\/[^\s<]+)/g,
		(url) =>
			`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
	);

	return linked.replace(/\n/g, "<br>");
}

function createMessage(role, content, options = {}) {
	const row = document.createElement("div");
	row.className = `message-row ${role}`;

	const bubble = document.createElement("div");
	bubble.className = "message-bubble";

	if (options.typing) {
		bubble.innerHTML = `
			<span class="typing" aria-label="Escribiendo">
				<span></span>
				<span></span>
				<span></span>
			</span>
		`;
	} else {
		bubble.innerHTML = formatMessage(content);
	}

	row.appendChild(bubble);
	messagesContainer.appendChild(row);
	scrollToBottom();

	return {
		row,
		bubble,
	};
}

function setLoading(loading) {
	isSubmitting = loading;
	sendButton.disabled = loading;
	input.disabled = loading;
	sendButton.textContent = loading ? "..." : "Enviar";
}

function hideQuickActions() {
	if (quickActions) {
		quickActions.remove();
	}
}

async function submitMessage(message) {
	const cleanMessage = message.trim();

	if (!cleanMessage || isSubmitting) {
		return;
	}

	hideQuickActions();

	createMessage("user", cleanMessage);

	conversation.push({
		role: "user",
		content: cleanMessage,
	});

	input.value = "";
	setLoading(true);

	const typingMessage = createMessage("assistant", "", {
		typing: true,
	});

	try {
		const response = await fetch("/api/chat", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				messages: conversation.slice(-10),
			}),
		});

		if (!response.ok) {
			const errorBody = await response
				.json()
				.catch(() => null);

			throw new Error(
				errorBody?.details ||
					errorBody?.error ||
					`Request failed with status ${response.status}`,
			);
		}

		if (!response.body) {
			throw new Error("The response stream is unavailable.");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		let buffer = "";
		let answer = "";

		typingMessage.bubble.innerHTML = "";

		while (true) {
			const { value, done } = await reader.read();

			if (done) {
				break;
			}

			buffer += decoder.decode(value, {
				stream: true,
			});

			const events = buffer.split("\n\n");
			buffer = events.pop() || "";

			for (const event of events) {
				const lines = event.split("\n");

				for (const line of lines) {
					if (!line.startsWith("data:")) {
						continue;
					}

					const rawData = line.slice(5).trim();

					if (!rawData || rawData === "[DONE]") {
						continue;
					}

					try {
						const parsed = JSON.parse(rawData);

						/*
						 * Ignore AI Search source-chunk metadata events.
						 * Only append generated response text.
						 */
						if (
							parsed.type === "chunks" ||
							parsed.chunks
						) {
							continue;
						}

						const token =
							parsed.response ||
							parsed.token ||
							parsed.delta ||
							parsed.choices?.[0]?.delta
								?.content ||
							parsed.choices?.[0]?.message
								?.content ||
							"";

						if (typeof token === "string") {
							answer += token;
							typingMessage.bubble.innerHTML =
								formatMessage(answer);
							scrollToBottom();
						}
					} catch {
						/*
						 * Some Workers AI streams provide plain text
						 * after "data:". Append it safely.
						 */
						answer += rawData;
						typingMessage.bubble.innerHTML =
							formatMessage(answer);
						scrollToBottom();
					}
				}
			}
		}

		if (!answer.trim()) {
			throw new Error(
				"No se recibió una respuesta del asistente.",
			);
		}

		conversation.push({
			role: "assistant",
			content: answer,
		});
	} catch (error) {
		console.error("Chat error:", error);

		typingMessage.bubble.classList.add("error-message");
		typingMessage.bubble.textContent =
			"Lo sentimos, el asesor no está disponible en este momento. Puede escribirnos a paraisodeloros@gmail.com.";
	} finally {
		setLoading(false);
		input.focus();
		scrollToBottom();
	}
}

form.addEventListener("submit", (event) => {
	event.preventDefault();
	submitMessage(input.value);
});

input.addEventListener("keydown", (event) => {
	if (
		event.key === "Enter" &&
		!event.shiftKey &&
		!event.isComposing
	) {
		event.preventDefault();
		form.requestSubmit();
	}
});

document.querySelectorAll(".quick-action").forEach((button) => {
	button.addEventListener("click", () => {
		const message = button.dataset.message;

		if (message) {
			submitMessage(message);
		}
	});
});

input.focus();
scrollToBottom();
