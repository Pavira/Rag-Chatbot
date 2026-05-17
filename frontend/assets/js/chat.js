/**
 * Chat page logic � history loading, sending messages, voice input, etc.
 */

import CONFIG from "./config.js";
import { getChatHistory, sendMessage } from "./api.js";
import {
  buildUserMessage,
  buildAssistantMessage,
  buildTypingIndicator,
  showToast,
} from "./ui.js";

const { LOCAL_STORAGE_KEYS } = CONFIG;

/* �� Session guard ������������������������������������������������ */
const sessionId = localStorage.getItem(LOCAL_STORAGE_KEYS.SESSION_ID);
const sessionName =
  localStorage.getItem(LOCAL_STORAGE_KEYS.SESSION_NAME) || "there";

if (!sessionId) {
  window.location.href = "index.html";
}

/* �� DOM References ������������������������������������������������ */
const messagesContainer = document.getElementById("messagesContainer");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const voiceBtn = document.getElementById("voiceBtn");
const themeToggle = document.getElementById("themeToggle");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.getElementById("sidebar");
const logoutBtn = document.getElementById("logoutBtn");
const userNameDisplay = document.getElementById("userNameDisplay");
const newChatBtn = document.getElementById("newChatBtn");

/* Set display name */
if (userNameDisplay) userNameDisplay.textContent = sessionName;

/* �� State  */
let isTyping = false;
let darkMode = localStorage.getItem("agenticbot_theme") !== "light";

/* �� Theme  */
applyTheme(darkMode);

themeToggle?.addEventListener("click", () => {
  darkMode = !darkMode;
  applyTheme(darkMode);
  localStorage.setItem("agenticbot_theme", darkMode ? "dark" : "light");
});

function applyTheme(dark) {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  if (themeToggle) {
    themeToggle.innerHTML = dark
      ? '<i class="bi bi-sun-fill"></i>'
      : '<i class="bi bi-moon-fill"></i>';
  }
}

/* �� Sidebar toggle ����������������������������������������������� */
sidebarToggle?.addEventListener("click", () => {
  sidebar?.classList.toggle("sidebar-open");
});

/* Close sidebar on overlay click (mobile) */
document.addEventListener("click", (e) => {
  if (
    sidebar?.classList.contains("sidebar-open") &&
    !sidebar.contains(e.target) &&
    e.target !== sidebarToggle
  ) {
    sidebar.classList.remove("sidebar-open");
  }
});

/* �� Logout ���������������������������������������������������������� */
logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem(LOCAL_STORAGE_KEYS.SESSION_ID);
  localStorage.removeItem(LOCAL_STORAGE_KEYS.SESSION_NAME);
  window.location.href = "index.html";
});

/* �� New chat (future placeholder) ������������������������������� */
newChatBtn?.addEventListener("click", () => {
  showToast("This functionality will be implemented in future.", "info");
});

/* �� Load chat history on page load ������������������������������� */
(async function loadHistory() {
  showLoadingState();
  try {
    const history = await getChatHistory(sessionId);
    hideLoadingState();

    if (!history || history.length === 0) {
      showWelcome();
      return;
    }

    history.forEach(({ role, content }) => {
      if (role === "user") {
        messagesContainer.appendChild(buildUserMessage(content));
      } else {
        messagesContainer.appendChild(buildAssistantMessage(content));
      }
    });

    scrollToBottom();
  } catch (err) {
    hideLoadingState();
    showWelcome();
    showToast("Could not load history: " + err.message, "warning");
  }
})();

/* �� Welcome screen ����������������������������������������������� */
function showWelcome() {
  const suggestions = [
    { icon: "bi-lightbulb", text: "In what project does he worked?" },
    { icon: "bi-code-slash", text: "Do he have AI domain knowledge?" },
    { icon: "bi-bar-chart-line", text: "What skills does he have?" },
    {
      icon: "bi-pencil-square",
      text: "How many years of experience does he have?",
    },
  ];

  const cards = suggestions
    .map(
      (s) => `
    <button class="suggestion-card" data-prompt="${s.text}">
      <i class="bi ${s.icon}"></i>
      <span>${s.text}</span>
    </button>`,
    )
    .join("");

  messagesContainer.innerHTML = `
    <div class="welcome-screen" id="welcomeScreen">
      <div class="welcome-logo"><i class="bi bi-stars"></i></div>
      <h1 class="welcome-title">Welcome back, <span class="highlight">${sessionName}</span></h1>
      <p class="welcome-subtitle">Ask questions about "Pavithiran CV"</p>
      <div class="suggestion-grid">${cards}</div>
    </div>
  `;

  /* Suggestion card clicks */
  messagesContainer.querySelectorAll(".suggestion-card").forEach((card) => {
    card.addEventListener("click", () => {
      const prompt = card.dataset.prompt;
      chatInput.value = prompt;
      autoResize();
      handleSend();
    });
  });
}

/* �� Loading state ��������������������������������������������������� */
function showLoadingState() {
  messagesContainer.innerHTML = `
    <div class="d-flex justify-content-center align-items-center h-100">
      <div class="spinner-border text-secondary opacity-50" role="status">
        <span class="visually-hidden">Loading history�</span>
      </div>
    </div>
  `;
}

function hideLoadingState() {
  messagesContainer.innerHTML = "";
}

/* �� Auto-resize textarea ������������������������������������������ */
chatInput.addEventListener("input", autoResize);

function autoResize() {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + "px";
}

/* �� Send on Enter, newline on Shift+Enter ����������������������� */
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

sendBtn.addEventListener("click", handleSend);

/* �� Core send flow ����������������������������������������������� */
async function handleSend() {
  const message = chatInput.value.trim();
  if (!message || isTyping) return;

  /* Clear welcome screen */
  document.getElementById("welcomeScreen")?.remove();

  /* Show user bubble */
  messagesContainer.appendChild(buildUserMessage(message));
  chatInput.value = "";
  autoResize();
  scrollToBottom();

  /* Typing indicator */
  isTyping = true;
  setSendDisabled(true);
  const typingEl = buildTypingIndicator();
  messagesContainer.appendChild(typingEl);
  scrollToBottom();

  try {
    const data = await sendMessage(sessionId, message);
    typingEl.remove();
    const reply = data.reply || data.response || data.message || "�";
    messagesContainer.appendChild(buildAssistantMessage(reply));
  } catch (err) {
    typingEl.remove();
    messagesContainer.appendChild(buildErrorBubble(err.message));
    showToast("Message failed: " + err.message, "danger");
  } finally {
    isTyping = false;
    setSendDisabled(false);
    scrollToBottom();
    chatInput.focus();
  }
}

/* �� Error bubble ����������������������������������������������������� */
function buildErrorBubble(msg) {
  const el = document.createElement("div");
  el.className = "message-wrapper assistant-wrapper";
  el.innerHTML = `
    <div class="assistant-avatar error-avatar"><i class="bi bi-exclamation-triangle"></i></div>
    <div class="message-bubble assistant-bubble error-bubble">
      <p class="mb-0 text-danger-emphasis"><i class="bi bi-wifi-off me-2"></i>${msg || "Something went wrong."}</p>
    </div>
  `;
  return el;
}

/* �� Voice input (Web Speech API) ����������������������������������� */
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  let listening = false;

  voiceBtn?.addEventListener("click", () => {
    if (listening) {
      recognition.stop();
      return;
    }
    recognition.start();
  });

  recognition.onstart = () => {
    listening = true;
    voiceBtn?.classList.add("listening");
    showToast("Listening� speak now", "info", 2500);
  };

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    chatInput.value = transcript;
    autoResize();
  };

  recognition.onend = () => {
    listening = false;
    voiceBtn?.classList.remove("listening");
  };

  recognition.onerror = () => {
    listening = false;
    voiceBtn?.classList.remove("listening");
    showToast("Microphone access denied or unavailable.", "warning");
  };
} else {
  /* Hide mic button if API not supported */
  voiceBtn?.classList.add("d-none");
}

/* �� Helpers ��������������������������������������������������������� */
function scrollToBottom() {
  messagesContainer.scrollTo({
    top: messagesContainer.scrollHeight,
    behavior: "smooth",
  });
}

function setSendDisabled(disabled) {
  sendBtn.disabled = disabled;
  sendBtn.innerHTML = disabled
    ? '<span class="spinner-border spinner-border-sm"></span>'
    : '<i class="bi bi-send-fill"></i>';
}
