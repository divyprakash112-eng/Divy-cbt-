/* =========================================================
   CBT PREMIUM TEST MAKER
   app.js

   STEP 4
   - PDF upload
   - Drag & drop
   - PDF.js rendering
   - Page navigation
   - Zoom
   - Mouse crop selection
   - Touch crop selection
   - Crop selected PDF region
   - Add cropped region as question
   - Question thumbnail
   - Subject field
   - Correct answer field
   ========================================================= */


/* =========================================================
   PDF.JS
   ========================================================= */

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

    pdfInput:
        document.getElementById("pdfInput"),

    dropZone:
        document.getElementById("dropZone"),

    pdfFileName:
        document.getElementById("pdfFileName"),

    pdfPageInfo:
        document.getElementById("pdfPageInfo"),

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

    selectionStatus:
        document.getElementById("selectionStatus"),

    selectionStatusDot:
        document.getElementById("selectionStatusDot"),

    addQuestionBtn:
        document.getElementById("addQuestionBtn"),

    questionCount:
        document.getElementById("questionCount"),

    answerKeyCount:
        document.getElementById("answerKeyCount"),

    subjectSummary:
        document.getElementById("subjectSummary"),

    questionList:
        document.getElementById("questionList"),

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

    exportExamBtn:
        document.getElementById("exportExamBtn"),

    exportWarning:
        document.getElementById("exportWarning"),

    saveProjectBtn:
        document.getElementById("saveProjectBtn"),

    loadProjectBtn:
        document.getElementById("loadProjectBtn"),

    projectFileInput:
        document.getElementById("projectFileInput"),

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
   CROP STATE
   ========================================================= */

const cropState = {

    active: false,

    startX: 0,
    startY: 0,

    currentX: 0,
    currentY: 0,

    width: 0,
    height: 0,

    pointerId: null

};


/*
 * Minimum crop dimensions.
 *
 * Accidental clicks or tiny selections are ignored.
 */

const MIN_CROP_WIDTH = 15;
const MIN_CROP_HEIGHT = 15;


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

    const moduleUrl =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

    try {

        pdfjsLib =
            await import(moduleUrl);


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

    /* PDF upload */

    elements.pdfInput.addEventListener(
        "change",
        handlePdfInput
    );


    /* Drag and drop */

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


    /* Page navigation */

    elements.prevPageBtn.addEventListener(
        "click",
        () => changePage(-1)
    );

    elements.nextPageBtn.addEventListener(
        "click",
        () => changePage(1)
    );


    /* Zoom */

    elements.zoomOutBtn.addEventListener(
        "click",
        () => changeZoom(-0.1)
    );

    elements.zoomInBtn.addEventListener(
        "click",
        () => changeZoom(0.1)
    );


    /* Crop button */

    elements.addQuestionBtn.addEventListener(
        "click",
        addSelectedRegionAsQuestion
    );


    /*
     * Pointer events are used instead of separate mouse and
     * touch listeners.
     *
     * Pointer events work with:
     * - mouse
     * - touchscreen
     * - stylus
     */

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


    /* Settings */

    elements.settingsForm.addEventListener(
        "input",
        handleSettingsChange
    );

    elements.settingsForm.addEventListener(
        "change",
        handleSettingsChange
    );


    /* Project */

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


    /* Export placeholder */

    elements.exportExamBtn.addEventListener(
        "click",
        handleExportPlaceholder
    );


    /* Modal */

    elements.modalCancelBtn.addEventListener(
        "click",
        closeModal
    );
}


/* =========================================================
   PDF INPUT
   ========================================================= */

async function handlePdfInput(event) {

    const file =
        event.target.files &&
        event.target.files[0];

    if (!file) {
        return;
    }

    await loadPdfFile(file);

    event.target.value = "";
}


/* =========================================================
   DRAG OVER
   ========================================================= */

function handleDragOver(event) {

    event.preventDefault();

    event.dataTransfer.dropEffect =
        "copy";

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


    if (
        !files ||
        files.length === 0
    ) {
        return;
    }


    await loadPdfFile(
        files[0]
    );
}


/* =========================================================
   LOAD PDF
   ========================================================= */

async function loadPdfFile(file) {

    if (!file) {
        return;
    }


    const isPdf =
        file.type ===
            "application/pdf" ||
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


    const fileSizeMB =
        file.size /
        (1024 * 1024);


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


        const arrayBuffer =
            await file.arrayBuffer();


        const pdfData =
            new Uint8Array(
                arrayBuffer
            );


        const loadingTask =
            pdfjsLib.getDocument({
                data: pdfData
            });


        pdfDocument =
            await loadingTask.promise;


        currentPdfFile = {

            name:
                file.name,

            size:
                file.size,

            type:
                file.type
        };


        currentPageNumber = 1;

        currentScale = 1.0;


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


        showToast(
            "Could not open this PDF. Please make sure it is a valid PDF file.",
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


        const viewport =
            page.getViewport({
                scale: currentScale
            });


        const canvas =
            elements.pdfCanvas;


        const context =
            canvas.getContext(
                "2d",
                {
                    alpha: false
                }
            );


        context.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        canvas.width =
            Math.floor(
                viewport.width
            );


        canvas.height =
            Math.floor(
                viewport.height
            );


        canvas.style.width =
            `${Math.floor(viewport.width)}px`;


        canvas.style.height =
            `${Math.floor(viewport.height)}px`;


        await page.render({

            canvasContext:
                context,

            viewport:
                viewport

        }).promise;


        elements.pdfPageInfo.textContent =
            `Page ${currentPageNumber} of ${pdfDocument.numPages}`;


        updatePdfControls();

        updateZoomDisplay();


        /*
         * Any page/zoom change invalidates an old selection.
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
   PAGE NAVIGATION
   ========================================================= */

async function changePage(direction) {

    if (!pdfDocument) {
        return;
    }


    const newPage =
        currentPageNumber +
        direction;


    if (
        newPage < 1 ||
        newPage >
            pdfDocument.numPages
    ) {
        return;
    }


    currentPageNumber =
        newPage;


    await renderCurrentPage();
}


/* =========================================================
   ZOOM
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
            (
                currentScale +
                delta
            ) * 10
        ) / 10;


    if (
        newScale <
            minimumScale ||
        newScale >
            maximumScale
    ) {
        return;
    }


    currentScale =
        newScale;


    await renderCurrentPage();
}


/* =========================================================
   PDF CONTROL STATE
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
            (
                pdfDocument?.numPages ||
                1
            );


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
   CROP POINTER DOWN
   ========================================================= */

function handleCropPointerDown(event) {

    if (!pdfDocument) {
        return;
    }


    /*
     * Only the primary pointer should start a selection.
     */

    if (
        event.isPrimary === false
    ) {
        return;
    }


    event.preventDefault();


    const point =
        getCanvasPointerPosition(
            event
        );


    if (!point) {
        return;
    }


    cropState.active =
        true;


    cropState.pointerId =
        event.pointerId;


    cropState.startX =
        point.x;


    cropState.startY =
        point.y;


    cropState.currentX =
        point.x;


    cropState.currentY =
        point.y;


    cropState.width = 0;

    cropState.height = 0;


    /*
     * Capture the pointer so selection continues even if
     * the pointer briefly leaves the canvas.
     */

    try {

        elements.pdfCanvas.setPointerCapture(
            event.pointerId
        );

    } catch (error) {

        /*
         * Pointer capture is not available in some older browsers.
         * It is not required for the selection to work.
         */

        console.debug(
            "Pointer capture unavailable."
        );
    }


    elements.pdfCanvas.classList.add(
        "is-cropping"
    );


    updateSelectionRectangle();
}


/* =========================================================
   CROP POINTER MOVE
   ========================================================= */

function handleCropPointerMove(event) {

    if (
        !cropState.active ||
        event.pointerId !==
            cropState.pointerId
    ) {
        return;
    }


    event.preventDefault();


    const point =
        getCanvasPointerPosition(
            event
        );


    if (!point) {
        return;
    }


    cropState.currentX =
        point.x;


    cropState.currentY =
        point.y;


    updateSelectionRectangle();
}


/* =========================================================
   CROP POINTER UP
   ========================================================= */

function handleCropPointerUp(event) {

    if (
        !cropState.active ||
        event.pointerId !==
            cropState.pointerId
    ) {
        return;
    }


    event.preventDefault();


    const point =
        getCanvasPointerPosition(
            event
        );


    if (point) {

        cropState.currentX =
            point.x;

        cropState.currentY =
            point.y;
    }


    cropState.active =
        false;


    try {

        elements.pdfCanvas.releasePointerCapture(
            event.pointerId
        );

    } catch (error) {

        /*
         * Safe to ignore.
         */
    }


    elements.pdfCanvas.classList.remove(
        "is-cropping"
    );


    finalizeSelection();
}


/* =========================================================
   CROP POINTER CANCEL
   ========================================================= */

function handleCropPointerCancel(event) {

    if (
        event.pointerId !==
        cropState.pointerId
    ) {
        return;
    }


    cancelCropSelection();
}


/* =========================================================
   CROP POINTER LEAVE
   ========================================================= */

function handleCropPointerLeave(event) {

    /*
     * Do not cancel the selection.
     *
     * Pointer capture normally keeps the selection alive.
     */
}


/* =========================================================
   CANCEL CROP
   ========================================================= */

function cancelCropSelection() {

    cropState.active =
        false;


    cropState.pointerId =
        null;


    elements.pdfCanvas.classList.remove(
        "is-cropping"
    );


    clearSelection();
}


/* =========================================================
   GET POINTER POSITION
   ========================================================= */

function getCanvasPointerPosition(event) {

    const canvas =
        elements.pdfCanvas;


    const rect =
        canvas.getBoundingClientRect();


    if (
        !rect.width ||
        !rect.height
    ) {
        return null;
    }


    /*
     * CSS size and actual canvas pixel size may differ.
     *
     * Convert screen coordinates into actual canvas coordinates.
     */

    const scaleX =
        canvas.width /
        rect.width;


    const scaleY =
        canvas.height /
        rect.height;


    let x =
        (event.clientX -
            rect.left) *
        scaleX;


    let y =
        (event.clientY -
            rect.top) *
        scaleY;


    /*
     * Clamp coordinates to canvas boundaries.
     */

    x =
        Math.max(
            0,
            Math.min(
                canvas.width,
                x
            )
        );


    y =
        Math.max(
            0,
            Math.min(
                canvas.height,
                y
            )
        );


    return {
        x,
        y
    };
}


/* =========================================================
   UPDATE SELECTION RECTANGLE
   ========================================================= */

function updateSelectionRectangle() {

    const x1 =
        cropState.startX;


    const y1 =
        cropState.startY;


    const x2 =
        cropState.currentX;


    const y2 =
        cropState.currentY;


    const left =
        Math.min(
            x1,
            x2
        );


    const top =
        Math.min(
            y1,
            y2
        );


    const width =
        Math.abs(
            x2 - x1
        );


    const height =
        Math.abs(
            y2 - y1
        );


    cropState.width =
        width;


    cropState.height =
        height;


    /*
     * The overlay is positioned relative to canvasWrapper.
     *
     * The canvas itself begins at 0,0 inside the wrapper.
     */

    elements.selectionOverlay.hidden =
        false;


    elements.selectionOverlay.style.left =
        `${left}px`;


    elements.selectionOverlay.style.top =
        `${top}px`;


    elements.selectionOverlay.style.width =
        `${width}px`;


    elements.selectionOverlay.style.height =
        `${height}px`;


    if (
        width >= MIN_CROP_WIDTH &&
        height >= MIN_CROP_HEIGHT
    ) {

        elements.selectionStatus.textContent =
            `${Math.round(width)} × ${Math.round(height)} px selected — ready to add`;


        elements.selectionStatusDot.classList.add(
            "active"
        );


        elements.addQuestionBtn.disabled =
            false;

    } else {

        elements.selectionStatus.textContent =
            "Keep dragging to select the complete question";


        elements.selectionStatusDot.classList.remove(
            "active"
        );


        elements.addQuestionBtn.disabled =
            true;
    }
}


/* =========================================================
   FINALIZE SELECTION
   ========================================================= */

function finalizeSelection() {

    const width =
        cropState.width;


    const height =
        cropState.height;


    if (
        width < MIN_CROP_WIDTH ||
        height < MIN_CROP_HEIGHT
    ) {

        showToast(
            "Selection is too small. Drag around the complete question.",
            "warning"
        );


        clearSelection();

        return;
    }


    updateSelectionRectangle();
}


/* =========================================================
   CLEAR SELECTION
   ========================================================= */

function clearSelection() {

    cropState.active =
        false;


    cropState.pointerId =
        null;


    cropState.startX = 0;
    cropState.startY = 0;
    cropState.currentX = 0;
    cropState.currentY = 0;

    cropState.width = 0;
    cropState.height = 0;


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


    elements.pdfCanvas.classList.remove(
        "is-cropping"
    );
}


/* =========================================================
   CROP SELECTED REGION
   ========================================================= */

function cropSelectedRegion() {

    if (!pdfDocument) {

        throw new Error(
            "No PDF page is loaded."
        );
    }


    const canvas =
        elements.pdfCanvas;


    const x =
        Math.min(
            cropState.startX,
            cropState.currentX
        );


    const y =
        Math.min(
            cropState.startY,
            cropState.currentY
        );


    const width =
        Math.abs(
            cropState.currentX -
            cropState.startX
        );


    const height =
        Math.abs(
            cropState.currentY -
            cropState.startY
        );


    if (
        width < MIN_CROP_WIDTH ||
        height < MIN_CROP_HEIGHT
    ) {

        throw new Error(
            "The selected region is too small."
        );
    }


    /*
     * Extra safety:
     * Make sure the crop remains inside the canvas.
     */

    const safeX =
        Math.max(
            0,
            Math.min(
                canvas.width,
                x
            )
        );


    const safeY =
        Math.max(
            0,
            Math.min(
                canvas.height,
                y
            )
        );


    const safeWidth =
        Math.min(
            width,
            canvas.width - safeX
        );


    const safeHeight =
        Math.min(
            height,
            canvas.height - safeY
        );


    if (
        safeWidth < MIN_CROP_WIDTH ||
        safeHeight < MIN_CROP_HEIGHT
    ) {

        throw new Error(
            "The selected region is outside the page."
        );
    }


    /*
     * Create a second canvas.
     *
     * This is the actual crop canvas.
     */

    const cropCanvas =
        document.createElement(
            "canvas"
        );


    cropCanvas.width =
        Math.round(
            safeWidth
        );


    cropCanvas.height =
        Math.round(
            safeHeight
        );


    const cropContext =
        cropCanvas.getContext(
            "2d"
        );


    /*
     * White background.
     *
     * This avoids transparent backgrounds in the resulting
     * question image.
     */

    cropContext.fillStyle =
        "#ffffff";


    cropContext.fillRect(
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
    );


    /*
     * Copy exact pixels from the rendered PDF canvas.
     */

    cropContext.drawImage(

        canvas,

        safeX,
        safeY,
        safeWidth,
        safeHeight,

        0,
        0,
        cropCanvas.width,
        cropCanvas.height

    );


    /*
     * Convert crop to base64 data URL.
     *
     * This makes the question image completely portable.
     */

    return cropCanvas.toDataURL(
        "image/png"
    );
}


/* =========================================================
   ADD SELECTED REGION AS QUESTION
   ========================================================= */

function addSelectedRegionAsQuestion() {

    if (!pdfDocument) {

        showToast(
            "Load a PDF before adding a question.",
            "warning"
        );

        return;
    }


    if (
        cropState.width <
            MIN_CROP_WIDTH ||
        cropState.height <
            MIN_CROP_HEIGHT
    ) {

        showToast(
            "Select a question region first.",
            "warning"
        );

        return;
    }


    try {

        showLoading(
            "Creating question image..."
        );


        const imageData =
            cropSelectedRegion();


        const question =
            createQuestion(
                imageData
            );


        appState.questions.push(
            question
        );


        renderQuestionList();

        updateQuestionCounters();


        clearSelection();


        hideLoading();


        showToast(
            `Question ${appState.questions.length} added.`,
            "success"
        );


    } catch (error) {

        hideLoading();

        console.error(
            "Question crop failed:",
            error
        );


        showToast(
            error.message ||
            "Could not crop this question.",
            "error"
        );
    }
}


/* =========================================================
   CREATE QUESTION OBJECT
   ========================================================= */

function createQuestion(
    imageData
) {

    return {

        id:
            createQuestionId(),

        image:
            imageData,

        subject:
            getDefaultSubject(),

        correctAnswer:
            "",

        page:
            currentPageNumber,

        crop: {

            x:
                Math.round(
                    Math.min(
                        cropState.startX,
                        cropState.currentX
                    )
                ),

            y:
                Math.round(
                    Math.min(
                        cropState.startY,
                        cropState.currentY
                    )
                ),

            width:
                Math.round(
                    cropState.width
                ),

            height:
                Math.round(
                    cropState.height
                )
        }
    };
}


/* =========================================================
   DEFAULT SUBJECT
   ========================================================= */

function getDefaultSubject() {

    const subjects =
        getSubjectOrder();


    if (
        subjects.length > 0
    ) {
        return subjects[0];
    }


    return "General";
}


/* =========================================================
   QUESTION ID
   ========================================================= */

function createQuestionId() {

    return (
        "q-" +
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 8)
    );
}


/* =========================================================
   SUBJECT ORDER
   ========================================================= */

function getSubjectOrder() {

    return elements.subjectOrder.value
        .split(",")
        .map(
            item =>
                item.trim()
        )
        .filter(Boolean);
}


/* =========================================================
   RENDER QUESTION LIST
   ========================================================= */

function renderQuestionList() {

    const questions =
        appState.questions;


    if (
        questions.length === 0
    ) {

        elements.questionList.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    ?
                </div>

                <strong>
                    No questions yet
                </strong>

                <p>
                    Upload a PDF, select a question area,
                    and add it here.
                </p>

            </div>
        `;

        return;
    }


    elements.questionList.innerHTML =
        questions
            .map(
                (
                    question,
                    index
                ) =>
                    createQuestionCardHtml(
                        question,
                        index
                    )
            )
            .join("");


    bindQuestionCardEvents();
}


/* =========================================================
   QUESTION CARD HTML
   ========================================================= */

function createQuestionCardHtml(
    question,
    index
) {

    const optionCount =
        appState.settings.optionCount;


    const options =
        createOptionLetters(
            optionCount
        );


    const answerOptions =
        options
            .map(
                letter => `
                    <option
                        value="${letter}"
                        ${
                            question.correctAnswer ===
                            letter
                                ? "selected"
                                : ""
                        }
                    >
                        ${letter}
                    </option>
                `
            )
            .join("");


    return `
        <article
            class="question-card"
            data-question-id="${escapeHtml(question.id)}"
        >

            <div class="question-card-top">

                <div class="question-number">
                    ${index + 1}
                </div>

                <div>
                    <span class="eyebrow">
                        PAGE ${question.page || "—"}
                    </span>
                </div>

                <div class="question-card-actions">

                    <button
                        type="button"
                        class="question-action move-up"
                        data-question-id="${escapeHtml(question.id)}"
                        title="Move up"
                        ${
                            index === 0
                                ? "disabled"
                                : ""
                        }
                    >
                        ↑
                    </button>

                    <button
                        type="button"
                        class="question-action move-down"
                        data-question-id="${escapeHtml(question.id)}"
                        title="Move down"
                        ${
                            index === questionsLength() - 1
                                ? "disabled"
                                : ""
                        }
                    >
                        ↓
                    </button>

                    <button
                        type="button"
                        class="question-action delete"
                        data-question-id="${escapeHtml(question.id)}"
                        title="Delete question"
                    >
                        ×
                    </button>

                </div>

            </div>


            <div class="question-thumbnail">

                <img
                    src="${question.image}"
                    alt="Question ${index + 1} cropped preview"
                    loading="lazy"
                >

            </div>


            <div class="question-fields">

                <div class="mini-field">

                    <label
                        for="subject-${escapeHtml(question.id)}"
                    >
                        Subject
                    </label>

                    <input
                        id="subject-${escapeHtml(question.id)}"
                        type="text"
                        class="question-subject"
                        data-question-id="${escapeHtml(question.id)}"
                        value="${escapeHtml(question.subject)}"
                        placeholder="Physics"
                    >

                </div>


                <div class="mini-field">

                    <label
                        for="answer-${escapeHtml(question.id)}"
                    >
                        Answer
                    </label>

                    <select
                        id="answer-${escapeHtml(question.id)}"
                        class="question-answer"
                        data-question-id="${escapeHtml(question.id)}"
                    >

                        <option value="">
                            —
                        </option>

                        ${answerOptions}

                    </select>

                </div>

            </div>

        </article>
    `;
}


/* =========================================================
   QUESTION COUNT
   ========================================================= */

function questionsLength() {

    return appState.questions.length;
}


/* =========================================================
   OPTION LETTERS
   ========================================================= */

function createOptionLetters(
    count
) {

    const letters =
        [
            "A",
            "B",
            "C",
            "D",
            "E"
        ];


    return letters.slice(
        0,
        count
    );
}


/* =========================================================
   QUESTION CARD EVENTS
   ========================================================= */

function bindQuestionCardEvents() {

    /*
     * Subject fields
     */

    document
        .querySelectorAll(
            ".question-subject"
        )
        .forEach(
            input => {

                input.addEventListener(
                    "input",
                    event => {

                        const id =
                            event.target.dataset.questionId;


                        const question =
                            findQuestionById(
                                id
                            );


                        if (!question) {
                            return;
                        }


                        question.subject =
                            event.target.value;


                        updateQuestionCounters();
                    }
                );
            }
        );


    /*
     * Correct answer fields
     */

    document
        .querySelectorAll(
            ".question-answer"
        )
        .forEach(
            select => {

                select.addEventListener(
                    "change",
                    event => {

                        const id =
                            event.target.dataset.questionId;


                        const question =
                            findQuestionById(
                                id
                            );


                        if (!question) {
                            return;
                        }


                        question.correctAnswer =
                            event.target.value;


                        updateQuestionCounters();
                    }
                );
            }
        );


    /*
     * Move up
     */

    document
        .querySelectorAll(
            ".move-up"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        moveQuestion(
                            button.dataset.questionId,
                            -1
                        );
                    }
                );
            }
        );


    /*
     * Move down
     */

    document
        .querySelectorAll(
            ".move-down"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        moveQuestion(
                            button.dataset.questionId,
                            1
                        );
                    }
                );
            }
        );


    /*
     * Delete
     */

    document
        .querySelectorAll(
            ".question-action.delete"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        deleteQuestion(
                            button.dataset.questionId
                        );
                    }
                );
            }
        );
}


/* =========================================================
   FIND QUESTION
   ========================================================= */

function findQuestionById(
    id
) {

    return appState.questions.find(
        question =>
            question.id === id
    );
}


/* =========================================================
   MOVE QUESTION
   ========================================================= */

function moveQuestion(
    id,
    direction
) {

    const index =
        appState.questions.findIndex(
            question =>
                question.id === id
        );


    if (index === -1) {
        return;
    }


    const newIndex =
        index + direction;


    if (
        newIndex < 0 ||
        newIndex >=
            appState.questions.length
    ) {
        return;
    }


    const questions =
        appState.questions;


    [
        questions[index],
        questions[newIndex]
    ] =
    [
        questions[newIndex],
        questions[index]
    ];


    renderQuestionList();

    updateQuestionCounters();


    showToast(
        "Question order updated.",
        "success"
    );
}


/* =========================================================
   DELETE QUESTION
   ========================================================= */

function deleteQuestion(
    id
) {

    const question =
        findQuestionById(id);


    if (!question) {
        return;
    }


    openModal(

        "Delete question?",

        "This will remove the cropped question from your project.",

        () => {

            appState.questions =
                appState.questions.filter(
                    item =>
                        item.id !== id
                );


            renderQuestionList();

            updateQuestionCounters();


            showToast(
                "Question deleted.",
                "success"
            );
        }
    );
}


/* =========================================================
   SETTINGS
   ========================================================= */

function handleSettingsChange() {

    syncSettingsFromForm();

    /*
     * Option count can change the available answer letters.
     * Re-render the cards so the dropdown stays synchronized.
     */

    renderQuestionList();

    updateQuestionCounters();
}


/* =========================================================
   SYNC SETTINGS
   ========================================================= */

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
   SANITIZERS
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


function sanitizeOptionCount(
    value
) {

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
                Boolean(
                    question.correctAnswer
                )
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


    if (
        questions.length === 0
    ) {

        elements.subjectSummary.innerHTML =
            `
                <span class="empty-summary">
                    Subject counts will appear here.
                </span>
            `;

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
                ).trim() ||
                "Unassigned";


            subjectCounts[subject] =
                (
                    subjectCounts[subject] ||
                    0
                ) + 1;
        }
    );


    elements.subjectSummary.innerHTML =
        Object.entries(
            subjectCounts
        )
            .map(
                (
                    [
                        subject,
                        count
                    ]
                ) => `
                    <span class="subject-chip">
                        ${escapeHtml(subject)}
                        <strong>
                            ${count}
                        </strong>
                    </span>
                `
            )
            .join("");
}


/* =========================================================
   EXPORT WARNING
   ========================================================= */

function updateExportWarning() {

    if (
        appState.questions.length === 0
    ) {

        elements.exportWarning.hidden =
            true;

        return;
    }


    const missingAnswers =
        appState.questions.filter(
            question =>
                !question.correctAnswer
        ).length;


    if (
        missingAnswers > 0
    ) {

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
   PROJECT SAVE
   ========================================================= */

function saveProject() {

    syncSettingsFromForm();


    const project = {

        version:
            1,

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
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href =
            url;


        link.download =
            createSafeFileName(
                appState.settings.testTitle
            ) +
            "-project.json";


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        setTimeout(
            () => {

                URL.revokeObjectURL(
                    url
                );

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
   LOAD PROJECT
   ========================================================= */

async function handleProjectFile(
    event
) {

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


        validateProject(
            project
        );


        if (
            project.settings
        ) {

            appState.settings =
                {
                    ...appState.settings,
                    ...project.settings
                };


            applySettingsToForm();
        }


        if (
            Array.isArray(
                project.questions
            )
        ) {

            appState.questions =
                project.questions;

        } else {

            appState.questions =
                [];
        }


        renderQuestionList();

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

        event.target.value =
            "";
    }
}


/* =========================================================
   PROJECT VALIDATION
   ========================================================= */

function validateProject(
    project
) {

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
        !Array.isArray(
            project.questions
        )
    ) {

        throw new Error(
            "Project question data is invalid."
        );
    }
}


/* =========================================================
   APPLY SETTINGS
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
}


/* =========================================================
   EXPORT PLACEHOLDER
   ========================================================= */

function handleExportPlaceholder() {

    showToast(
        "The standalone exam generator will be added in a later step.",
        "info"
    );
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
        document.createElement(
            "div"
        );


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

function getToastTitle(
    type
) {

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
   MODAL
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

function createSafeFileName(
    name
) {

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
        ) ||
        "CBT-Mock-Test";
}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
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
    async event => {

        const target =
            event.target;


        const isTyping =
            target instanceof
                HTMLInputElement ||
            target instanceof
                HTMLTextAreaElement ||
            target instanceof
                HTMLSelectElement;


        if (isTyping) {
            return;
        }


        if (
            event.key ===
            "ArrowLeft"
        ) {

            await changePage(-1);
        }


        if (
            event.key ===
            "ArrowRight"
        ) {

            await changePage(1);
        }


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
            event.error ||
            event.message
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
