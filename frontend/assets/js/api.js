/**
 * API Service Layer — all backend calls centralised here
 */

import CONFIG from "./config.js";

const { API_BASE_URL } = CONFIG;

/**
 * Generic fetch wrapper with error handling
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.detail || data.message || `Error ${response.status}`;
    throw new Error(message);
  }

  return data;
}

/**
 * Create a new session with the provided name
 * @param {string} sessionName
 * @returns {Promise<{session_id: string, name: string}>}
 */
export async function createSession(sessionName) {
  return request("/rag/session", {
    method: "POST",
    body: JSON.stringify({ name: sessionName }),
  });
}

/**
 * Fetch chat history for a session
 * @param {string} sessionId
 * @returns {Promise<Array<{role: string, content: string}>>}
 */
export async function getChatHistory(sessionId) {
  const raw = await request(
    `/rag/chat_history/${encodeURIComponent(sessionId)}`,
  );

  const history = Array.isArray(raw)
    ? raw
    : raw?.history || raw?.data || raw?.messages || [];

  return history
    .map((item) => ({
      role: item?.role || item?.type || item?.sender || "assistant",
      content:
        item?.content || item?.message || item?.text || item?.answer || "",
    }))
    .filter((item) => item.content);
}

/**
 * Send a message and receive an assistant reply
 * @param {string} sessionId
 * @param {string} message
 * @returns {Promise<{reply: string}>}
 */
export async function sendMessage(sessionId, message) {
  const raw = await request("/rag/chat", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      question: message,
    }),
  });

  return {
    ...raw,
    reply: raw?.answer || "",
  };
}
