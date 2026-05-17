/**
 * Session page logic — handles session creation and localStorage
 */

import CONFIG from "./config.js";
import { createSession } from "./api.js";
import { showToast } from "./ui.js";

const { LOCAL_STORAGE_KEYS, MAX_SESSION_NAME_LENGTH, SESSION_NAME_REGEX } = CONFIG;

/* ── DOM References ─────────────────────────────────────── */
const form        = document.getElementById("sessionForm");
const nameInput   = document.getElementById("sessionName");
const submitBtn   = document.getElementById("submitBtn");
const btnText     = document.getElementById("btnText");
const btnSpinner  = document.getElementById("btnSpinner");
const errorMsg    = document.getElementById("errorMessage");
const charCount   = document.getElementById("charCount");

/* ── Redirect if already has a session ─────────────────── */
if (localStorage.getItem(LOCAL_STORAGE_KEYS.SESSION_ID)) {
  window.location.href = "chat.html";
}

/* ── Character counter ──────────────────────────────────── */
nameInput.addEventListener("input", () => {
  const len = nameInput.value.length;
  charCount.textContent = `${len}/${MAX_SESSION_NAME_LENGTH}`;
  charCount.classList.toggle("text-warning", len >= MAX_SESSION_NAME_LENGTH - 2);
  charCount.classList.toggle("text-danger",  len >= MAX_SESSION_NAME_LENGTH);
  errorMsg.classList.add("d-none");
});

/* ── Form submit ────────────────────────────────────────── */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = nameInput.value.trim();

  /* Validate */
  if (!name) {
    return showError("Please enter your name.");
  }
  if (name.length > MAX_SESSION_NAME_LENGTH) {
    return showError(`Name must be ${MAX_SESSION_NAME_LENGTH} characters or fewer.`);
  }
  if (!SESSION_NAME_REGEX.test(name)) {
    return showError("Only letters, numbers, and spaces are allowed.");
  }

  setLoading(true);

  try {
    const data = await createSession(name);
    localStorage.setItem(LOCAL_STORAGE_KEYS.SESSION_ID,   data.session_id);
    localStorage.setItem(LOCAL_STORAGE_KEYS.SESSION_NAME, name);
    window.location.href = "chat.html";
  } catch (err) {
    showError(err.message || "Failed to create session. Please try again.");
    showToast(err.message || "Session creation failed.", "danger");
  } finally {
    setLoading(false);
  }
});

/* ── Helpers ────────────────────────────────────────────── */
function setLoading(loading) {
  submitBtn.disabled = loading;
  btnText.textContent = loading ? "Creating…" : "Start Chatting";
  btnSpinner.classList.toggle("d-none", !loading);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("d-none");
  nameInput.focus();
}
