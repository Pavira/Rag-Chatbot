import { showToast } from "./ui.js";
import CONFIG from "./config.js";

const { API_BASE_URL } = CONFIG;

const allowedExtensions = [".pdf", ".docx"];
const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const pipelineStages = [
  "Uploading document",
  "Extracting text from document",
  "Cleaning and preprocessing content",
  "Creating chunks",
  "Generating embeddings",
  "Calculating similarity matrix",
  "Storing embeddings in PostgreSQL",
  "Finalizing indexing",
];

const state = {
  selectedFile: null,
  isProcessing: false,
  requiresReset: false,
  simulationTimer: null,
  previewUrl: null,
  activeStageIndex: -1,
};

const refs = {
  dropzone: document.getElementById("dropzone"),
  documentInput: document.getElementById("documentInput"),
  uploadValidationError: document.getElementById("uploadValidationError"),
  filePreviewCard: document.getElementById("filePreviewCard"),
  previewName: document.getElementById("previewName"),
  previewSize: document.getElementById("previewSize"),
  // previewType: document.getElementById("previewType"),
  previewStatus: document.getElementById("previewStatus"),
  previewPane: document.getElementById("previewPane"),
  uploadBtn: document.getElementById("uploadBtn"),
  uploadBtnSpinner: document.getElementById("uploadBtnSpinner"),
  uploadBtnText: document.getElementById("uploadBtnText"),
  resetUploadBtn: document.getElementById("resetUploadBtn"),
  pipelineSection: document.getElementById("pipelineSection"),
  pipelineSteps: document.getElementById("pipelineSteps"),
  pipelineProgressBar: document.getElementById("pipelineProgressBar"),
  pipelineProgressValue: document.getElementById("pipelineProgressValue"),
  metadataSection: document.getElementById("metadataSection"),
  metadataGrid: document.getElementById("metadataGrid"),
  matrixSection: document.getElementById("matrixSection"),
  matrixTable: document.getElementById("matrixTable"),
};

init();

function init() {
  if (!refs.dropzone || !refs.documentInput || !refs.uploadBtn) {
    return;
  }

  refs.pipelineSteps.innerHTML = pipelineStages
    .map(
      (stage, index) => `
      <li class="pipeline-step" data-stage-index="${index}">
        <i class="bi bi-circle"></i>
        <span>${escapeHtml(stage)}</span>
      </li>
    `,
    )
    .join("");

  refs.documentInput.addEventListener("change", (event) => {
    handleFileSelection(event.target.files?.[0]);
  });

  refs.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.dropzone.classList.add("is-dragging");
  });

  refs.dropzone.addEventListener("dragleave", () => {
    refs.dropzone.classList.remove("is-dragging");
  });

  refs.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.dropzone.classList.remove("is-dragging");

    if (state.isProcessing) {
      showToast(
        "Please wait. A document is already being processed.",
        "warning",
      );
      return;
    }

    const file = event.dataTransfer?.files?.[0];
    handleFileSelection(file);
  });

  refs.uploadBtn.addEventListener("click", () => {
    if (!state.selectedFile) {
      showToast("Select a PDF or DOCX file first.", "warning");
      return;
    }

    if (state.isProcessing) {
      showToast("Processing is already in progress.", "warning");
      return;
    }

    void uploadDocument(state.selectedFile);
  });

  refs.resetUploadBtn?.addEventListener("click", () => {
    resetUploadWorkflow();
  });

  setProcessingState(false);
}

function handleFileSelection(file) {
  clearValidationError();

  if (!file) return;
  if (state.requiresReset) {
    showToast("Click Reset to start a new upload.", "info");
    return;
  }

  if (state.isProcessing) {
    showToast("Please wait for current processing to finish.", "warning");
    return;
  }

  if (!isAllowedFile(file)) {
    state.selectedFile = null;
    refs.documentInput.value = "";
    showValidationError("Only PDF and DOCX files are supported.");
    showToast("Only PDF and DOCX files are supported.", "danger");
    refs.filePreviewCard.classList.add("d-none");
    return;
  }

  state.selectedFile = file;
  showFilePreview(file);
  refs.filePreviewCard.classList.remove("d-none");
  setProcessingState(false);
  refs.pipelineSection.classList.add("d-none");
  refs.metadataSection.classList.add("d-none");
  refs.matrixSection.classList.add("d-none");
}

function showFilePreview(file) {
  refs.previewName.textContent = file.name;
  refs.previewSize.textContent = formatFileSize(file.size);
  // refs.previewType.textContent =
  //   file.type || getFileExtension(file.name).toUpperCase().replace(".", "");
  setPreviewStatus("Ready", "idle");

  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }

  const extension = getFileExtension(file.name);
  if (extension === ".pdf") {
    state.previewUrl = URL.createObjectURL(file);
    refs.previewPane.innerHTML = `<embed src="${state.previewUrl}" type="application/pdf" />`;
  } else {
    refs.previewPane.innerHTML = `
      <div class="text-center px-3">
        <i class="bi bi-file-earmark-word fs-3 d-block mb-2 text-info"></i>
        <p class="mb-1">DOCX preview is limited in browser.</p>
        <small class="text-secondary">The file will be validated and processed after upload.</small>
      </div>
    `;
  }
}

async function uploadDocument(file) {
  setProcessingState(true);
  resetPipelineUI();
  refs.pipelineSection.classList.remove("d-none");
  refs.metadataSection.classList.add("d-none");
  refs.matrixSection.classList.add("d-none");

  try {
    setPreviewStatus("Uploading", "running");

    const formData = new FormData();
    formData.append("file", file);

    startStageSimulation();

    const response = await fetch(`${API_BASE_URL}/rag/upload`, {
      method: "POST",
      body: formData,
    });

    const payload = await parseUploadResponse(response);

    if (!response.ok) {
      const backendMessage =
        payload?.detail ||
        payload?.message ||
        payload?.error ||
        "Upload failed.";
      if (
        String(backendMessage).toLowerCase().includes("pdf") ||
        String(backendMessage).toLowerCase().includes("docx") ||
        String(backendMessage).toLowerCase().includes("supported")
      ) {
        showValidationError("Only PDF and DOCX files are supported.");
      }
      throw new Error(backendMessage);
    }

    if (
      payload?.processing_stages &&
      Array.isArray(payload.processing_stages)
    ) {
      applyServerStages(payload.processing_stages);
    } else {
      markAllStagesComplete();
    }

    setPreviewStatus("Completed", "success");
    state.requiresReset = true;
    showToast("Document uploaded and indexed successfully.", "success");
    renderMetadata(payload, file);
    renderSimilarityMatrix(payload?.similarity_matrix);
    syncActionButtons();
  } catch (error) {
    stopStageSimulation();
    markStageError(error.message || "Processing failed");
    setPreviewStatus("Failed", "error");
    state.requiresReset = true;
    showToast(error.message || "Upload failed.", "danger");
    syncActionButtons();
  } finally {
    setProcessingState(false);
  }
}

async function parseUploadResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function startStageSimulation() {
  stopStageSimulation();
  state.activeStageIndex = -1;

  const tick = () => {
    if (state.activeStageIndex < pipelineStages.length - 1) {
      updatePipelineStep(state.activeStageIndex + 1);
      state.simulationTimer = window.setTimeout(tick, 1200);
    }
  };

  tick();
}

function stopStageSimulation() {
  if (state.simulationTimer) {
    clearTimeout(state.simulationTimer);
    state.simulationTimer = null;
  }
}

function updatePipelineStep(nextIndex) {
  state.activeStageIndex = nextIndex;

  const steps = refs.pipelineSteps.querySelectorAll(".pipeline-step");
  steps.forEach((step, index) => {
    step.classList.remove("active", "done", "error");
    const icon = step.querySelector("i");

    if (index < nextIndex) {
      step.classList.add("done");
      icon.className = "bi bi-check-circle-fill";
    } else if (index === nextIndex) {
      step.classList.add("active");
      icon.className = "bi bi-arrow-repeat";
    } else {
      icon.className = "bi bi-circle";
    }
  });

  const progress = Math.round((nextIndex / (pipelineStages.length - 1)) * 100);
  setProgress(progress);
}

function markAllStagesComplete() {
  stopStageSimulation();

  const steps = refs.pipelineSteps.querySelectorAll(".pipeline-step");
  steps.forEach((step) => {
    step.classList.remove("active", "error");
    step.classList.add("done");
    step.querySelector("i").className = "bi bi-check-circle-fill";
  });

  state.activeStageIndex = pipelineStages.length - 1;
  setProgress(100);
}

function markStageError(message) {
  const steps = refs.pipelineSteps.querySelectorAll(".pipeline-step");
  const index = Math.max(state.activeStageIndex, 0);
  const current = steps[index];

  if (current) {
    current.classList.remove("active", "done");
    current.classList.add("error");
    current.querySelector("i").className = "bi bi-x-circle-fill";
    const textSpan = current.querySelector("span");
    textSpan.textContent = message
      ? `${pipelineStages[index]} (${message})`
      : pipelineStages[index];
  }
}

function applyServerStages(stages) {
  stopStageSimulation();
  resetPipelineUI();

  const normalized = stages.map((stage) => normalizeStage(stage));
  const localNormalized = pipelineStages.map((stage) => normalizeStage(stage));

  localNormalized.forEach((localStage, index) => {
    if (normalized.includes(localStage)) {
      updatePipelineStep(index);
    }
  });

  markAllStagesComplete();
}

function resetPipelineUI() {
  setProgress(0);
  state.activeStageIndex = -1;
  refs.pipelineSteps.querySelectorAll(".pipeline-step").forEach((step) => {
    step.classList.remove("active", "done", "error");
    step.querySelector("i").className = "bi bi-circle";
    const index = Number(step.dataset.stageIndex);
    step.querySelector("span").textContent = pipelineStages[index];
  });
}

function renderSimilarityMatrix(matrix) {
  if (
    !Array.isArray(matrix) ||
    matrix.length === 0 ||
    !Array.isArray(matrix[0])
  ) {
    refs.matrixSection.classList.add("d-none");
    return;
  }

  const header = `<thead><tr><th>Chunk</th>${matrix[0].map((_, i) => `<th>C${i + 1}</th>`).join("")}</tr></thead>`;
  const body = matrix
    .map(
      (row, rowIndex) =>
        `<tr><th>C${rowIndex + 1}</th>${row.map((value) => `<td>${formatMatrixValue(value)}</td>`).join("")}</tr>`,
    )
    .join("");

  refs.matrixTable.innerHTML = `${header}<tbody>${body}</tbody>`;
  refs.matrixSection.classList.remove("d-none");
}

function renderMetadata(payload, file) {
  const meta = payload?.metadata || {};
  const metadata = {
    "File name": meta.document_name || file.name,
    "Total pages": meta.total_pages ?? "N/A",
    "Total chunks created": meta.total_chunks ?? "N/A",
    "Embedding model used": meta.embedding_model ?? "N/A",
    "Chunk size": meta.chunk_size ?? "N/A",
    "Processing time": Number.isFinite(meta.processing_time_seconds)
      ? `${meta.processing_time_seconds}s`
      : "N/A",
    "Upload timestamp": meta.upload_timestamp ?? new Date().toISOString(),
    "Database storage status": meta.db_storage_status ?? "N/A",
  };

  refs.metadataGrid.innerHTML = Object.entries(metadata)
    .map(
      ([label, value]) => `
      <article class="meta-item">
        <div class="meta-label">${escapeHtml(label)}</div>
        <div class="meta-value">${escapeHtml(String(value))}</div>
      </article>
    `,
    )
    .join("");

  refs.metadataSection.classList.remove("d-none");
}

function setProcessingState(isProcessing) {
  state.isProcessing = isProcessing;
  refs.uploadBtn.disabled =
    isProcessing || !state.selectedFile || state.requiresReset;
  refs.documentInput.disabled = isProcessing;
  refs.uploadBtnText.textContent = isProcessing ? "Processing..." : "Upload";
  refs.uploadBtnSpinner.classList.toggle("d-none", !isProcessing);
  syncActionButtons();
}

function setPreviewStatus(label, stateType) {
  refs.previewStatus.textContent = label;
  refs.previewStatus.className = `status-pill status-${stateType}`;
}

function setProgress(value) {
  const bounded = Math.max(0, Math.min(100, value));
  refs.pipelineProgressBar.style.width = `${bounded}%`;
  refs.pipelineProgressValue.textContent = `${bounded}%`;
}

function showValidationError(message) {
  refs.uploadValidationError.querySelector("span").textContent = message;
  refs.uploadValidationError.classList.remove("d-none");
}

function clearValidationError() {
  refs.uploadValidationError.classList.add("d-none");
}

function isAllowedFile(file) {
  const extension = getFileExtension(file.name);
  const typeAllowed = !file.type || allowedMimeTypes.includes(file.type);
  return allowedExtensions.includes(extension) && typeAllowed;
}

function getFileExtension(fileName) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1 ? "" : fileName.slice(dotIndex).toLowerCase();
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function formatMatrixValue(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toFixed(4)
    : escapeHtml(String(value));
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeStage(stage) {
  return String(stage).trim().toLowerCase().replaceAll(/\s+/g, " ");
}

function syncActionButtons() {
  refs.resetUploadBtn?.classList.toggle("d-none", !state.requiresReset);
}

function resetUploadWorkflow() {
  stopStageSimulation();

  state.requiresReset = false;
  state.selectedFile = null;
  state.activeStageIndex = -1;

  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }

  refs.documentInput.value = "";
  refs.previewName.textContent = "";
  refs.previewSize.textContent = "";
  // refs.previewType.textContent = "";
  refs.previewPane.innerHTML = "";
  setPreviewStatus("Ready", "idle");

  refs.filePreviewCard.classList.add("d-none");
  refs.pipelineSection.classList.add("d-none");
  refs.metadataSection.classList.add("d-none");
  refs.matrixSection.classList.add("d-none");
  refs.matrixTable.innerHTML = "";
  refs.metadataGrid.innerHTML = "";

  clearValidationError();
  resetPipelineUI();
  setProcessingState(false);
}
