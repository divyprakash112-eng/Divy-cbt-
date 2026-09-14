"use strict";

/* =========================================================
   CBT PREMIUM TEST MAKER
   STEP 4 - STABLE PDF + CROP ENGINE
   ========================================================= */

let pdfjsLib = null;
let pdfDocument = null;
let currentPageNumber = 1;
let currentScale = 1;
let currentPdfFile = null;

const appState = {
  questions: [],
  settings: {
    testTitle: "CBT Mock Test",
    duration: 180,
    correctMarks: 4,
    negativeMarks: 1,
    optionCount: 4,
    subjectOrder: "Physics, Chemistry, Botany, Zoology",
    instructions:
      "Read all instructions carefully before starting the examination."
  }
};

const cropState = {
  selecting: false,
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
  pointerId: null
};

const MIN_CROP_SIZE = 10;

const $ = (id) => document.getElementById(id);

const elements = {
  pdfInput: $("pdfInput"),
  dropZone: $("dropZone"),
  pdfFileName: $("pdfFileName"),
  pdfPageInfo: $("pdfPageInfo"),

  prevPageBtn: $("prevPageBtn"),
  nextPageBtn: $("nextPageBtn"),
  zoomOutBtn: $("zoomOutBtn"),
  zoomInBtn: $("zoomInBtn"),
  zoomLevel: $("zoomLevel"),

  pdfViewport: $("pdfViewport"),
  pdfEmptyState: $("pdfEmptyState"),
  canvasWrapper: $("canvasWrapper"),
  pdfCanvas: $("pdfCanvas"),
  selectionOverlay: $("selectionOverlay"),

  selectionStatus: $("selectionStatus"),
  selectionStatusDot: $("selectionStatusDot"),
  addQuestionBtn: $("addQuestionBtn"),

  questionCount: $("questionCount"),
  answerKeyCount: $("answerKeyCount"),
  subjectSummary: $("subjectSummary"),
  questionList: $("questionList"),

  settingsForm: $("settingsForm"),
  testTitle: $("testTitle"),
  duration: $("duration"),
  correctMarks: $("correctMarks"),
  negativeMarks: $("negativeMarks"),
  optionCount: $("optionCount"),
  subjectOrder: $("subjectOrder"),
  instructions: $("instructions"),

  exportExamBtn: $("exportExamBtn"),
  exportWarning: $("exportWarning"),

  saveProjectBtn: $("saveProjectBtn"),
  loadProjectBtn: $("loadProjectBtn"),
  projectFileInput: $("projectFileInput"),

  toastContainer: $("toastContainer"),

  loadingOverlay: $("loadingOverlay"),
  loadingText: $("loadingText"),

  confirmModal: $("confirmModal"),
  modalTitle: $("modalTitle"),
  modalMessage: $("modalMessage"),
  modalCancelBtn: $("modalCancelBtn"),
  modalConfirmBtn: $("modalConfirmBtn")
};


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
  bindEvents();
  syncSettingsToState();
  updateAllUI();
  resetCrop();

  if (elements.pdfEmptyState) {
    elements.pdfEmptyState.style.display = "";
  }

  await loadPdfJs();
}


/* =========================================================
   PDF.JS
   ========================================================= */

async function loadPdfJs() {
  try {
    showLoading("Loading PDF engine...");

    pdfjsLib = await import(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
    );

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

    hideLoading();
    showToast("PDF engine ready.", "success");
  } catch (error) {
    hideLoading();

    console.error("PDF.js loading error:", error);

    showToast(
      "PDF engine could not load. Please refresh the page and try again.",
      "error"
    );
  }
}


/* =========================================================
   EVENTS
   ========================================================= */

function bindEvents() {
  if (elements.pdfInput) {
    elements.pdfInput.addEventListener("change", (event) => {
      const file = event.target.files?.[0];

      if (file) {
        loadPdfFile(file);
      }
    });
  }

  if (elements.dropZone) {
    elements.dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("drag-over");
    });

    elements.dropZone.addEventListener("dragleave", () => {
      elements.dropZone.classList.remove("drag-over");
    });

    elements.dropZone.addEventListener("drop", (event) => {
      event.preventDefault();

      elements.dropZone.classList.remove("drag-over");

      const file = event.dataTransfer?.files?.[0];

      if (file) {
        loadPdfFile(file);
      }
    });

    elements.dropZone.addEventListener("click", () => {
      if (elements.pdfInput) {
        elements.pdfInput.click();
      }
    });
  }

  if (elements.prevPageBtn) {
    elements.prevPageBtn.addEventListener("click", () => {
      changePage(-1);
    });
  }

  if (elements.nextPageBtn) {
    elements.nextPageBtn.addEventListener("click", () => {
      changePage(1);
    });
  }

  if (elements.zoomOutBtn) {
    elements.zoomOutBtn.addEventListener("click", () => {
      changeZoom(-0.1);
    });
  }

  if (elements.zoomInBtn) {
    elements.zoomInBtn.addEventListener("click", () => {
      changeZoom(0.1);
    });
  }

  /*
    IMPORTANT:
    Pointer events are used instead of separate mouse/touch events.
    This makes cropping work on laptop, tablet and mobile.
  */

  if (elements.pdfCanvas) {
    elements.pdfCanvas.addEventListener(
      "pointerdown",
      handleCropPointerDown
    );

    elements.pdfCanvas.addEventListener(
      "pointermove",
      handleCropPointerMove
    );

    elements.pdfCanvas.addEventListener(
      "pointerup",
      handleCropPointerUp
    );

    elements.pdfCanvas.addEventListener(
      "pointercancel",
      handleCropPointerCancel
    );

    elements.pdfCanvas.addEventListener(
      "pointerleave",
      handleCropPointerLeave
    );
  }

  if (elements.addQuestionBtn) {
    elements.addQuestionBtn.addEventListener(
      "click",
      addSelectedRegionAsQuestion
    );
  }

  if (elements.settingsForm) {
    elements.settingsForm.addEventListener("input", () => {
      syncSettingsToState();
      updateAllUI();
    });

    elements.settingsForm.addEventListener("change", () => {
      syncSettingsToState();
      updateAllUI();
    });
  }

  if (elements.saveProjectBtn) {
    elements.saveProjectBtn.addEventListener("click", saveProject);
  }

  if (elements.loadProjectBtn) {
    elements.loadProjectBtn.addEventListener("click", () => {
      elements.projectFileInput?.click();
    });
  }

  if (elements.projectFileInput) {
    elements.projectFileInput.addEventListener(
      "change",
      handleProjectFile
    );
  }

  if (elements.exportExamBtn) {
    elements.exportExamBtn.addEventListener("click", () => {
      showToast(
        "Exam export will be enabled in the export step.",
        "info"
      );
    });
  }

  if (elements.modalCancelBtn) {
    elements.modalCancelBtn.addEventListener("click", closeModal);
  }
}


/* =========================================================
   LOAD PDF
   ========================================================= */

async function loadPdfFile(file) {
  if (!file) return;

  if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    showToast("Please select a PDF file.", "error");
    return;
  }

  if (!pdfjsLib) {
    showToast(
      "PDF engine is still loading. Please wait a moment.",
      "warning"
    );
    return;
  }

  try {
    showLoading("Reading PDF...");

    currentPdfFile = file;

    const buffer = await file.arrayBuffer();

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer)
    });

    pdfDocument = await loadingTask.promise;

    currentPageNumber = 1;
    currentScale = 1;

    if (elements.pdfFileName) {
      elements.pdfFileName.textContent = file.name;
    }

    if (elements.pdfEmptyState) {
      elements.pdfEmptyState.style.display = "none";
    }

    resetCrop();

    await renderCurrentPage();

    hideLoading();

    showToast(
      `${pdfDocument.numPages} page${
        pdfDocument.numPages === 1 ? "" : "s"
      } loaded successfully.`,
      "success"
    );
  } catch (error) {
    hideLoading();

    console.error("PDF loading error:", error);

    pdfDocument = null;

    showToast(
      "Could not open this PDF. Please try another PDF.",
      "error"
    );
  }
}


/* =========================================================
   RENDER PDF PAGE
   ========================================================= */

async function renderCurrentPage() {
  if (!pdfDocument || !elements.pdfCanvas) {
    return;
  }

  try {
    resetCrop();

    const page = await pdfDocument.getPage(currentPageNumber);

    const viewport = page.getViewport({
      scale: currentScale
    });

    const canvas = elements.pdfCanvas;
    const context = canvas.getContext("2d", {
      alpha: false
    });

    /*
      Clear old dimensions first.
    */
    canvas.width = 1;
    canvas.height = 1;

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    /*
      CSS size is deliberately identical to the internal canvas size.
      This prevents crop-coordinate mismatch.
    */
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    if (elements.canvasWrapper) {
      elements.canvasWrapper.style.width = `${viewport.width}px`;
      elements.canvasWrapper.style.height = `${viewport.height}px`;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport
    }).promise;

    updatePageControls();
    updateZoomControls();

    resetCrop();
  } catch (error) {
    console.error("Page rendering error:", error);

    showToast(
      "Could not render this PDF page.",
      "error"
    );
  }
}


/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

async function changePage(direction) {
  if (!pdfDocument) return;

  const nextPage = currentPageNumber + direction;

  if (nextPage < 1 || nextPage > pdfDocument.numPages) {
    return;
  }

  currentPageNumber = nextPage;

  await renderCurrentPage();
}

function updatePageControls() {
  if (!pdfDocument) {
    if (elements.pdfPageInfo) {
      elements.pdfPageInfo.textContent = "No PDF";
    }

    if (elements.prevPageBtn) {
      elements.prevPageBtn.disabled = true;
    }

    if (elements.nextPageBtn) {
      elements.nextPageBtn.disabled = true;
    }

    return;
  }

  if (elements.pdfPageInfo) {
    elements.pdfPageInfo.textContent =
      `Page ${currentPageNumber} of ${pdfDocument.numPages}`;
  }

  if (elements.prevPageBtn) {
    elements.prevPageBtn.disabled = currentPageNumber <= 1;
  }

  if (elements.nextPageBtn) {
    elements.nextPageBtn.disabled =
      currentPageNumber >= pdfDocument.numPages;
  }
}


/* =========================================================
   ZOOM
   ========================================================= */

async function changeZoom(amount) {
  if (!pdfDocument) return;

  const newScale = Math.min(
    3,
    Math.max(0.5, currentScale + amount)
  );

  if (Math.abs(newScale - currentScale) < 0.001) {
    return;
  }

  currentScale = Number(newScale.toFixed(2));

  await renderCurrentPage();
}

function updateZoomControls() {
  if (elements.zoomLevel) {
    elements.zoomLevel.textContent =
      `${Math.round(currentScale * 100)}%`;
  }

  if (elements.zoomOutBtn) {
    elements.zoomOutBtn.disabled =
      currentScale <= 0.5;
  }

  if (elements.zoomInBtn) {
    elements.zoomInBtn.disabled =
      currentScale >= 3;
  }
}


/* =========================================================
   CROPPING ENGINE
   ========================================================= */

function handleCropPointerDown(event) {
  if (!pdfDocument || !elements.pdfCanvas) {
    return;
  }

  /*
    Only left mouse button.
    Touch/pen has no button or uses 0.
  */
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  event.preventDefault();

  const point = getCanvasPoint(event);

  cropState.selecting = true;
  cropState.pointerId = event.pointerId;

  cropState.startX = point.x;
  cropState.startY = point.y;
  cropState.endX = point.x;
  cropState.endY = point.y;

  if (elements.pdfCanvas.setPointerCapture) {
    try {
      elements.pdfCanvas.setPointerCapture(event.pointerId);
    } catch (_) {}
  }

  updateSelectionRectangle();
  updateCropStatus();
}

function handleCropPointerMove(event) {
  if (!cropState.selecting) {
    return;
  }

  if (
    cropState.pointerId !== null &&
    event.pointerId !== cropState.pointerId
  ) {
    return;
  }

  event.preventDefault();

  const point = getCanvasPoint(event);

  cropState.endX = point.x;
  cropState.endY = point.y;

  updateSelectionRectangle();
  updateCropStatus();
}

function handleCropPointerUp(event) {
  if (!cropState.selecting) {
    return;
  }

  if (
    cropState.pointerId !== null &&
    event.pointerId !== cropState.pointerId
  ) {
    return;
  }

  event.preventDefault();

  const point = getCanvasPoint(event);

  cropState.endX = point.x;
  cropState.endY = point.y;

  cropState.selecting = false;

  releasePointer(event.pointerId);

  updateSelectionRectangle();
  updateCropStatus();
}

function handleCropPointerCancel(event) {
  cropState.selecting = false;

  releasePointer(event.pointerId);

  updateSelectionRectangle();
  updateCropStatus();
}

function handleCropPointerLeave(event) {
  /*
    Do NOT cancel selection here.
    Pointer capture keeps dragging alive outside canvas.
  */
  if (!cropState.selecting) {
    return;
  }
}

function releasePointer(pointerId) {
  if (
    elements.pdfCanvas &&
    elements.pdfCanvas.releasePointerCapture
  ) {
    try {
      elements.pdfCanvas.releasePointerCapture(pointerId);
    } catch (_) {}
  }

  cropState.pointerId = null;
}


/* =========================================================
   GET EXACT CANVAS COORDINATES
   ========================================================= */

function getCanvasPoint(event) {
  const canvas = elements.pdfCanvas;

  const rect = canvas.getBoundingClientRect();

  /*
    Convert screen coordinates into INTERNAL CANVAS PIXELS.

    This is the important fix:
    CSS size and internal canvas size can differ because of
    browser zoom, responsive layouts or device pixel ratio.
    We calculate both scale factors explicitly.
  */

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  let x = (event.clientX - rect.left) * scaleX;
  let y = (event.clientY - rect.top) * scaleY;

  x = Math.max(0, Math.min(canvas.width, x));
  y = Math.max(0, Math.min(canvas.height, y));

  return {
    x,
    y
  };
}


/* =========================================================
   SELECTION RECTANGLE
   ========================================================= */

function getSelectionBounds() {
  const x1 = cropState.startX;
  const y1 = cropState.startY;
  const x2 = cropState.endX;
  const y2 = cropState.endY;

  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1)
  };
}

function updateSelectionRectangle() {
  if (!elements.selectionOverlay) {
    return;
  }

  const bounds = getSelectionBounds();

  /*
    Overlay is positioned in the same pixel coordinate system
    as the canvas.
  */
  elements.selectionOverlay.style.left =
    `${bounds.x}px`;

  elements.selectionOverlay.style.top =
    `${bounds.y}px`;

  elements.selectionOverlay.style.width =
    `${bounds.width}px`;

  elements.selectionOverlay.style.height =
    `${bounds.height}px`;

  elements.selectionOverlay.style.display =
    bounds.width > 0 && bounds.height > 0
      ? "block"
      : "none";
}

function updateCropStatus() {
  const bounds = getSelectionBounds();

  const valid =
    bounds.width >= MIN_CROP_SIZE &&
    bounds.height >= MIN_CROP_SIZE;

  if (elements.addQuestionBtn) {
    elements.addQuestionBtn.disabled = !valid;
  }

  if (elements.selectionStatus) {
    if (valid) {
      elements.selectionStatus.textContent =
        `Selected: ${Math.round(bounds.width)} × ${Math.round(
          bounds.height
        )} px`;
    } else {
      elements.selectionStatus.textContent =
        "Draw a rectangle around one question";
    }
  }

  if (elements.selectionStatusDot) {
    elements.selectionStatusDot.classList.toggle(
      "active",
      valid
    );
  }
}

function resetCrop() {
  cropState.selecting = false;
  cropState.startX = 0;
  cropState.startY = 0;
  cropState.endX = 0;
  cropState.endY = 0;
  cropState.pointerId = null;

  if (elements.selectionOverlay) {
    elements.selectionOverlay.style.display = "none";
    elements.selectionOverlay.style.left = "0px";
    elements.selectionOverlay.style.top = "0px";
    elements.selectionOverlay.style.width = "0px";
    elements.selectionOverlay.style.height = "0px";
  }

  if (elements.addQuestionBtn) {
    elements.addQuestionBtn.disabled = true;
  }

  if (elements.selectionStatus) {
    elements.selectionStatus.textContent =
      "Draw a rectangle around one question";
  }

  if (elements.selectionStatusDot) {
    elements.selectionStatusDot.classList.remove("active");
  }
}


/* =========================================================
   CROP IMAGE
   ========================================================= */

function createCropImage() {
  const sourceCanvas = elements.pdfCanvas;

  if (!sourceCanvas) {
    throw new Error("PDF canvas not found.");
  }

  const bounds = getSelectionBounds();

  if (
    bounds.width < MIN_CROP_SIZE ||
    bounds.height < MIN_CROP_SIZE
  ) {
    throw new Error("Crop area is too small.");
  }

  /*
    Clamp crop area so drawImage never requests pixels
    outside the PDF canvas.
  */

  const x = Math.max(
    0,
    Math.min(
      sourceCanvas.width - 1,
      Math.floor(bounds.x)
    )
  );

  const y = Math.max(
    0,
    Math.min(
      sourceCanvas.height - 1,
      Math.floor(bounds.y)
    )
  );

  const width = Math.min(
    Math.floor(bounds.width),
    sourceCanvas.width - x
  );

  const height = Math.min(
    Math.floor(bounds.height),
    sourceCanvas.height - y
  );

  if (width <= 0 || height <= 0) {
    throw new Error("Invalid crop area.");
  }

  const cropCanvas = document.createElement("canvas");

  cropCanvas.width = width;
  cropCanvas.height = height;

  const cropContext = cropCanvas.getContext("2d");

  if (!cropContext) {
    throw new Error("Could not create crop canvas.");
  }

  /*
    White background makes cropped PDF images clean.
  */
  cropContext.fillStyle = "#ffffff";
  cropContext.fillRect(
    0,
    0,
    width,
    height
  );

  cropContext.drawImage(
    sourceCanvas,
    x,
    y,
    width,
    height,
    0,
    0,
    width,
    height
  );

  return {
    image: cropCanvas.toDataURL("image/png"),
    crop: {
      x,
      y,
      width,
      height
    }
  };
}


/* =========================================================
   ADD QUESTION
   ========================================================= */

function addSelectedRegionAsQuestion() {
  try {
    const result = createCropImage();

    const question = {
      id: createQuestionId(),
      image: result.image,

      subject: getDefaultSubject(),

      correctAnswer: "",

      page: currentPageNumber,

      crop: result.crop
    };

    appState.questions.push(question);

    renderQuestionList();
    updateAllUI();

    resetCrop();

    showToast(
      `Question ${appState.questions.length} added.`,
      "success"
    );
  } catch (error) {
    console.error("Crop error:", error);

    showToast(
      error.message || "Could not crop the selected area.",
      "error"
    );
  }
}


/* =========================================================
   QUESTION LIST
   ========================================================= */

function renderQuestionList() {
  if (!elements.questionList) {
    return;
  }

  if (appState.questions.length === 0) {
    elements.questionList.innerHTML = `
      <div class="empty-state">
        <strong>No questions yet</strong>
        <p>Upload a PDF and draw a rectangle around a question.</p>
      </div>
    `;

    return;
  }

  elements.questionList.innerHTML =
    appState.questions
      .map((question, index) =>
        createQuestionCardHtml(question, index)
      )
      .join("");

  bindQuestionCardEvents();
}

function createQuestionCardHtml(question, index) {
  const subjects = getSubjectOrder();
  const optionLetters = getOptionLetters();

  const subjectOptions = subjects
    .map(
      (subject) => `
        <option
          value="${escapeHtml(subject)}"
          ${
            subject === question.subject
              ? "selected"
              : ""
          }
        >
          ${escapeHtml(subject)}
        </option>
      `
    )
    .join("");

  const answerOptions = `
    <option value="">Select</option>
    ${optionLetters
      .map(
        (letter) => `
          <option
            value="${letter}"
            ${
              question.correctAnswer === letter
                ? "selected"
                : ""
            }
          >
            ${letter}
          </option>
        `
      )
      .join("")}
  `;

  return `
    <article
      class="question-card"
      data-question-id="${question.id}"
    >
      <div class="question-number">
        Q${index + 1}
      </div>

      <div class="question-thumbnail-wrap">
        <img
          class="question-thumbnail"
          src="${question.image}"
          alt="Question ${index + 1}"
        />
      </div>

      <div class="question-card-content">

        <label>
          Subject
          <select data-field="subject">
            ${subjectOptions}
          </select>
        </label>

        <label>
          Correct Answer
          <select data-field="correctAnswer">
            ${answerOptions}
          </select>
        </label>

        <div class="question-actions">

          <button
            type="button"
            data-action="up"
            ${index === 0 ? "disabled" : ""}
          >
            ↑
          </button>

          <button
            type="button"
            data-action="down"
            ${
              index === appState.questions.length - 1
                ? "disabled"
                : ""
            }
          >
            ↓
          </button>

          <button
            type="button"
            data-action="recrop"
          >
            Re-crop
          </button>

          <button
            type="button"
            data-action="delete"
          >
            Delete
          </button>

        </div>

        <small>
          PDF page ${question.page}
        </small>

      </div>
    </article>
  `;
}

function bindQuestionCardEvents() {
  if (!elements.questionList) return;

  const cards =
    elements.questionList.querySelectorAll(
      ".question-card"
    );

  cards.forEach((card) => {
    const id = card.dataset.questionId;

    const question = appState.questions.find(
      (item) => item.id === id
    );

    if (!question) return;

    const subjectSelect =
      card.querySelector(
        '[data-field="subject"]'
      );

    const answerSelect =
      card.querySelector(
        '[data-field="correctAnswer"]'
      );

    if (subjectSelect) {
      subjectSelect.addEventListener("change", () => {
        question.subject = subjectSelect.value;
        updateAllUI();
      });
    }

    if (answerSelect) {
      answerSelect.addEventListener("change", () => {
        question.correctAnswer =
          answerSelect.value;

        updateAllUI();
      });
    }

    card
      .querySelectorAll("[data-action]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const action = button.dataset.action;

          if (action === "up") {
            moveQuestion(id, -1);
          }

          if (action === "down") {
            moveQuestion(id, 1);
          }

          if (action === "delete") {
            deleteQuestion(id);
          }

          if (action === "recrop") {
            showToast(
              "Re-crop will be enabled in the next crop-management step.",
              "info"
            );
          }
        });
      });
}


/* =========================================================
   QUESTION MANAGEMENT
   ========================================================= */

function moveQuestion(id, direction) {
  const index =
    appState.questions.findIndex(
      (question) => question.id === id
    );

  if (index === -1) return;

  const newIndex = index + direction;

  if (
    newIndex < 0 ||
    newIndex >= appState.questions.length
  ) {
    return;
  }

  const temp =
    appState.questions[index];

  appState.questions[index] =
    appState.questions[newIndex];

  appState.questions[newIndex] =
    temp;

  renderQuestionList();
  updateAllUI();
}

function deleteQuestion(id) {
  const index =
    appState.questions.findIndex(
      (question) => question.id === id
    );

  if (index === -1) return;

  appState.questions.splice(index, 1);

  renderQuestionList();
  updateAllUI();

  showToast(
    "Question deleted.",
    "success"
  );
}


/* =========================================================
   SETTINGS
   ========================================================= */

function syncSettingsToState() {
  if (!elements.testTitle) return;

  appState.settings.testTitle =
    elements.testTitle.value.trim() ||
    "CBT Mock Test";

  appState.settings.duration =
    Math.max(
      1,
      Number(elements.duration.value) || 180
    );

  appState.settings.correctMarks =
    Math.max(
      0,
      Number(elements.correctMarks.value) || 0
    );

  appState.settings.negativeMarks =
    Math.max(
      0,
      Number(elements.negativeMarks.value) || 0
    );

  appState.settings.optionCount =
    Math.min(
      5,
      Math.max(
        2,
        Number(elements.optionCount.value) || 4
      )
    );

  appState.settings.subjectOrder =
    elements.subjectOrder.value.trim() ||
    "Physics, Chemistry, Botany, Zoology";

  appState.settings.instructions =
    elements.instructions.value.trim();
}


/* =========================================================
   SUBJECTS / OPTIONS
   ========================================================= */

function getSubjectOrder() {
  return appState.settings.subjectOrder
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDefaultSubject() {
  const subjects = getSubjectOrder();

  return subjects.length
    ? subjects[0]
    : "General";
}

function getOptionLetters() {
  return ["A", "B", "C", "D", "E"].slice(
    0,
    appState.settings.optionCount
  );
}


/* =========================================================
   UI COUNTERS
   ========================================================= */

function updateAllUI() {
  updateQuestionCounter();
  updateAnswerCounter();
  updateSubjectSummary();
  updateExportWarning();
  updatePageControls();
  updateZoomControls();
}

function updateQuestionCounter() {
  if (elements.questionCount) {
    elements.questionCount.textContent =
      appState.questions.length;
  }
}

function updateAnswerCounter() {
  if (elements.answerKeyCount) {
    const count =
      appState.questions.filter(
        (question) =>
          Boolean(question.correctAnswer)
      ).length;

    elements.answerKeyCount.textContent =
      count;
  }
}

function updateSubjectSummary() {
  if (!elements.subjectSummary) {
    return;
  }

  const subjects = getSubjectOrder();

  const counts = {};

  subjects.forEach((subject) => {
    counts[subject] = 0;
  });

  appState.questions.forEach((question) => {
    const subject =
      question.subject || "General";

    counts[subject] =
      (counts[subject] || 0) + 1;
  });

  const rows = Object.entries(counts);

  if (rows.length === 0) {
    elements.subjectSummary.innerHTML =
      "<span>No questions yet.</span>";

    return;
  }

  elements.subjectSummary.innerHTML =
    rows
      .map(
        ([subject, count]) => `
          <div class="subject-summary-row">
            <span>${escapeHtml(subject)}</span>
            <strong>${count}</strong>
          </div>
        `
      )
      .join("");
}

function updateExportWarning() {
  if (!elements.exportWarning) {
    return;
  }

  const missing =
    appState.questions.filter(
      (question) =>
        !question.correctAnswer
    ).length;

  if (missing > 0) {
    elements.exportWarning.textContent =
      `${missing} question${
        missing === 1 ? "" : "s"
      } do not have a correct answer.`;

    elements.exportWarning.style.display =
      "";
  } else {
    elements.exportWarning.style.display =
      "none";
  }
}


/* =========================================================
   SAVE PROJECT
   ========================================================= */

function saveProject() {
  try {
    syncSettingsToState();

    const project = {
      app: "CBT Premium Test Maker",
      version: 1,
      savedAt: new Date().toISOString(),

      settings: {
        ...appState.settings
      },

      questions:
        appState.questions.map(
          (question) => ({
            ...question
          })
        )
    };

    const blob = new Blob(
      [JSON.stringify(project, null, 2)],
      {
        type: "application/json"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;

    anchor.download =
      `${safeFileName(
        appState.settings.testTitle
      )}-project.json`;

    document.body.appendChild(anchor);

    anchor.click();

    anchor.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );

    showToast(
      "Project saved successfully.",
      "success"
    );
  } catch (error) {
    console.error("Project save error:", error);

    showToast(
      "Could not save project.",
      "error"
    );
  }
}

async function handleProjectFile(event) {
  const file =
    event.target.files?.[0];

  if (!file) return;

  try {
    const text =
      await file.text();

    const project =
      JSON.parse(text);

    if (
      project.app !==
      "CBT Premium Test Maker"
    ) {
      throw new Error(
        "This is not a CBT Premium Test Maker project."
      );
    }

    if (project.settings) {
      appState.settings = {
        ...appState.settings,
        ...project.settings
      };
    }

    if (Array.isArray(project.questions)) {
      appState.questions =
        project.questions.map(
          normalizeQuestion
        );
    }

    syncSettingsToForm();

    renderQuestionList();
    updateAllUI();

    showToast(
      "Project loaded successfully.",
      "success"
    );
  } catch (error) {
    console.error("Project load error:", error);

    showToast(
      error.message ||
        "Could not load project.",
      "error"
    );
  }

  event.target.value = "";
}

function syncSettingsToForm() {
  if (!elements.testTitle) return;

  elements.testTitle.value =
    appState.settings.testTitle;

  elements.duration.value =
    appState.settings.duration;

  elements.correctMarks.value =
    appState.settings.correctMarks;

  elements.negativeMarks.value =
    appState.settings.negativeMarks;

  elements.optionCount.value =
    appState.settings.optionCount;

  elements.subjectOrder.value =
    appState.settings.subjectOrder;

  elements.instructions.value =
    appState.settings.instructions;
}

function normalizeQuestion(question) {
  return {
    id:
      question.id ||
      createQuestionId(),

    image:
      typeof question.image === "string"
        ? question.image
        : "",

    subject:
      question.subject ||
      getDefaultSubject(),

    correctAnswer:
      question.correctAnswer || "",

    page:
      Number(question.page) || 1,

    crop:
      question.crop || {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      }
  };
}


/* =========================================================
   UTILITIES
   ========================================================= */

function createQuestionId() {
  return (
    "q_" +
    Date.now().toString(36) +
    "_" +
    Math.random()
      .toString(36)
      .slice(2, 9)
  );
}

function safeFileName(name) {
  return (
    String(name || "CBT-Mock-Test")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 100) ||
    "CBT-Mock-Test"
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(
  message,
  type = "info"
) {
  if (!elements.toastContainer) {
    console.log(message);
    return;
  }

  const toast =
    document.createElement("div");

  toast.className =
    `toast toast-${type}`;

  toast.textContent = message;

  elements.toastContainer.appendChild(
    toast
  );

  setTimeout(() => {
    toast.classList.add("hide");

    setTimeout(
      () => toast.remove(),
      300
    );
  }, 3000);
}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading(message) {
  if (!elements.loadingOverlay) {
    return;
  }

  if (elements.loadingText) {
    elements.loadingText.textContent =
      message || "Loading...";
  }

  elements.loadingOverlay.style.display =
    "flex";
}

function hideLoading() {
  if (!elements.loadingOverlay) {
    return;
  }

  elements.loadingOverlay.style.display =
    "none";
}


/* =========================================================
   MODAL
   ========================================================= */

function closeModal() {
  if (!elements.confirmModal) {
    return;
  }

  elements.confirmModal.classList.remove(
    "open"
  );
}


/* =========================================================
   KEYBOARD SAFETY
   ========================================================= */

document.addEventListener(
  "keydown",
  (event) => {
    /*
      Escape clears active crop.
    */
    if (event.key === "Escape") {
      if (cropState.selecting) {
        resetCrop();

        showToast(
          "Crop cancelled.",
          "info"
        );
      }
    }
  }
);


/* =========================================================
   GLOBAL ERROR HANDLERS
   ========================================================= */

window.addEventListener(
  "error",
  (event) => {
    console.error(
      "Application error:",
      event.error || event.message
    );
  }
);

window.addEventListener(
  "unhandledrejection",
  (event) => {
    console.error(
      "Unhandled promise rejection:",
      event.reason
    );
  }
);
