// Hebrew Font Maker - Main JavaScript Application

const API_BASE = '/api';

// Application State
const appState = {
    currentStep: 1,
    uploadedFile: null,
    uploadedImagePath: null,
    detectedLetters: [],   // array of {id, bbox, area, fill_ratio, image (base64)}
    assignments: {},       // { detectionId: 'א', ... }
    fontName: 'HebrewFont',
    activeInputId: null,   // which detection card is being edited
    mergeMode: false,      // merge mode toggle
    mergeSelection: new Set(),  // ids selected for merging
    // Preview & adjustment state
    adjustments: {},       // { char: { scale: 100, offsetX: 0, offsetY: 0 } }
    previewActiveChar: null
};

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeUploadArea();
    initializeEventListeners();
    checkApiHealth();
});

async function checkApiHealth() {
    try {
        const res = await fetch(`${API_BASE}/health`);
        const data = await res.json();
        if (data.status !== 'ok') throw new Error();
    } catch {
        showNotification('warning', 'השרת לא מגיב. ודא ש-run.bat רץ.');
    }
}

// ==================== Upload ====================
function initializeUploadArea() {
    const area = document.getElementById('upload-area');
    const input = document.getElementById('file-input');

    area.addEventListener('click', () => input.click());

    area.addEventListener('dragover', e => {
        e.preventDefault();
        area.classList.add('dragover');
    });
    area.addEventListener('dragleave', () => area.classList.remove('dragover'));
    area.addEventListener('drop', e => {
        e.preventDefault();
        area.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]);
    });

    input.addEventListener('change', e => {
        if (e.target.files.length) handleFileSelect(e.target.files[0]);
    });
}

function handleFileSelect(file) {
    if (!file.type.match('image.*')) {
        showNotification('error', 'בחר קובץ תמונה בבקשה');
        return;
    }
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('preview-image').src = e.target.result;
        document.getElementById('upload-area').style.display = 'none';
        document.getElementById('preview-container').style.display = 'block';
        document.getElementById('upload-btn').style.display = 'block';
        appState.uploadedFile = file;
    };
    reader.readAsDataURL(file);
}

function clearUpload() {
    document.getElementById('upload-area').style.display = 'block';
    document.getElementById('preview-container').style.display = 'none';
    document.getElementById('upload-btn').style.display = 'none';
    document.getElementById('file-input').value = '';
    appState.uploadedFile = null;
    reviewState.originalImageB64 = null;
    reviewState.imageObj = null;
}

// ==================== Event Listeners ====================
function initializeEventListeners() {
    document.getElementById('upload-btn').addEventListener('click', uploadImage);
    document.getElementById('clear-upload').addEventListener('click', clearUpload);

    // Step 2 (detection/assignment)
    document.getElementById('back-btn-detection').addEventListener('click', () => {
        goToStep(1);
        reviewState.originalImageB64 = null;
        reviewState.imageObj = null;
    });
    document.getElementById('next-btn-detection').addEventListener('click', goToPreview);

    // Step 3 (preview) — go back to step 2 assignment panel (not review)
    document.getElementById('back-btn-preview').addEventListener('click', () => {
        goToStep(2);
        document.getElementById('detection-review').style.display = 'none';
        document.getElementById('assignment-panel').style.display = 'block';
    });
    document.getElementById('next-btn-preview').addEventListener('click', goToGeneration);
    document.getElementById('preview-text-input').addEventListener('input', renderPreview);

    // Adjustment sliders (per-character)
    document.getElementById('adjust-scale').addEventListener('input', onAdjustChange);
    document.getElementById('adjust-offsetY').addEventListener('input', onAdjustChange);
    document.getElementById('adjust-offsetX').addEventListener('input', onAdjustChange);
    document.getElementById('adjust-spacing').addEventListener('input', onAdjustChange);

    // Adjustment sliders (apply-all) — only update display values live
    document.getElementById('adjust-all-scale').addEventListener('input', () => {
        document.getElementById('adjust-all-scale-val').textContent = document.getElementById('adjust-all-scale').value + '%';
    });
    document.getElementById('adjust-all-offsetY').addEventListener('input', () => {
        document.getElementById('adjust-all-offsetY-val').textContent = document.getElementById('adjust-all-offsetY').value;
    });
    document.getElementById('adjust-all-offsetX').addEventListener('input', () => {
        document.getElementById('adjust-all-offsetX-val').textContent = document.getElementById('adjust-all-offsetX').value;
    });
    document.getElementById('adjust-all-spacing').addEventListener('input', () => {
        document.getElementById('adjust-all-spacing-val').textContent = document.getElementById('adjust-all-spacing').value;
    });

    // Step 4 (generation)
    document.getElementById('generate-btn').addEventListener('click', generateFont);
    document.getElementById('back-btn-gen').addEventListener('click', () => goToStep(3));
    document.getElementById('open-folder-btn').addEventListener('click', openFontFolder);

    document.getElementById('font-name').addEventListener('change', e => {
        appState.fontName = e.target.value || 'HebrewFont';
    });

    // Global keyboard listener for letter assignment
    document.addEventListener('keydown', handleKeyAssignment);

    // Separation level sliders
    document.getElementById('separation-level').addEventListener('input', () => {
        document.getElementById('separation-level-val').textContent = document.getElementById('separation-level').value;
    });
    document.getElementById('review-separation').addEventListener('input', () => {
        document.getElementById('review-separation-val').textContent = document.getElementById('review-separation').value;
    });
}

// ==================== Upload & Detect ====================
async function uploadImage() {
    if (!appState.uploadedFile) {
        showNotification('error', 'בחר תמונה קודם');
        return;
    }

    showNotification('info', 'מעלה ומזהה אותיות...');

    const formData = new FormData();
    formData.append('file', appState.uploadedFile);
    formData.append('separation_level', document.getElementById('separation-level').value);

    try {
        const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        appState.detectedLetters = data.detections;
        appState.assignments = {};
        appState.imageInfo = data.image_info;
        appState.refHeight = computeRefHeight();

        showNotification('success', `זוהו ${data.count} אותיות!`);
        goToStep(2);
        showDetectionReview();
    } catch (err) {
        showNotification('error', `שגיאה: ${err.message}`);
    }
}

// ==================== Assignment Grid ====================
function populateAssignmentGrid() {
    const grid = document.getElementById('detection-grid');
    grid.innerHTML = '';

    const infoEl = document.getElementById('letter-count');
    infoEl.textContent = appState.detectedLetters.length;

    appState.detectedLetters.forEach((det, idx) => {
        const card = document.createElement('div');
        card.className = 'detection-card';
        card.dataset.id = idx;

        const assigned = appState.assignments[idx];

        card.innerHTML = `
            <div class="detection-card-img">
                <img src="data:image/png;base64,${det.image}" alt="letter ${idx + 1}">
            </div>
            <div class="detection-card-label ${assigned ? 'assigned' : 'unassigned'}" id="label-${idx}">
                ${assigned || '?'}
            </div>
            <div class="detection-card-hint">לחץ והקלד אות</div>
        `;

        card.addEventListener('click', () => {
            if (appState.mergeMode) {
                toggleMergeCard(idx);
            } else {
                activateCardInput(idx);
            }
        });
        grid.appendChild(card);
    });

    updateAssignmentStats();
}

function activateCardInput(idx) {
    // Deactivate previous
    document.querySelectorAll('.detection-card').forEach(c => c.classList.remove('active'));

    const card = document.querySelector(`.detection-card[data-id="${idx}"]`);
    if (card) {
        card.classList.add('active');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    appState.activeInputId = idx;
}

function handleKeyAssignment(e) {
    if (appState.activeInputId === null) return;
    if (appState.currentStep !== 2) return;

    const key = e.key;

    // Delete/Backspace removes assignment
    if (key === 'Delete' || key === 'Backspace') {
        e.preventDefault();
        delete appState.assignments[appState.activeInputId];
        updateCardLabel(appState.activeInputId);
        moveToNextCard();
        return;
    }

    // Escape deselects
    if (key === 'Escape') {
        appState.activeInputId = null;
        document.querySelectorAll('.detection-card').forEach(c => c.classList.remove('active'));
        return;
    }

    // Ignore modifier keys, arrows, etc.
    if (key.length !== 1) return;

    e.preventDefault();

    // Assign the typed character to this detection
    appState.assignments[appState.activeInputId] = key;
    updateCardLabel(appState.activeInputId);
    moveToNextCard();
}

function moveToNextCard() {
    const next = appState.activeInputId + 1;
    if (next < appState.detectedLetters.length) {
        activateCardInput(next);
    } else {
        appState.activeInputId = null;
        document.querySelectorAll('.detection-card').forEach(c => c.classList.remove('active'));
    }
    updateAssignmentStats();
}

function updateCardLabel(idx) {
    const labelEl = document.getElementById(`label-${idx}`);
    if (!labelEl) return;

    const assigned = appState.assignments[idx];
    labelEl.textContent = assigned || '?';
    labelEl.className = `detection-card-label ${assigned ? 'assigned' : 'unassigned'}`;
}

function updateAssignmentStats() {
    const total = appState.detectedLetters.length;
    const assigned = Object.keys(appState.assignments).length;

    const statsEl = document.getElementById('assignment-stats');
    if (statsEl) {
        statsEl.textContent = `${assigned} / ${total} אותיות הוקצו`;
    }
}

// ==================== Font Generation ====================
function goToPreview() {
    const assignedCount = Object.keys(appState.assignments).length;
    if (assignedCount === 0) {
        showNotification('error', 'הקצ לפחות אות אחת לפני המשך');
        return;
    }
    // Recalculate refHeight now that assignments are set
    appState.refHeight = computeRefHeight();
    goToStep(3);
    renderPreview();
}

function goToGeneration() {
    goToStep(4);
}

async function generateFont() {
    const fontName = document.getElementById('font-name').value || 'HebrewFont';
    const statusText = document.getElementById('status-text');
    const progressBar = document.getElementById('progress-bar');
    const generateBtn = document.getElementById('generate-btn');

    // Build assignments array from our map
    const assignments = [];
    Object.entries(appState.assignments).forEach(([detId, char]) => {
        assignments.push({
            detection_id: parseInt(detId),
            hebrew_char: char,
            manual_label: ''
        });
    });

    try {
        statusText.textContent = 'מעבד הקצאות...';
        progressBar.style.display = 'block';
        generateBtn.disabled = true;
        setProgress(30);

        const assignRes = await fetch(`${API_BASE}/assign-letters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignments })
        });
        if (!assignRes.ok) throw new Error('Failed to process assignments');

        setProgress(60);
        statusText.textContent = 'יוצר פונט...';

        const genRes = await fetch(`${API_BASE}/generate-font`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                font_name: fontName,
                adjustments: appState.adjustments,
                ref_height: appState.refHeight,
                metadata: getFontMetadata()
            })
        });
        const genData = await genRes.json();
        if (!genRes.ok) throw new Error(genData.error || 'Font generation failed');

        setProgress(100);
        statusText.textContent = 'הושלם!';

        appState.generatedFontFile = genData.filename;
        document.getElementById('result-message').textContent =
            `הפונט '${fontName}' נוצר בהצלחה עם ${genData.glyph_count} אותיות`;
        document.getElementById('result-path').textContent =
            `נשמר ב: fonts_output/${genData.filename}`;
        document.getElementById('result-container').style.display = 'block';
        showNotification('success', 'הפונט נוצר בהצלחה!');
    } catch (err) {
        statusText.textContent = 'שגיאה';
        showNotification('error', `שגיאה: ${err.message}`);
    } finally {
        generateBtn.disabled = false;
    }
}

function setProgress(pct) {
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = pct + '%';
}

function openFontFolder() {
    fetch(`${API_BASE}/open-output-folder`, { method: 'POST' })
        .then(() => showNotification('info', 'פותח תיקיית פונטים...'))
        .catch(() => showNotification('info', `הפונט נמצא ב: fonts_output/`));
}

// ==================== Preview & Adjustments ====================
function getCharImage(char) {
    // Find the detection that is assigned to this character
    for (const [detId, assignedChar] of Object.entries(appState.assignments)) {
        if (assignedChar === char) {
            const det = appState.detectedLetters[parseInt(detId)];
            if (det) return det.image;
        }
    }
    return null;
}

// Descender letters — these extend below the baseline
const DESCENDER_CHARS = new Set(['\u05E3', '\u05E5', '\u05DF', '\u05E7', '\u05DA']);
// ף=05E3 ץ=05E5 ן=05DF ק=05E7 ך=05DA

// Descender shift in CSS pixels — matches font's DESCENDER_SHIFT (-200 font units)
// Conversion: 200 * displayMax / target_h = 200 * 80 / 750 ≈ 21.33px
const DESCENDER_SHIFT_PX = 200 * 80 / 750;

function computeRefHeight() {
    // Prefer assigned-only heights (matches server & ensures px_to_font accuracy).
    // Tallest assigned letter = 80px in preview = 750 font units.
    const assignedIds = new Set(Object.keys(appState.assignments).map(Number));
    let maxH = 0;

    if (assignedIds.size > 0) {
        for (const det of appState.detectedLetters) {
            if (assignedIds.has(det.id) && det.bbox && det.bbox.h > maxH) {
                maxH = det.bbox.h;
            }
        }
    }

    // Fallback: use all detections (before assignment is done)
    if (maxH === 0) {
        for (const det of appState.detectedLetters) {
            if (det.bbox && det.bbox.h > maxH) maxH = det.bbox.h;
        }
    }
    return maxH || 1;
}

function getDetectionForChar(char) {
    // Find the detection entry assigned to this character
    for (const [detId, assignedChar] of Object.entries(appState.assignments)) {
        if (assignedChar === char) {
            return appState.detectedLetters[parseInt(detId)];
        }
    }
    return null;
}

function renderPreview() {
    const input = document.getElementById('preview-text-input');
    const area = document.getElementById('preview-render-area');
    const text = input.value;

    area.innerHTML = '';

    if (!text) {
        area.innerHTML = '<p class="preview-placeholder">הקלד טקסט למעלה...</p>';
        return;
    }

    for (const char of text) {
        const img64 = getCharImage(char);
        const adj = appState.adjustments[char] || { scale: 100, offsetX: 0, offsetY: 0, spacing: 0 };
        const det = getDetectionForChar(char);

        const wrapper = document.createElement('div');
        wrapper.className = 'preview-glyph';
        if (DESCENDER_CHARS.has(char)) wrapper.classList.add('preview-descender');
        if (char === appState.previewActiveChar) wrapper.classList.add('preview-glyph-active');

        // Apply spacing adjustment to the wrapper width
        const spacingPx = (adj.spacing || 0);
        if (spacingPx !== 0) {
            wrapper.style.marginLeft = spacingPx + 'px';
            wrapper.style.marginRight = spacingPx + 'px';
        }

        if (char === ' ') {
            wrapper.classList.add('preview-space');
            wrapper.innerHTML = '&nbsp;';
        } else if (img64) {
            const scaleF = adj.scale / 100;
            // Use proportional height: this letter's bbox.h / refHeight * displayMax
            const refH = appState.refHeight || computeRefHeight();
            const displayMax = 80; // px — matches CSS max-height for tallest letter
            let naturalH = displayMax;
            if (det && det.bbox && refH > 0) {
                naturalH = (det.bbox.h / refH) * displayMax;
            }
            const img = document.createElement('img');
            img.src = `data:image/png;base64,${img64}`;
            img.style.height = naturalH + 'px';
            img.style.maxHeight = 'none';
            img.style.maxWidth = 'none';
            img.style.width = 'auto';
            // Descender letters get extra translateY to match the font's DESCENDER_SHIFT.
            // This ensures what the user sees = what the font produces.
            const descPx = DESCENDER_CHARS.has(char) ? DESCENDER_SHIFT_PX : 0;
            img.style.transform = `scale(${scaleF}) translate(${adj.offsetX}px, ${adj.offsetY + descPx}px)`;
            img.style.transformOrigin = 'center bottom';
            wrapper.appendChild(img);
        } else {
            wrapper.classList.add('preview-missing');
            wrapper.textContent = char;
        }

        wrapper.addEventListener('click', () => selectPreviewChar(char));
        area.appendChild(wrapper);
    }
}

function selectPreviewChar(char) {
    appState.previewActiveChar = char;
    const adj = appState.adjustments[char] || { scale: 100, offsetX: 0, offsetY: 0, spacing: 0 };

    // Show controls
    document.getElementById('adjust-controls').style.display = 'block';
    document.getElementById('adjust-char-name').textContent = char;

    const scaleSlider = document.getElementById('adjust-scale');
    const offYSlider = document.getElementById('adjust-offsetY');
    const offXSlider = document.getElementById('adjust-offsetX');
    const spacingSlider = document.getElementById('adjust-spacing');

    scaleSlider.value = adj.scale;
    offYSlider.value = adj.offsetY;
    offXSlider.value = adj.offsetX;
    spacingSlider.value = adj.spacing || 0;

    document.getElementById('adjust-scale-val').textContent = adj.scale + '%';
    document.getElementById('adjust-offsetY-val').textContent = adj.offsetY;
    document.getElementById('adjust-offsetX-val').textContent = adj.offsetX;
    document.getElementById('adjust-spacing-val').textContent = adj.spacing || 0;

    renderPreview();
}

function onAdjustChange() {
    const char = appState.previewActiveChar;
    if (!char) return;

    const scale = parseInt(document.getElementById('adjust-scale').value);
    const offsetY = parseInt(document.getElementById('adjust-offsetY').value);
    const offsetX = parseInt(document.getElementById('adjust-offsetX').value);
    const spacing = parseInt(document.getElementById('adjust-spacing').value);

    document.getElementById('adjust-scale-val').textContent = scale + '%';
    document.getElementById('adjust-offsetY-val').textContent = offsetY;
    document.getElementById('adjust-offsetX-val').textContent = offsetX;
    document.getElementById('adjust-spacing-val').textContent = spacing;

    appState.adjustments[char] = { scale, offsetX, offsetY, spacing };
    renderPreview();
}

function resetCurrentAdjustment() {
    const char = appState.previewActiveChar;
    if (!char) return;
    delete appState.adjustments[char];
    selectPreviewChar(char);
}

function resetAllAdjustments() {
    appState.adjustments = {};
    appState.previewActiveChar = null;
    document.getElementById('adjust-controls').style.display = 'none';
    // Reset the apply-all sliders too
    document.getElementById('adjust-all-scale').value = 100;
    document.getElementById('adjust-all-scale-val').textContent = '100%';
    document.getElementById('adjust-all-offsetY').value = 0;
    document.getElementById('adjust-all-offsetY-val').textContent = '0';
    document.getElementById('adjust-all-offsetX').value = 0;
    document.getElementById('adjust-all-offsetX-val').textContent = '0';
    document.getElementById('adjust-all-spacing').value = 0;
    document.getElementById('adjust-all-spacing-val').textContent = '0';
    renderPreview();
}

function applyToAll() {
    const scale = parseInt(document.getElementById('adjust-all-scale').value);
    const offsetY = parseInt(document.getElementById('adjust-all-offsetY').value);
    const offsetX = parseInt(document.getElementById('adjust-all-offsetX').value);
    const spacing = parseInt(document.getElementById('adjust-all-spacing').value);

    // Get all unique assigned characters
    const chars = new Set(Object.values(appState.assignments));
    for (const char of chars) {
        appState.adjustments[char] = { scale, offsetX, offsetY, spacing };
    }

    // If a character is currently selected, update its sliders
    if (appState.previewActiveChar) {
        selectPreviewChar(appState.previewActiveChar);
    }
    renderPreview();
    showNotification('success', `הוחל על ${chars.size} אותיות`);
}

// ==================== Re-detect ====================
async function redetectLetters() {
    const separationLevel = parseInt(document.getElementById('redetect-separation').value);
    showNotification('info', `מזהה מחדש עם רמת הפרדה ${separationLevel}...`);

    try {
        const res = await fetch(`${API_BASE}/redetect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ separation_level: separationLevel })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Re-detection failed');

        appState.detectedLetters = data.detections;
        appState.assignments = {};
        appState.mergeMode = false;
        appState.mergeSelection.clear();
        appState.refHeight = computeRefHeight();

        showNotification('success', `זוהו ${data.count} אותיות עם הפרדה ${separationLevel}`);
        populateAssignmentGrid();
    } catch (err) {
        showNotification('error', `שגיאה: ${err.message}`);
    }
}

// ==================== Detection Review (Canvas Overlay) ====================
const reviewState = {
    originalImageB64: null,
    imageObj: null,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    drawing: false,
    drawStart: null,
    drawCurrent: null,
    hoveredBox: -1
};

async function showDetectionReview() {
    // Show review panel, hide assignment panel
    document.getElementById('detection-review').style.display = 'block';
    document.getElementById('assignment-panel').style.display = 'none';
    document.getElementById('review-count').textContent = appState.detectedLetters.length;

    // Load original image for canvas
    if (!reviewState.originalImageB64) {
        try {
            const res = await fetch(`${API_BASE}/original-image`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            reviewState.originalImageB64 = data.image;
        } catch (err) {
            showNotification('error', 'שגיאה בטעינת תמונה: ' + err.message);
            return;
        }
    }

    // Load image into an Image object
    const img = new Image();
    img.onload = () => {
        reviewState.imageObj = img;
        initReviewCanvas();
        drawReviewCanvas();
    };
    img.src = 'data:image/jpeg;base64,' + reviewState.originalImageB64;
}

function initReviewCanvas() {
    const canvas = document.getElementById('review-canvas');
    const container = canvas.parentElement;
    const img = reviewState.imageObj;

    // Fit canvas to container width
    const maxW = container.clientWidth || 900;
    const scale = Math.min(1, maxW / img.width);
    reviewState.scale = scale;

    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    // Mouse events for drawing new boxes & clicking existing ones
    canvas.onmousedown = onReviewMouseDown;
    canvas.onmousemove = onReviewMouseMove;
    canvas.onmouseup = onReviewMouseUp;
    canvas.onmouseleave = () => {
        if (reviewState.drawing) {
            reviewState.drawing = false;
            reviewState.drawStart = null;
            drawReviewCanvas();
        }
    };
    canvas.style.cursor = 'crosshair';
}

function drawReviewCanvas() {
    const canvas = document.getElementById('review-canvas');
    const ctx = canvas.getContext('2d');
    const s = reviewState.scale;
    const img = reviewState.imageObj;

    // Draw original image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw existing detection boxes
    appState.detectedLetters.forEach((det, idx) => {
        const b = det.bbox;
        const x = b.x * s, y = b.y * s, w = b.w * s, h = b.h * s;

        const isHovered = (idx === reviewState.hoveredBox);
        ctx.strokeStyle = isHovered ? '#ef4444' : '#22c55e';
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.strokeRect(x, y, w, h);

        // Label with index
        ctx.fillStyle = isHovered ? 'rgba(239,68,68,0.8)' : 'rgba(34,197,94,0.7)';
        const labelH = 18;
        const labelW = ctx.measureText(String(idx + 1)).width + 8;
        ctx.fillRect(x, y - labelH, labelW, labelH);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(String(idx + 1), x + 4, y - 4);

        // If hovered, show X button area
        if (isHovered) {
            ctx.fillStyle = 'rgba(239,68,68,0.9)';
            ctx.fillRect(x + w - 18, y, 18, 18);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText('✕', x + w - 14, y + 14);
        }
    });

    // Draw current drawing rectangle (if active)
    if (reviewState.drawing && reviewState.drawStart && reviewState.drawCurrent) {
        const sx = reviewState.drawStart.x, sy = reviewState.drawStart.y;
        const cx = reviewState.drawCurrent.x, cy = reviewState.drawCurrent.y;
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(sx, sy, cx - sx, cy - sy);
        ctx.setLineDash([]);
    }

    // Update count
    document.getElementById('review-count').textContent = appState.detectedLetters.length;
}

function canvasToImage(cx, cy) {
    const s = reviewState.scale;
    return { x: cx / s, y: cy / s };
}

function getCanvasPos(e) {
    const canvas = document.getElementById('review-canvas');
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function findBoxAtPos(cx, cy) {
    // Find the smallest box under the cursor (prefer smaller = more specific)
    const s = reviewState.scale;
    let best = -1;
    let bestArea = Infinity;
    for (let i = 0; i < appState.detectedLetters.length; i++) {
        const b = appState.detectedLetters[i].bbox;
        const x = b.x * s, y = b.y * s, w = b.w * s, h = b.h * s;
        if (cx >= x && cx <= x + w && cy >= y && cy <= y + h) {
            const area = w * h;
            if (area < bestArea) {
                bestArea = area;
                best = i;
            }
        }
    }
    return best;
}

function onReviewMouseDown(e) {
    const pos = getCanvasPos(e);
    const boxIdx = findBoxAtPos(pos.x, pos.y);

    if (boxIdx >= 0) {
        // Check if clicking the X button area of hovered box
        const b = appState.detectedLetters[boxIdx].bbox;
        const s = reviewState.scale;
        const bx = b.x * s, by = b.y * s, bw = b.w * s;
        if (pos.x >= bx + bw - 18 && pos.x <= bx + bw && pos.y >= by && pos.y <= by + 18) {
            // Delete this detection
            removeDetection(boxIdx);
            return;
        }
    }

    // Start drawing a new box
    reviewState.drawing = true;
    reviewState.drawStart = pos;
    reviewState.drawCurrent = pos;
}

function onReviewMouseMove(e) {
    const pos = getCanvasPos(e);
    if (reviewState.drawing) {
        reviewState.drawCurrent = pos;
        drawReviewCanvas();
        return;
    }
    // Hover detection
    const boxIdx = findBoxAtPos(pos.x, pos.y);
    if (boxIdx !== reviewState.hoveredBox) {
        reviewState.hoveredBox = boxIdx;
        const canvas = document.getElementById('review-canvas');
        canvas.style.cursor = boxIdx >= 0 ? 'pointer' : 'crosshair';
        drawReviewCanvas();
    }
}

function onReviewMouseUp(e) {
    if (!reviewState.drawing) return;
    reviewState.drawing = false;

    const pos = getCanvasPos(e);
    const sx = reviewState.drawStart.x, sy = reviewState.drawStart.y;
    let rx = Math.min(sx, pos.x), ry = Math.min(sy, pos.y);
    let rw = Math.abs(pos.x - sx), rh = Math.abs(pos.y - sy);

    // Minimum size check (in canvas pixels)
    if (rw < 8 || rh < 8) {
        reviewState.drawStart = null;
        drawReviewCanvas();
        return;
    }

    // Convert to original image coordinates
    const s = reviewState.scale;
    const imgX = Math.round(rx / s), imgY = Math.round(ry / s);
    const imgW = Math.round(rw / s), imgH = Math.round(rh / s);

    addDetection(imgX, imgY, imgW, imgH);
}

async function addDetection(x, y, w, h) {
    try {
        const res = await fetch(`${API_BASE}/add-detection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x, y, w, h })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        appState.detectedLetters = data.detections;
        appState.refHeight = computeRefHeight();
        drawReviewCanvas();
        showNotification('success', `נוסף! סה"כ ${data.count} זיהויים`);
    } catch (err) {
        showNotification('error', `שגיאה: ${err.message}`);
    }
}

async function removeDetection(idx) {
    try {
        const res = await fetch(`${API_BASE}/remove-detection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: idx })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        appState.detectedLetters = data.detections;
        appState.refHeight = computeRefHeight();
        reviewState.hoveredBox = -1;
        drawReviewCanvas();
        showNotification('info', `הוסר. נותרו ${data.count} זיהויים`);
    } catch (err) {
        showNotification('error', `שגיאה: ${err.message}`);
    }
}

async function redetectFromReview() {
    const separationLevel = parseInt(document.getElementById('review-separation').value);
    showNotification('info', `מזהה מחדש עם רמת הפרדה ${separationLevel}...`);

    try {
        const res = await fetch(`${API_BASE}/redetect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ separation_level: separationLevel })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Re-detection failed');

        appState.detectedLetters = data.detections;
        appState.assignments = {};
        appState.refHeight = computeRefHeight();
        drawReviewCanvas();
        showNotification('success', `זוהו ${data.count} צורות`);
    } catch (err) {
        showNotification('error', `שגיאה: ${err.message}`);
    }
}

function confirmReviewAndProceed() {
    if (appState.detectedLetters.length === 0) {
        showNotification('error', 'אין זיהויים. הוסף לפחות אחד.');
        return;
    }
    // Ensure refHeight is up-to-date before proceeding
    appState.refHeight = computeRefHeight();
    // Switch from review to assignment panel
    document.getElementById('detection-review').style.display = 'none';
    document.getElementById('assignment-panel').style.display = 'block';
    populateAssignmentGrid();
}

function backToReview() {
    document.getElementById('assignment-panel').style.display = 'none';
    document.getElementById('detection-review').style.display = 'block';
    drawReviewCanvas();
}

// ==================== Merge Mode ====================
function toggleMergeMode() {
    appState.mergeMode = !appState.mergeMode;
    appState.mergeSelection.clear();

    const btn = document.getElementById('toggle-merge-mode');
    const hint = document.getElementById('merge-mode-hint');
    const mergeBtn = document.getElementById('merge-btn');
    const cancelBtn = document.getElementById('cancel-merge-btn');

    if (appState.mergeMode) {
        // Enter merge mode — deselect active card
        appState.activeInputId = null;
        document.querySelectorAll('.detection-card').forEach(c => {
            c.classList.remove('active');
            c.classList.remove('merge-selected');
        });
        btn.style.display = 'none';
        hint.style.display = 'inline';
        cancelBtn.style.display = 'inline-block';
        updateMergeBtn();
    } else {
        // Exit merge mode
        document.querySelectorAll('.detection-card').forEach(c => c.classList.remove('merge-selected'));
        btn.style.display = 'inline-block';
        hint.style.display = 'none';
        mergeBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
    }
}

function toggleMergeCard(idx) {
    if (appState.mergeSelection.has(idx)) {
        appState.mergeSelection.delete(idx);
    } else {
        appState.mergeSelection.add(idx);
    }

    const card = document.querySelector(`.detection-card[data-id="${idx}"]`);
    if (card) card.classList.toggle('merge-selected', appState.mergeSelection.has(idx));

    updateMergeBtn();
}

function updateMergeBtn() {
    const mergeBtn = document.getElementById('merge-btn');
    const splitBtn = document.getElementById('split-btn');
    const countEl = document.getElementById('merge-count');
    const n = appState.mergeSelection.size;
    countEl.textContent = n;
    mergeBtn.style.display = n >= 2 ? 'inline-block' : 'none';
    splitBtn.style.display = n === 1 ? 'inline-block' : 'none';
}

async function mergeSelected() {
    const ids = Array.from(appState.mergeSelection);
    if (ids.length < 2) return;

    showNotification('info', 'ממזג...');

    try {
        const res = await fetch(`${API_BASE}/merge-detections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Merge failed');

        appState.detectedLetters = data.detections;
        appState.assignments = {};
        appState.mergeMode = false;
        appState.mergeSelection.clear();
        appState.refHeight = computeRefHeight();
        resetMergeUI();
        populateAssignmentGrid();
        showNotification('success', `מוזגו ${ids.length} פריטים → ${data.count} זיהויים`);
    } catch (err) {
        showNotification('error', `שגיאה: ${err.message}`);
    }
}

async function splitSelected() {
    const ids = Array.from(appState.mergeSelection);
    if (ids.length !== 1) return;

    showNotification('info', 'מפצל...');

    try {
        const res = await fetch(`${API_BASE}/split-detection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: ids[0] })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Split failed');

        appState.detectedLetters = data.detections;
        appState.assignments = {};
        appState.mergeMode = false;
        appState.mergeSelection.clear();
        appState.refHeight = computeRefHeight();
        resetMergeUI();
        populateAssignmentGrid();
        showNotification('success', `פוצל ל-${data.split_count} חלקים (סה"כ ${data.count} זיהויים)`);
    } catch (err) {
        showNotification('error', `שגיאה: ${err.message}`);
    }
}

function resetMergeUI() {
    document.getElementById('toggle-merge-mode').style.display = 'inline-block';
    document.getElementById('merge-mode-hint').style.display = 'none';
    document.getElementById('merge-btn').style.display = 'none';
    document.getElementById('split-btn').style.display = 'none';
    document.getElementById('cancel-merge-btn').style.display = 'none';
}

// ==================== Navigation ====================
function goToStep(step) {
    appState.currentStep = step;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

    const stepMap = { 1: 'upload-section', 2: 'detection-section', 3: 'preview-section', 4: 'generation-section' };
    const section = document.getElementById(stepMap[step]);
    if (section) section.classList.add('active');

    // Update step indicators
    document.querySelectorAll('.step').forEach((el, i) => {
        el.classList.remove('active', 'completed');
        if (i + 1 === step) el.classList.add('active');
        else if (i + 1 < step) el.classList.add('completed');
    });

    window.scrollTo(0, 0);
}

// ==================== Notifications ====================
function showNotification(type, message) {
    const colors = { success: '#16a34a', error: '#dc2626', warning: '#ea580c', info: '#2563eb' };
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; top: 20px; left: 20px; padding: 15px 25px;
        border-radius: 8px; background: ${colors[type] || colors.info};
        color: white; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000; animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(-100%); opacity: 0; } }
`;
document.head.appendChild(style);

// ==================== Font Metadata Helpers ====================

function toggleFontMeta() {
    const fields = document.getElementById('font-meta-fields');
    fields.style.display = fields.style.display === 'none' ? 'block' : 'none';
}

function getFontMetadata() {
    return {
        author: (document.getElementById('font-author')?.value || '').trim(),
        description: (document.getElementById('font-description')?.value || '').trim(),
        version: (document.getElementById('font-version')?.value || '').trim(),
        license: (document.getElementById('font-license')?.value || '').trim(),
        url: (document.getElementById('font-url')?.value || '').trim(),
    };
}

function setFontMetadata(meta) {
    if (!meta) return;
    if (meta.author) document.getElementById('font-author').value = meta.author;
    if (meta.description) document.getElementById('font-description').value = meta.description;
    if (meta.version) document.getElementById('font-version').value = meta.version;
    if (meta.license) document.getElementById('font-license').value = meta.license;
    if (meta.url) document.getElementById('font-url').value = meta.url;
}

// ==================== Export / Import Project ====================

async function exportProject() {
    const fontName = document.getElementById('font-name').value || 'HebrewFont';

    try {
        showNotification('info', 'מייצא פרויקט...');

        const res = await fetch(`${API_BASE}/export-project`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                font_name: fontName,
                assignments: appState.assignments,
                adjustments: appState.adjustments,
                metadata: getFontMetadata()
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Export failed');
        }

        // Download the file
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fontName}_project.hfm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        showNotification('success', 'הפרויקט יוצא בהצלחה!');
    } catch (err) {
        showNotification('error', `שגיאה: ${err.message}`);
    }
}

async function importProject(inputEl) {
    const file = inputEl.files[0];
    if (!file) return;

    try {
        showNotification('info', 'טוען פרויקט...');

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_BASE}/import-project`, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Import failed');

        // Restore application state
        appState.detectedLetters = data.detections;
        appState.assignments = data.assignments || {};
        appState.adjustments = data.adjustments || {};
        appState.imageInfo = data.image_info;
        appState.refHeight = computeRefHeight();

        // Set font name
        const fontNameInput = document.getElementById('font-name');
        if (data.font_name) {
            fontNameInput.value = data.font_name;
            appState.fontName = data.font_name;
        }

        // Restore metadata fields
        setFontMetadata(data.metadata);

        showNotification('success', `הפרויקט נטען! ${data.count} זיהויים, ${Object.keys(appState.assignments).length} שיוכים`);

        // Decide which step to go to based on what was restored
        if (Object.keys(appState.assignments).length > 0) {
            // Has assignments — go straight to preview
            goToStep(3);
            renderPreview();
        } else {
            // No assignments yet — go to detection review
            goToStep(2);
            showDetectionReview();
        }
    } catch (err) {
        showNotification('error', `שגיאה בטעינת פרויקט: ${err.message}`);
    }

    // Clear the input so the same file can be re-imported
    inputEl.value = '';
}
