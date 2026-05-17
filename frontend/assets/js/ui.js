/**
 * UI utilities — rendering helpers, toasts, markdown, etc.
 */

/* ── Markdown / code rendering ──────────────────────────── */

/**
 * Parse markdown-like syntax to HTML.
 * Supports: code blocks, inline code, bold, italic, lists, links.
 */
export function renderMarkdown(text) {
  if (!text) return "";

  let html = escapeHtml(text);

  /* Fenced code blocks ```lang\n...\n``` */
  html = html.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_, lang, code) => {
      const langLabel = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : "";
      return `<div class="code-block-wrapper">
        <div class="code-block-header">${langLabel}<button class="copy-code-btn" title="Copy code"><i class="bi bi-clipboard"></i></button></div>
        <pre><code class="language-${lang || "plaintext"}">${code.trimEnd()}</code></pre>
      </div>`;
    }
  );

  /* Inline code */
  html = html.replace(/`([^`]+)`/g, "<code class=\"inline-code\">$1</code>");

  /* Bold */
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  /* Italic */
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  /* Unordered lists */
  html = html.replace(/(^|\n)(- .+)/g, (_, pre, item) => {
    return `${pre}<li>${item.slice(2)}</li>`;
  });
  html = html.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");

  /* Links */
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  );

  /* Line breaks */
  html = html.replace(/\n/g, "<br>");

  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── Message bubble builders ────────────────────────────── */

/**
 * Build a user message DOM element
 * @param {string} text
 * @returns {HTMLElement}
 */
export function buildUserMessage(text) {
  const wrapper = document.createElement("div");
  wrapper.className = "message-wrapper user-wrapper";
  wrapper.innerHTML = `
    <div class="message-bubble user-bubble">
      <p class="mb-0">${escapeHtml(text)}</p>
    </div>
  `;
  return wrapper;
}

/**
 * Build an assistant message DOM element
 * @param {string} text  (markdown supported)
 * @returns {HTMLElement}
 */
export function buildAssistantMessage(text) {
  const wrapper = document.createElement("div");
  wrapper.className = "message-wrapper assistant-wrapper";
  wrapper.innerHTML = `
    <div class="assistant-avatar"><i class="bi bi-stars"></i></div>
    <div class="message-bubble assistant-bubble">
      <div class="message-content">${renderMarkdown(text)}</div>
      <div class="message-actions">
        <button class="action-btn copy-msg-btn" title="Copy"><i class="bi bi-clipboard"></i></button>
      </div>
    </div>
  `;

  /* Copy button */
  wrapper.querySelector(".copy-msg-btn").addEventListener("click", () => {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Copied to clipboard!", "success", 2000);
    });
  });

  /* Wire copy-code buttons inside code blocks */
  wrapper.querySelectorAll(".copy-code-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.closest(".code-block-wrapper").querySelector("code").innerText;
      navigator.clipboard.writeText(code).then(() => {
        btn.innerHTML = '<i class="bi bi-check-lg"></i>';
        setTimeout(() => (btn.innerHTML = '<i class="bi bi-clipboard"></i>'), 2000);
      });
    });
  });

  return wrapper;
}

/**
 * Build the typing indicator element
 * @returns {HTMLElement}
 */
export function buildTypingIndicator() {
  const el = document.createElement("div");
  el.id = "typingIndicator";
  el.className = "message-wrapper assistant-wrapper";
  el.innerHTML = `
    <div class="assistant-avatar"><i class="bi bi-stars"></i></div>
    <div class="message-bubble assistant-bubble typing-bubble">
      <span class="dot"></span><span class="dot"></span><span class="dot"></span>
    </div>
  `;
  return el;
}

/* ── Toast notifications ────────────────────────────────── */

/**
 * Show a Bootstrap toast notification
 * @param {string} message
 * @param {'success'|'danger'|'warning'|'info'} type
 * @param {number} duration  ms
 */
export function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const id = `toast-${Date.now()}`;
  const icons = { success: "check-circle", danger: "exclamation-triangle", warning: "exclamation-circle", info: "info-circle" };
  const icon = icons[type] || icons.info;

  const toastEl = document.createElement("div");
  toastEl.id = id;
  toastEl.className = `toast toast-${type} align-items-center border-0`;
  toastEl.setAttribute("role", "alert");
  toastEl.setAttribute("aria-live", "assertive");
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body d-flex align-items-center gap-2">
        <i class="bi bi-${icon}"></i> ${escapeHtml(message)}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;

  container.appendChild(toastEl);

  const toast = new bootstrap.Toast(toastEl, { delay: duration });
  toast.show();

  toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
}
