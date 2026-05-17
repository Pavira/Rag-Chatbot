# Agentic Bot — Frontend

A professional, ChatGPT-style chatbot UI built with **Bootstrap 5**, **Vanilla JavaScript (ES Modules)**, HTML5, and CSS3.

---

## Project Structure

```
frontend/
├── index.html            # Session creation / login page
├── chat.html             # Chat interface page
├── README.md
│
└── assets/
    ├── css/
    │   ├── global.css    # CSS variables, reset, toasts, shared utilities
    │   ├── login.css     # Login / session creation page styles
    │   └── chat.css      # Chat interface styles
    │
    ├── js/
    │   ├── config.js     # API base URL & app constants
    │   ├── api.js        # API service layer (createSession, getChatHistory, sendMessage)
    │   ├── session.js    # Login page logic
    │   ├── ui.js         # Reusable UI helpers (buildUserMessage, buildAssistantMessage, showToast, renderMarkdown)
    │   └── chat.js       # Chat page logic (history, send, voice, theme, sidebar)
    │
    ├── components/       # (Reserved for future HTML component snippets)
    └── images/           # (Reserved for static assets)
```

---

## Quick Start

### 1. Configure the API

Edit `assets/js/config.js`:

```js
const API_BASE_URL = "http://localhost:8000"; // ← your backend URL
```

### 2. Serve the frontend

Because the JS uses ES Modules (`import`/`export`), you **must** serve the files over HTTP — not from `file://`.

**Option A — VS Code Live Server**
Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) and click "Go Live".

**Option B — Python**
```bash
cd frontend
python -m http.server 3000
# Open http://localhost:3000
```

**Option C — Node `serve`**
```bash
npx serve frontend -p 3000
```

---

## Backend API Contract

| Endpoint | Method | Payload | Response |
|---|---|---|---|
| `/session` | `POST` | `{ "session_name": "Alice" }` | `{ "session_id": "...", "name": "Alice" }` |
| `/chat_history` | `GET` | `?session_id=<id>` | `[ { "role": "user\|assistant", "content": "..." } ]` |
| `/chat` | `POST` | `{ "session_id": "...", "message": "..." }` | `{ "reply": "..." }` |

---

## Features

| Feature | Status |
|---|---|
| Session creation with validation | ✅ |
| Auto-redirect if session exists | ✅ |
| Chat history loading on page load | ✅ |
| Markdown rendering in messages | ✅ |
| Fenced code blocks with copy button | ✅ |
| User / assistant message bubbles | ✅ |
| Typing indicator animation | ✅ |
| Auto-scroll to latest message | ✅ |
| Auto-expanding textarea | ✅ |
| Enter to send / Shift+Enter newline | ✅ |
| Voice input (Web Speech API) | ✅ |
| Copy message button | ✅ |
| Regenerate last response | ✅ |
| Dark / Light theme toggle | ✅ |
| Sidebar collapse (mobile drawer) | ✅ |
| Bootstrap toast notifications | ✅ |
| Welcome / empty-state screen | ✅ |
| Suggestion cards | ✅ |
| Responsive design (mobile-first) | ✅ |
| Session persistence via localStorage | ✅ |
| Logout / session clear | ✅ |

---

## Design

- **Fonts**: Sora (UI) + JetBrains Mono (code)
- **Theme**: Neutral dark default, light mode toggle
- **Accent**: `#2a6ef5` (blue)
- **Approach**: CSS custom properties for full theming; no inline styles; no inline scripts

---

## Browser Support

Modern browsers with ES Module support: Chrome 61+, Firefox 60+, Safari 10.1+, Edge 16+.
