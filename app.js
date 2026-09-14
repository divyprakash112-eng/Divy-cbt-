/* =========================================================
   CBT PREMIUM TEST MAKER
   app.js

   STEP 3
   - PDF upload
   - Drag & drop
   - PDF.js rendering
   - Page navigation
   - Zoom controls
   - Loading/error handling

   Later steps will add:
   - Cropping
   - Question management
   - Answer keys
   - Project save/load
   - Autosave
   - Exam generator
   ========================================================= */


/* =========================================================
   PDF.JS SETUP
   ========================================================= */

/*
 * index.html loads PDF.js as an ES module.
 *
 * Because PDF.js is loaded from a CDN as a module, we dynamically
 * import it here as well. This gives us access to:
 *
 *   getDocument()
 *
 * The worker is configured after PDF.js loads.
 */

let pdfjsLib = null;

let pdfDocument = null;
let currentPageNumber = 1;
let currentScale = 1.0;

let currentPdfFile = null;


/* =========================================================
   APPLICATION STATE
   ========================================================= */

const appState = {

    questions: [],

    settings: {
        testTitle: "CBT Mock Test",
        duration: 180,
        correctMarks: 4,
        negativeMarks: 1,
        optionCount: 4,
        subjectOrder:
            "Physics, Chemistry, Botany, Zoology",
        instructions:
            "1. Read each question carefully before answering.\n" +
            "2. Select the most appropriate option.\n" +
            "3. You can mark questions for review and return to them later.\n" +
            "4. The test will be submitted automatically when the timer reaches zero."
    }

};


/* =========================================================
   DOM REFERENCES
   ========================================================= */

const elements = {

    /* PDF upload */
    pdfInput:
        document.getElementById("pdfInput"),

    dropZone:
        document.getElementById("dropZone"),

    /* PDF information */
    pdfFileName:
        document.getElementById("pdfFileName"),

    pdfPageInfo:
        document.getElementById("pdfPageInfo"),

    /* PDF controls */
    prevPageBtn:
        document.getElementById("prevPageBtn"),

    nextPageBtn:
        document.getElementById("nextPageBtn"),

    zoomOutBtn:
        document.getElementById("zoomOutBtn"),

    zoomInBtn:
        document.getElementById("zoomInBtn"),

    zoomLevel:
        document.getElementById("zoomLevel"),

    /* PDF canvas */
    pdfViewport:
        document.getElementById("pdfViewport"),

    pdfEmptyState:
        document.getElementById("pdfEmptyState"),

    canvasWrapper:
        document.getElementById("canvasWrapper"),

    pdfCanvas:
        document.getElementById("pdfCanvas"),

    selectionOverlay:
        document.getElementById("selectionOverlay"),

    /* Crop */
    selectionStatus:
        document.getElementById("selectionStatus"),

    selectionStatusDot:
        document.getElementById("selectionStatusDot"),

    addQuestionBtn:
        document.getElementById("addQuestionBtn"),

    /* Questions */
    questionCount:
        document.getElementById("questionCount"),

    answerKeyCount:
        document.getElementById("answerKeyCount"),

    subjectSummary:
        document.getElementById("subjectSummary"),

    questionList:
        document.getElementById("questionList"),

    /* Settings */
    settingsForm:
        document.getElementById("settingsForm"),

    testTitle:
        document.getElementById("testTitle"),

    duration:
        document.getElementById("duration"),

    correctMarks:
        document.getElementById("correctMarks"),

    negativeMarks:
        document.getElementById("negativeMarks"),

    optionCount:
        document.getElementById("optionCount"),

    subjectOrder:
        document.getElementById("subjectOrder"),

    instructions:
        document.getElementById("instructions"),

    /* Export */
    exportExamBtn:
        document.getElementById("exportExamBtn"),

    exportWarning:
        document.getElementById("exportWarning"),

    /* Project */
    saveProjectBtn:
        document.getElementById("saveProjectBtn"),

    loadProjectBtn:
        document.getElementById("loadProjectBtn"),

    projectFileInput:
        document.getElementById("projectFileInput"),

    /* UI */
    toastContainer:
        document.getElementById("toastContainer"),

    loadingOverlay:
        document.getElementById("loadingOverlay"),

    loadingText:
        document.getElementById("loadingText"),

    confirmModal:
        document.getElementById("confirmModal"),

    modalTitle:
        document.getElementById("modalTitle"),

    modalMessage:
        document.getElementById("modalMessage"),

    modalCancelBtn:
        document.getElementById("modalCancelBtn"),

    modalConfirmBtn:
        document.getElementById("modalConfirmBtn")
};


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);


async function initializeApp() {

    try {

        bindEvents();

        syncSettingsFromForm();

        updateQuestionCounters();

        await loadPdfJs();

        console.log(
            "CBT Premium Test Maker initialized."
        );

    } catch (error) {

        console.error(
            "Application initialization failed:",
            error
        );

        showToast(
            "The application could not initialize correctly.",
            "error"
        );
    }
}


/* =========================================================
   LOAD PDF.JS
   ========================================================= */

async function loadPdfJs() {

    /*
     * PDF.js is imported dynamically.
     *
     * This URL matches the module version loaded in index.html.
     */

    const moduleUrl =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

    try {

        pdfjsLib = await import(moduleUrl);

        /*
         * PDF.js requires a worker for rendering.
         */

        pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

    } catch (error) {

        console.error(
            "Could not load PDF.js:",
            error
        );

        showToast(
            "PDF viewer could not be loaded. Check your internet connection and reload the page.",
            "error"
        );

        throw error;
    }
}


/* =========================================================
   EVENT BINDING
   ========================================================= */

function bindEvents() {

    /* -------------------------------------------------------
       PDF INPUT
       ------------------------------------------------------- */

    elements.pdfInput.addEventListener(
        "change",
        handlePdfInput
    );


    /* -------------------------------------------------------
       DRAG & DROP
       ------------------------------------------------------- */

    elements.dropZone.addEventListener(
        "dragover",
        handleDragOver
    );

    elements.dropZone.addEventListener(
        "dragleave",
        handleDragLeave
    );

    elements.dropZone.addEventListener(
        "drop",
        handleDrop
    );


    /* -------------------------------------------------------
       PAGE NAVIGATION
       ------------------------------------------------------- */

    elements.prevPageBtn.addEventListener(
        "click",
        () => changePage(-1)
    );

    elements.nextPageBtn.addEventListener(
        "click",
        () => changePage(1)
    );


    /* -------------------------------------------------------
       ZOOM
       ------------------------------------------------------- */

    elements.zoomOutBtn.addEventListener(
        "click",
        () => changeZoom(-0.1)
    );

    elements.zoomInBtn.addEventListener(
        "click",
        () => changeZoom(0.1)
    );


    /* -------------------------------------------------------
       SETTINGS
       ------------------------------------------------------- */

    elements.settingsForm.addEventListener(
        "input",
        handleSettingsChange
    );

    elements.settingsForm.addEventListener(
        "change",
        handleSettingsChange
    );


    /* -------------------------------------------------------
       PROJECT BUTTONS
       ------------------------------------------------------- */

    elements.saveProjectBtn.addEventListener(
        "click",
        saveProject
    );

    elements.loadProjectBtn.addEventListener(
        "click",
        () => {
            elements.projectFileInput.click();
        }
    );

    elements.projectFileInput.addEventListener(
        "change",
        handleProjectFile
    );


    /* -------------------------------------------------------
       PLACEHOLDER BUTTONS
       -------------------------------------------------------
       These features are implemented in later steps.
       We keep the buttons safe for now.
       ------------------------------------------------------- */

    elements.addQuestionBtn.addEventListener(
        "click",
        handleAddQuestionPlaceholder
    );

    elements.exportExamBtn.addEventListener(
        "click",
        handleExportPlaceholder
    );


    /* -------------------------------------------------------
       MODAL
       ------------------------------------------------------- */

    elements.modalCancelBtn.addEventListener(
        "click",
        closeModal
    );
}


/* =========================================================
   PDF FILE INPUT
   ========================================================= */

async function handlePdfInput(event) {

    const file =
        event.target.files &&
        event.target.files[0];

    if (!file) {
        return;
    }

    await loadPdfFile(file);

    /*
     * Reset input so the same PDF can be selected again later.
     */

    event.target.value = "";
}


/* =========================================================
   DRAG OVER
   ========================================================= */

function handleDragOver(event) {

    event.preventDefault();

    event.dataTransfer.dropEffect = "copy";

    elements.dropZone.classList.add(
        "drag-over"
    );
}


/* =========================================================
   DRAG LEAVE
   ========================================================= */

function handleDragLeave(event) {

    event.preventDefault();

    elements.dropZone.classList.remove(
        "drag-over"
    );
}


/* =========================================================
   DROP
   ========================================================= */

async function handleDrop(event) {

    event.preventDefault();

    elements.dropZone.classList.remove(
        "drag-over"
    );

    const files =
        event.dataTransfer.files;

    if (!files || files.length === 0) {
        return;
    }

    const file = files[0];

    await loadPdfFile(file);
}


/* =========================================================
   LOAD PDF FILE
   ========================================================= */

async function loadPdfFile(file) {

    if (!file) {
        return;
    }


    /* -------------------------------------------------------
       FILE TYPE CHECK
       ------------------------------------------------------- */

    const isPdf =
        file.type === "application/pdf" ||
        file.name
            .toLowerCase()
            .endsWith(".pdf");

    if (!isPdf) {

        showToast(
            "Please select a PDF file.",
            "error"
        );

        return;
    }


    /* -------------------------------------------------------
       FILE SIZE CHECK
       -------------------------------------------------------
       Large PDFs can consume a lot of browser memory.
       We allow them, but warn above 100 MB.
       ------------------------------------------------------- */

    const fileSizeMB =
        file.size / (1024 * 1024);

    if (fileSizeMB > 100) {

        showToast(
            "This PDF is larger than 100 MB and may use significant browser memory.",
            "warning"
        );
    }


    if (!pdfjsLib) {

        showToast(
            "PDF viewer is still loading. Please try again in a moment.",
            "warning"
        );

        return;
    }


    try {

        showLoading(
            "Opening question paper..."
        );

        /*
         * Convert File to ArrayBuffer.
         */

        const arrayBuffer =
            await file.arrayBuffer();


        /*
         * PDF.js accepts typed array data.
         *
         * Uint8Array avoids keeping an unnecessary duplicate
         * representation around.
         */

        const pdfData =
            new Uint8Array(arrayBuffer);


        /*
         * Load PDF document.
         */

        const loadingTask =
            pdfjsLib.getDocument({
                data: pdfData
            });

        pdfDocument =
            await loadingTask.promise;


        currentPdfFile = {
            name: file.name,
            size: file.size,
            type: file.type
        };


        currentPageNumber = 1;
        currentScale = 1.0;


        /*
         * Update UI.
         */

        elements.pdfFileName.textContent =
            file.name;

        elements.pdfPageInfo.textContent =
            `Page 1 of ${pdfDocument.numPages}`;

        elements.pdfEmptyState.hidden =
            true;

        elements.canvasWrapper.hidden =
            false;


        updatePdfControls();

        updateZoomDisplay();


        /*
         * Render first page.
         */

        await renderCurrentPage();


        hideLoading();


        showToast(
            `PDF loaded successfully — ${pdfDocument.numPages} page${pdfDocument.numPages === 1 ? "" : "s"}.`,
            "success"
        );

    } catch (error) {

        hideLoading();

        console.error(
            "PDF loading failed:",
            error
        );

        pdfDocument = null;
        currentPdfFile = null;

        resetPdfViewer();

        let message =
            "Could not open this PDF.";

        if (
            error &&
            typeof error.message === "string"
        ) {
            message =
                `Could not open this PDF: ${error.message}`;
        }

        showToast(
            message,
            "error"
        );
    }
}


/* =========================================================
   RENDER CURRENT PAGE
   ========================================================= */

async function renderCurrentPage() {

    if (!pdfDocument) {
        return;
    }

    try {

        showLoading(
            `Rendering page ${currentPageNumber}...`
        );


        const page =
            await pdfDocument.getPage(
                currentPageNumber
            );


        /*
         * PDF.js uses points internally.
         *
         * currentScale controls the rendered pixel size.
         */

        const viewport =
            page.getViewport({
                scale: currentScale
            });


        const canvas =
            elements.pdfCanvas;

        const context =
            canvas.getContext("2d", {
                alpha: false
            });


        /*
         * Clear any previous drawing.
         */

        context.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        /*
         * Set actual canvas resolution.
         */

        canvas.width =
            Math.floor(viewport.width);

        canvas.height =
            Math.floor(viewport.height);


        /*
         * CSS dimensions match canvas dimensions.
         *
         * This is important because crop coordinates will later
         * be calculated from the actual rendered canvas.
         */

        canvas.style.width =
            `${Math.floor(viewport.width)}px`;

        canvas.style.height =
            `${Math.floor(viewport.height)}px`;


        /*
         * Render PDF page onto canvas.
         */

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;


        /*
         * Update page information.
         */

        elements.pdfPageInfo.textContent =
            `Page ${currentPageNumber} of ${pdfDocument.numPages}`;


        updatePdfControls();

        updateZoomDisplay();


        /*
         * A new page invalidates an existing crop selection.
         */

        clearSelection();


    } catch (error) {

        console.error(
            "Page rendering failed:",
            error
        );

        showToast(
            "Could not render this PDF page.",
            "error"
        );

    } finally {

        hideLoading();
    }
}


/* =========================================================
   CHANGE PAGE
   ========================================================= */

async function changePage(direction) {

    if (!pdfDocument) {
        return;
    }


    const newPage =
        currentPageNumber + direction;


    if (
        newPage < 1 ||
        newPage > pdfDocument.numPages
    ) {
        return;
    }


    currentPageNumber =
        newPage;


    await renderCurrentPage();
}


/* =========================================================
   CHANGE ZOOM
   ========================================================= */

async function changeZoom(delta) {

    if (!pdfDocument) {
        return;
    }


    const minimumScale =
        0.5;

    const maximumScale =
        3.0;


    const newScale =
        Math.round(
            (currentScale + delta) * 10
        ) / 10;


    if (
        newScale < minimumScale ||
        newScale > maximumScale
    ) {
        return;
    }


    currentScale =
        newScale;


    await renderCurrentPage();
}


/* =========================================================
   PDF CONTROLS
   ========================================================= */

function updatePdfControls() {

    const hasPdf =
        Boolean(pdfDocument);


    elements.prevPageBtn.disabled =
        !hasPdf ||
        currentPageNumber <= 1;


    elements.nextPageBtn.disabled =
        !hasPdf ||
        currentPageNumber >=
        pdfDocument?.numPages;


    elements.zoomOutBtn.disabled =
        !hasPdf ||
        currentScale <= 0.5;


    elements.zoomInBtn.disabled =
        !hasPdf ||
        currentScale >= 3.0;
}


/* =========================================================
   ZOOM DISPLAY
   ========================================================= */

function updateZoomDisplay() {

    const percentage =
        Math.round(
            currentScale * 100
        );

    elements.zoomLevel.textContent =
        `${percentage}%`;
}


/* =========================================================
   RESET PDF VIEWER
   ========================================================= */

function resetPdfViewer() {

    pdfDocument = null;
    currentPdfFile = null;

    currentPageNumber = 1;
    currentScale = 1.0;


    const canvas =
        elements.pdfCanvas;

    const context =
        canvas.getContext("2d");

    context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    canvas.width = 0;
    canvas.height = 0;


    elements.pdfEmptyState.hidden =
        false;

    elements.canvasWrapper.hidden =
        true;


    elements.pdfFileName.textContent =
        "No PDF loaded";

    elements.pdfPageInfo.textContent =
        "Page 0 of 0";


    updatePdfControls();
    updateZoomDisplay();

    clearSelection();
}


/* =========================================================
   SELECTION — PLACEHOLDER
   =========================================================
   The actual mouse/touch crop selection is implemented
   in the next step.

   We keep this function now so the UI can safely reset.
   ========================================================= */

function clearSelection() {

    elements.selectionOverlay.hidden =
        true;

    elements.selectionOverlay.style.left =
        "0px";

    elements.selectionOverlay.style.top =
        "0px";

    elements.selectionOverlay.style.width =
        "0px";

    elements.selectionOverlay.style.height =
        "0px";


    elements.selectionStatus.textContent =
        "Select a question region on the page";

    elements.selectionStatusDot.classList.remove(
        "active"
    );


    elements.addQuestionBtn.disabled =
        true;
}


/* =========================================================
   SETTINGS
   ========================================================= */

function handleSettingsChange() {

    syncSettingsFromForm();

    updateExportWarning();

    /*
     * Settings autosave will be added later.
     */
}


function syncSettingsFromForm() {

    appState.settings.testTitle =
        elements.testTitle.value.trim() ||
        "CBT Mock Test";


    appState.settings.duration =
        sanitizePositiveNumber(
            elements.duration.value,
            180
        );


    appState.settings.correctMarks =
        sanitizeNonNegativeNumber(
            elements.correctMarks.value,
            4
        );


    appState.settings.negativeMarks =
        sanitizeNonNegativeNumber(
            elements.negativeMarks.value,
            1
        );


    appState.settings.optionCount =
        sanitizeOptionCount(
            elements.optionCount.value
        );


    appState.settings.subjectOrder =
        elements.subjectOrder.value.trim();


    appState.settings.instructions =
        elements.instructions.value;
}


/* =========================================================
   NUMBER SANITIZERS
   ========================================================= */

function sanitizePositiveNumber(
    value,
    fallback
) {

    const number =
        Number(value);

    if (
        !Number.isFinite(number) ||
        number <= 0
    ) {
        return fallback;
    }

    return number;
}


function sanitizeNonNegativeNumber(
    value,
    fallback
) {

    const number =
        Number(value);

    if (
        !Number.isFinite(number) ||
        number < 0
    ) {
        return fallback;
    }

    return number;
}


function sanitizeOptionCount(value) {

    const number =
        Number(value);

    if (
        !Number.isInteger(number) ||
        number < 2 ||
        number > 5
    ) {
        return 4;
    }

    return number;
}


/* =========================================================
   QUESTION COUNTERS
   ========================================================= */

function updateQuestionCounters() {

    const questions =
        appState.questions;


    elements.questionCount.textContent =
        questions.length;


    const keyedQuestions =
        questions.filter(
            question =>
                question.correctAnswer
        );


    elements.answerKeyCount.textContent =
        `${keyedQuestions.length} keyed`;


    updateSubjectSummary();

    updateExportWarning();
}


/* =========================================================
   SUBJECT SUMMARY
   ========================================================= */

function updateSubjectSummary() {

    const questions =
        appState.questions;


    if (questions.length === 0) {

        elements.subjectSummary.innerHTML =
            `<span class="empty-summary">
                Subject counts will appear here.
            </span>`;

        return;
    }


    const subjectCounts =
        {};


    questions.forEach(
        question => {

            const subject =
                (
                    question.subject ||
                    "Unassigned"
                ).trim();


            if (!subjectCounts[subject]) {
                subjectCounts[subject] = 0;
            }

            subjectCounts[subject]++;
        }
    );


    elements.subjectSummary.innerHTML =
        Object.entries(subjectCounts)
            .map(
                ([subject, count]) => `
                    <span class="subject-chip">
                        ${escapeHtml(subject)}
                        <strong>${count}</strong>
                    </span>
                `
            )
            .join("");
}


/* =========================================================
   EXPORT WARNING
   ========================================================= */

function updateExportWarning() {

    const questionCount =
        appState.questions.length;


    if (questionCount === 0) {

        elements.exportWarning.hidden =
            true;

        return;
    }


    const missingAnswers =
        appState.questions.filter(
            question =>
                !question.correctAnswer
        ).length;


    if (missingAnswers > 0) {

        elements.exportWarning.hidden =
            false;

        const span =
            elements.exportWarning.querySelector(
                "span"
            );

        if (span) {

            span.textContent =
                `${missingAnswers} question${missingAnswers === 1 ? "" : "s"} do not have a correct answer selected. You can still export the exam.`;
        }

    } else {

        elements.exportWarning.hidden =
            true;
    }
}


/* =========================================================
   ADD QUESTION PLACEHOLDER
   ========================================================= */

function handleAddQuestionPlaceholder() {

    showToast(
        "Question cropping will be enabled in Step 4.",
        "info"
    );
}


/* =========================================================
   EXPORT PLACEHOLDER
   ========================================================= */

function handleExportPlaceholder() {

    showToast(
        "The standalone exam generator will be enabled in a later step.",
        "info"
    );
}


/* =========================================================
   PROJECT SAVE
   ========================================================= */

function saveProject() {

    syncSettingsFromForm();


    /*
     * At this stage there are no cropped questions yet.
     *
     * The structure is already designed so later steps can
     * store all question images as data URLs.
     */

    const project = {

        version: 1,

        app:
            "CBT Premium Test Maker",

        savedAt:
            new Date().toISOString(),

        sourcePdf:
            currentPdfFile
                ? {
                    name:
                        currentPdfFile.name,
                    size:
                        currentPdfFile.size,
                    type:
                        currentPdfFile.type
                }
                : null,

        settings:
            appState.settings,

        questions:
            appState.questions
    };


    try {

        const json =
            JSON.stringify(
                project,
                null,
                2
            );


        const blob =
            new Blob(
                [json],
                {
                    type:
                        "application/json"
                }
            );


        const url =
            URL.createObjectURL(blob);


        const link =
            document.createElement("a");


        link.href =
            url;


        link.download =
            createSafeFileName(
                appState.settings.testTitle ||
                "CBT-Mock-Test"
            ) +
            "-project.json";


        document.body.appendChild(link);

        link.click();

        link.remove();


        setTimeout(
            () => {
                URL.revokeObjectURL(url);
            },
            1000
        );


        showToast(
            "Project saved successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "Project save failed:",
            error
        );

        showToast(
            "Could not save the project.",
            "error"
        );
    }
}


/* =========================================================
   PROJECT FILE LOAD
   ========================================================= */

async function handleProjectFile(event) {

    const file =
        event.target.files &&
        event.target.files[0];


    if (!file) {
        return;
    }


    try {

        showLoading(
            "Loading project..."
        );


        const text =
            await file.text();


        const project =
            JSON.parse(text);


        validateProject(project);


        /*
         * Restore settings.
         */

        if (project.settings) {

            appState.settings = {
                ...appState.settings,
                ...project.settings
            };

            applySettingsToForm();
        }


        /*
         * Restore questions.
         *
         * In Step 4+ this will contain cropped image data.
         */

        if (Array.isArray(project.questions)) {

            appState.questions =
                project.questions;
        } else {

            appState.questions = [];
        }


        updateQuestionCounters();


        hideLoading();


        showToast(
            "Project loaded successfully.",
            "success"
        );

    } catch (error) {

        hideLoading();

        console.error(
            "Project load failed:",
            error
        );

        showToast(
            error.message ||
            "The selected project file is invalid.",
            "error"
        );

    } finally {

        /*
         * Reset input so the same project can be loaded again.
         */

        event.target.value = "";
    }
}


/* =========================================================
   PROJECT VALIDATION
   ========================================================= */

function validateProject(project) {

    if (
        !project ||
        typeof project !== "object"
    ) {
        throw new Error(
            "Invalid project file."
        );
    }


    if (
        project.app &&
        project.app !==
        "CBT Premium Test Maker"
    ) {
        throw new Error(
            "This project was not created by CBT Premium Test Maker."
        );
    }


    if (
        project.questions !== undefined &&
        !Array.isArray(project.questions)
    ) {
        throw new Error(
            "Project question data is invalid."
        );
    }
}


/* =========================================================
   APPLY SETTINGS TO FORM
   ========================================================= */

function applySettingsToForm() {

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


    updateExportWarning();
}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(
    message,
    type = "info"
) {

    if (
        !elements.toastContainer
    ) {
        return;
    }


    const toast =
        document.createElement("div");


    toast.className =
        `toast ${type}`;


    toast.innerHTML = `
        <div>
            <strong>
                ${getToastTitle(type)}
            </strong>

            <span>
                ${escapeHtml(message)}
            </span>
        </div>
    `;


    elements.toastContainer.appendChild(
        toast
    );


    setTimeout(
        () => {

            toast.style.animation =
                "toast-out 0.18s ease both";

            setTimeout(
                () => {
                    toast.remove();
                },
                180
            );

        },
        4000
    );
}


/* =========================================================
   TOAST TITLE
   ========================================================= */

function getToastTitle(type) {

    switch (type) {

        case "success":
            return "Success";

        case "error":
            return "Error";

        case "warning":
            return "Attention";

        default:
            return "Info";
    }
}


/* =========================================================
   LOADING
   ========================================================= */

function showLoading(
    message = "Processing..."
) {

    elements.loadingText.textContent =
        message;

    elements.loadingOverlay.hidden =
        false;
}


function hideLoading() {

    elements.loadingOverlay.hidden =
        true;
}


/* =========================================================
   MODAL HELPERS
   ========================================================= */

function openModal(
    title,
    message,
    onConfirm
) {

    elements.modalTitle.textContent =
        title;

    elements.modalMessage.textContent =
        message;


    elements.confirmModal.hidden =
        false;


    /*
     * Replace the old click handler safely.
     */

    elements.modalConfirmBtn.onclick =
        () => {

            closeModal();

            if (
                typeof onConfirm ===
                "function"
            ) {
                onConfirm();
            }
        };
}


function closeModal() {

    elements.confirmModal.hidden =
        true;

    elements.modalConfirmBtn.onclick =
        null;
}


/* =========================================================
   SAFE FILE NAME
   ========================================================= */

function createSafeFileName(name) {

    return String(name)
        .trim()
        .replace(
            /[<>:"/\\|?*\x00-\x1F]/g,
            "-"
        )
        .replace(
            /\s+/g,
            "-"
        )
        .replace(
            /-+/g,
            "-"
        )
        .replace(
            /^[-.]+|[-.]+$/g,
            ""
        )
        .slice(
            0,
            100
        ) || "CBT-Mock-Test";
}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

document.addEventListener(
    "keydown",
    async (event) => {

        /*
         * Do not trigger shortcuts while typing in a form field.
         */

        const target =
            event.target;

        const isTyping =
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement;


        if (isTyping) {
            return;
        }


        /*
         * Left / right arrows navigate pages.
         */

        if (event.key === "ArrowLeft") {

            await changePage(-1);
        }


        if (event.key === "ArrowRight") {

            await changePage(1);
        }


        /*
         * + / - control zoom.
         */

        if (
            event.key === "+" ||
            event.key === "="
        ) {

            await changeZoom(0.1);
        }


        if (
            event.key === "-" ||
            event.key === "_"
        ) {

            await changeZoom(-0.1);
        }
    }
);


/* =========================================================
   GLOBAL ERROR HANDLING
   ========================================================= */

window.addEventListener(
    "error",
    event => {

        console.error(
            "Unhandled application error:",
            event.error || event.message
        );
    }
);


window.addEventListener(
    "unhandledrejection",
    event => {

        console.error(
            "Unhandled promise rejection:",
            event.reason
        );
    }
);
