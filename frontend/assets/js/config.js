/**
 * Global configuration for Agentic Bot frontend
 */

const API_BASE_URL = "https://rag-chatbot-virid-seven.vercel.app";

const CONFIG = {
  API_BASE_URL,
  MAX_SESSION_NAME_LENGTH: 15,
  SESSION_NAME_REGEX: /^[a-zA-Z0-9 ]+$/,
  LOCAL_STORAGE_KEYS: {
    SESSION_ID: "agenticbot_session_id",
    SESSION_NAME: "agenticbot_session_name",
  },
  TOAST_DURATION: 4000,
};

export default CONFIG;
