/* ============================================================
   Hebrew Font Editor — Main Logic  v4
   Multi-select, Pen tool, Layers, Undo/Redo, Smooth, i18n
   Flip/Rotate, Copy/Paste, Context Menu, Metadata, Pan/Zoom
   ============================================================ */
(() => {
'use strict';

const NS = 'http://www.w3.org/2000/svg';
const MODES = { SELECT: 'select', MARQUEE: 'marquee', PEN: 'pen' };

/* ---------- i18n ---------- */
const LANG = {
    current: localStorage.getItem('fe-lang') || 'he',
    strings: {
        he: {
            title: 'עורך פונטים עברי',
            noFontLoaded: 'לא נטען פונט',
            modified: 'שונה',
            selectFont: '— בחר פונט —',
            load: '📂 טען',
            upload: '📁 העלה',
            save: '💾 שמור',
            saveAs: '💾 שמור בשם',
            select: '⬚ בחירה',
            marquee: '▬ מרקיזה',
            pen: '✒ עט',
            selectV: 'בחירה (V)',
            marqueeM: 'מרקיזה (M)',
            penP: 'עט (P)',
            points: 'נקודות',
            guides: 'קווי עזר',
            glyphs: 'גליפים',
            searchChar: '🔍 חיפוש תו...',
            loadFontHint: 'טען פונט לצפייה בגליפים',
            selectGlyphHint: 'בחר גליף מהרשת<br>או טען פונט להתחלה',
            properties: 'מאפיינים',
            selectGlyph: 'בחר גליף',
            selectGlyphProps: 'בחר גליף כדי לערוך מאפיינים',
            previewPlaceholder: 'הקלד טקסט לתצוגה מקדימה...',
            loadFontPreview: 'טען פונט לתצוגה מקדימה',
            character: 'תו',
            char: 'תו',
            unicode: 'יוניקוד',
            name: 'שם',
            metrics: 'מדדים',
            width: 'רוחב',
            selection: 'בחירה',
            selPoints: 'נקודות',
            shiftX: 'הזזה X',
            shiftY: 'הזזה Y',
            scalePct: 'קנה מידה %',
            applyToSel: 'החל על בחירה',
            deleteSelPts: 'מחק נקודות נבחרות',
            pointTypeSmooth: 'סוג נקודה / עיגול',
            onCurve: 'על-עקום',
            offCurve: 'מחוץ-לעקום',
            toggleOnOff: '⇋ החלף על/מחוץ לעקום',
            radius: 'רדיוס',
            smoothCorners: '⌒ עגל פינות',
            fullTransform: 'טרנספורמציה מלאה',
            applyTransform: 'החל טרנספורמציה',
            layersContours: 'שכבות / קונטורים',
            resetToOrig: 'איפוס למקור',
            saveAsTitle: 'שמירה בשם',
            cancel: 'ביטול',
            fontLoaded: 'פונט נטען',
            loadFailed: 'טעינה נכשלה',
            saved: 'נשמר',
            saveFailed: 'שמירה נכשלה',
            undo: 'ביטול פעולה',
            redo: 'חזרה על פעולה',
            undoFailed: 'ביטול נכשל',
            redoFailed: 'חזרה נכשלה',
            nothingToUndo: 'אין מה לבטל',
            nothingToRedo: 'אין על מה לחזור',
            toggled: 'סוג נקודה שונה',
            toggleFailed: 'שינוי סוג נכשל',
            smoothed: 'עוגלו',
            corners: 'פינות',
            smoothFailed: 'עיגול נכשל',
            selectOnCurve: 'בחר נקודות על-עקום לעיגול',
            contourAdded: 'קונטור חדש נוסף',
            contourFailed: 'הוספת קונטור נכשלה',
            deleted: 'נמחקו',
            deleteFailed: 'מחיקה נכשלה',
            cannotDeleteAll: 'אי אפשר למחוק את כל הנקודות',
            tooFewPts: 'ישארו מעט מדי נקודות',
            layerDeleted: 'שכבה נמחקה',
            layerDelFailed: 'מחיקת שכבה נכשלה',
            cannotDelLast: 'אי אפשר למחוק קונטור אחרון',
            editFailed: 'עריכה נכשלה',
            moveFailed: 'הזזה נכשלה',
            selTransformFailed: 'טרנספורמציה נכשלה',
            penStatus: 'עט: {0} נקודות (דאבל קליק או סגור לסיום)',
            ptsSelected: '{0} נקודות נבחרו',
            movingPts: 'מזיז {0} נקודות',
            noFontErr: 'לא נטען פונט',
            deleteLayer: 'מחק שכבה',
            ptUpdate: 'עדכון נקודות נכשל',
            // New strings
            flipH: 'הפוך אופקי',
            flipV: 'הפוך אנכי',
            rotate90: 'סובב 90°',
            copy: 'העתק',
            paste: 'הדבק',
            copied: 'הועתקו {0} נקודות',
            pasted: 'הודבקו {0} נקודות',
            pasteFailed: 'הדבקה נכשלה',
            copyGlyph: 'העתק גליף',
            pasteGlyphHere: 'הדבק גליף כאן',
            glyphCopied: 'גליף הועתק',
            glyphPasted: 'גליף הודבק',
            addPointHere: 'הוסף נקודה כאן',
            pointAdded: 'נקודה נוספה',
            selectAll: 'בחר הכל',
            panCanvas: 'גרירת קנבס',
            nudge: 'הזזה (10 יח׳)',
            nudgeFine: 'הזזה עדינה (1 יח׳)',
            scaleUpDown: 'הגדלה / הקטנה',
            deselectCancel: 'ביטול בחירה / ביטול',
            shortcuts: 'קיצורי מקלדת',
            close: 'סגור',
            metaTitle: 'מטאדטה של הפונט',
            metaFamily: 'משפחה',
            metaStyle: 'סגנון',
            metaFullName: 'שם מלא',
            metaVersion: 'גרסה',
            metaPostScript: 'שם PostScript',
            metaDesigner: 'מעצב',
            metaURL: 'כתובת URL',
            metaCopyright: 'זכויות יוצרים',
            metaMetrics: 'מדדי פונט',
            metaAscender: 'Ascender',
            metaDescender: 'Descender',
            metaLineGap: 'מרווח שורה',
            metaSave: 'שמור מטאדטה',
            metaSaved: 'מטאדטה נשמר',
            metadata: '⚙ מטאדטה',
        },
        en: {
            title: 'Hebrew Font Editor',
            noFontLoaded: 'No font loaded',
            modified: 'modified',
            selectFont: '— Select font —',
            load: '📂 Load',
            upload: '📁 Upload',
            save: '💾 Save',
            saveAs: '💾 Save As',
            select: '⬚ Select',
            marquee: '▬ Marquee',
            pen: '✒ Pen',
            selectV: 'Select (V)',
            marqueeM: 'Marquee (M)',
            penP: 'Pen (P)',
            points: 'Points',
            guides: 'Guides',
            glyphs: 'Glyphs',
            searchChar: '🔍 Search character...',
            loadFontHint: 'Load a font to see glyphs',
            selectGlyphHint: 'Select a glyph from the grid<br>or load a font to begin',
            properties: 'Properties',
            selectGlyph: 'Select a glyph',
            selectGlyphProps: 'Select a glyph to edit its properties',
            previewPlaceholder: 'Type preview text...',
            loadFontPreview: 'Load a font to see preview',
            character: 'Character',
            char: 'Char',
            unicode: 'Unicode',
            name: 'Name',
            metrics: 'Metrics',
            width: 'Width',
            selection: 'Selection',
            selPoints: 'points',
            shiftX: 'Shift X',
            shiftY: 'Shift Y',
            scalePct: 'Scale %',
            applyToSel: 'Apply to Selection',
            deleteSelPts: 'Delete Selected Points',
            pointTypeSmooth: 'Point Type / Smooth',
            onCurve: 'on-curve',
            offCurve: 'off-curve',
            toggleOnOff: '⇋ Toggle On/Off Curve',
            radius: 'Radius',
            smoothCorners: '⌒ Smooth Corners',
            fullTransform: 'Full Glyph Transform',
            applyTransform: 'Apply Transform',
            layersContours: 'Layers / Contours',
            resetToOrig: 'Reset to Original',
            saveAsTitle: 'Save As',
            cancel: 'Cancel',
            fontLoaded: 'Font loaded',
            loadFailed: 'Load failed',
            saved: 'Saved',
            saveFailed: 'Save failed',
            undo: 'Undo',
            redo: 'Redo',
            undoFailed: 'Undo failed',
            redoFailed: 'Redo failed',
            nothingToUndo: 'Nothing to undo',
            nothingToRedo: 'Nothing to redo',
            toggled: 'Toggled point type',
            toggleFailed: 'Toggle failed',
            smoothed: 'Smoothed',
            corners: 'corners',
            smoothFailed: 'Smooth failed',
            selectOnCurve: 'Select on-curve (corner) points to smooth',
            contourAdded: 'New contour added',
            contourFailed: 'Add contour failed',
            deleted: 'Deleted',
            deleteFailed: 'Delete failed',
            cannotDeleteAll: 'Cannot delete all points',
            tooFewPts: 'Would leave too few points',
            layerDeleted: 'Layer deleted',
            layerDelFailed: 'Layer delete failed',
            cannotDelLast: 'Cannot delete the last contour',
            editFailed: 'Edit failed',
            moveFailed: 'Move failed',
            selTransformFailed: 'Selection transform failed',
            penStatus: 'Pen: {0} pts (dblclick or close to finish)',
            ptsSelected: '{0} pts selected',
            movingPts: 'Moving {0} pts',
            noFontErr: 'No font loaded',
            deleteLayer: 'Delete layer',
            ptUpdate: 'Point update failed',
            // New strings
            flipH: 'Flip Horizontal',
            flipV: 'Flip Vertical',
            rotate90: 'Rotate 90°',
            copy: 'Copy',
            paste: 'Paste',
            copied: 'Copied {0} points',
            pasted: 'Pasted {0} points',
            pasteFailed: 'Paste failed',
            copyGlyph: 'Copy Glyph',
            pasteGlyphHere: 'Paste Glyph Here',
            glyphCopied: 'Glyph copied',
            glyphPasted: 'Glyph pasted',
            addPointHere: 'Add Point Here',
            pointAdded: 'Point added',
            selectAll: 'Select All',
            panCanvas: 'Pan Canvas',
            nudge: 'Nudge (10 units)',
            nudgeFine: 'Fine Nudge (1 unit)',
            scaleUpDown: 'Scale Up / Down',
            deselectCancel: 'Deselect / Cancel',
            shortcuts: 'Keyboard Shortcuts',
            close: 'Close',
            metaTitle: 'Font Metadata',
            metaFamily: 'Family',
            metaStyle: 'Style',
            metaFullName: 'Full Name',
            metaVersion: 'Version',
            metaPostScript: 'PostScript Name',
            metaDesigner: 'Designer',
            metaURL: 'URL',
            metaCopyright: 'Copyright',
            metaMetrics: 'Font Metrics',
            metaAscender: 'Ascender',
            metaDescender: 'Descender',
            metaLineGap: 'Line Gap',
            metaSave: 'Save Metadata',
            metaSaved: 'Metadata saved',
            metadata: '⚙ Metadata',
        },
    },
};

function t(key, ...args) {
    let s = (LANG.strings[LANG.current] || LANG.strings.en)[key] || key;
    args.forEach((a, i) => { s = s.replace(`{${i}}`, a); });
    return s;
}

function setLang(lang) {
    LANG.current = lang;
    localStorage.setItem('fe-lang', lang);
    const isHe = lang === 'he';
    document.documentElement.lang = lang;
    document.documentElement.dir = isHe ? 'rtl' : 'ltr';
    document.title = t('title');
    applyLangToUI();
}

function applyLangToUI() {
    // Toolbar
    dom.fontNameDisp.textContent = S.font ? S.font.font_name : t('noFontLoaded');
    dom.modBadge.textContent = t('modified');
    dom.loadBtn.innerHTML = t('load');
    const uploadLabel = dom.uploadInput.closest('.upload-label');
    if (uploadLabel) {
        uploadLabel.childNodes[0].textContent = t('upload') + ' ';
    }
    dom.saveBtn.innerHTML = t('save');
    dom.saveAsBtn.innerHTML = t('saveAs');
    dom.metadataBtn.innerHTML = t('metadata');

    // Font select first option
    const firstOpt = dom.fontSelect.querySelector('option[value=""]');
    if (firstOpt) firstOpt.textContent = t('selectFont');

    // Tools
    dom.toolSelect.innerHTML = t('select');
    dom.toolMarquee.innerHTML = t('marquee');
    dom.toolPen.innerHTML = t('pen');

    // Mode labels update
    const modeLabels = { select: t('selectV'), marquee: t('marqueeM'), pen: t('penP') };
    dom.modeDisp.textContent = modeLabels[S.mode] || '';

    // Checkboxes
    const ptsLabel = dom.togglePoints.closest('.toggle-label');
    if (ptsLabel) { ptsLabel.childNodes[1].textContent = ' ' + t('points'); }
    const guideLabel = dom.toggleGuides.closest('.toggle-label');
    if (guideLabel) { guideLabel.childNodes[1].textContent = ' ' + t('guides'); }

    // Panels
    const glyphHeader = $('.glyph-panel .panel-header span');
    if (glyphHeader) glyphHeader.textContent = t('glyphs');
    dom.glyphSearch.placeholder = t('searchChar');
    const propsHeader = $('.props-panel .panel-header span');
    if (propsHeader) propsHeader.textContent = t('properties');

    // Empty hints
    const glyphEmpty = dom.glyphGrid.querySelector('.empty-hint');
    if (glyphEmpty) glyphEmpty.textContent = t('loadFontHint');
    const canvasEmpty = dom.canvasEmpty.querySelector('p');
    if (canvasEmpty) canvasEmpty.innerHTML = t('selectGlyphHint');

    // Preview
    dom.previewText.placeholder = t('previewPlaceholder');
    const previewEmpty = dom.previewRender;
    if (!S.font && previewEmpty) previewEmpty.textContent = t('loadFontPreview');

    // Language switcher active state
    $$('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === LANG.current));

    // Re-render properties if selected
    if (S.sel) renderProps();
}

/* ---------- State ---------- */
const S = {
    font: null,
    glyphs: [],
    glyphMap: {},
    sel: null,
    modified: false,
    cacheVer: 0,
    fontVer: 0,
    blobUrl: null,
    fontStyleEl: null,

    mode: MODES.SELECT,

    // Point selection
    selectedPts: new Set(),

    // Single-point drag
    dragging: false,
    dragIdx: -1,
    dragSvgStart: null,

    // Multi-point drag
    multiDrag: false,
    multiDragStart: null,
    multiDragOrigCoords: null,

    // Marquee
    marquee: false,
    marqueeStart: null,
    marqueeRect: null,

    // Pen tool
    penContour: [],
    penClickLock: false,   // prevent click firing before dblclick

    // Layers per glyph
    layers: {},
    activeLayer: 0,

    // Local editing copies
    localPoints: null,
    localFlags: null,
    localEndPts: null,

    // View
    showPoints: true,
    showGuides: true,
    zoom: 1,
    panOffset: { x: 0, y: 0 },
    panning: false,
    panStart: null,
    spaceHeld: false,

    // Arrow-key debounce
    arrowTimer: null,
    arrowAccum: { dx: 0, dy: 0 },

    // Clipboard
    clipboard: null,        // { coords, flags } for copy/paste points
    glyphClipboard: null,   // { points, advance_width } for copy/paste glyphs

    // Language
    lang: localStorage.getItem('fe-lang') || 'he',
};

/* ---------- DOM ---------- */
const $ = (q, r) => (r || document).querySelector(q);
const $$ = (q, r) => [...(r || document).querySelectorAll(q)];
const dom = {};

function cacheDom() {
    dom.fontSelect     = $('#font-select');
    dom.loadBtn        = $('#load-btn');
    dom.uploadInput    = $('#upload-input');
    dom.saveBtn        = $('#save-btn');
    dom.saveAsBtn      = $('#save-as-btn');
    dom.metadataBtn    = $('#metadata-btn');
    dom.fontNameDisp   = $('#font-name-disp');
    dom.modBadge       = $('#mod-badge');
    dom.glyphSearch    = $('#glyph-search');
    dom.glyphGrid      = $('#glyph-grid');
    dom.glyphCount     = $('#glyph-count');
    dom.svg            = $('#glyph-svg');
    dom.canvasEmpty    = $('#canvas-empty');
    dom.zoomIn         = $('#zoom-in');
    dom.zoomOut        = $('#zoom-out');
    dom.zoomFit        = $('#zoom-fit');
    dom.zoomDisp       = $('#zoom-disp');
    dom.togglePoints   = $('#tog-points');
    dom.toggleGuides   = $('#tog-guides');
    dom.infoChar       = $('#info-char');
    dom.infoName       = $('#info-name');
    dom.infoCoord      = $('#info-coord');
    dom.propsBody      = $('#props-body');
    dom.previewText    = $('#preview-text');
    dom.previewSize    = $('#preview-size');
    dom.previewSizeVal = $('#preview-size-val');
    dom.previewRender  = $('#preview-render');
    dom.toolSelect     = $('#tool-select');
    dom.toolMarquee    = $('#tool-marquee');
    dom.toolPen        = $('#tool-pen');
    dom.undoBtn        = $('#undo-btn');
    dom.redoBtn        = $('#redo-btn');
    dom.modeDisp       = $('#mode-disp');
    dom.langBtns       = $$('.lang-btn');
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', async () => {
    cacheDom();
    wireEvents();
    setLang(LANG.current);
    setMode(MODES.SELECT);
    await fetchFontList();
});

function wireEvents() {
    dom.loadBtn.addEventListener('click', loadFromSelect);
    dom.uploadInput.addEventListener('change', loadFromUpload);
    dom.saveBtn.addEventListener('click', () => saveFont(false));
    dom.saveAsBtn.addEventListener('click', () => saveFont(true));
    dom.metadataBtn.addEventListener('click', showMetadataEditor);
    dom.glyphSearch.addEventListener('input', () => renderGrid(dom.glyphSearch.value));
    dom.zoomIn.addEventListener('click', () => applyZoom(S.zoom * 1.25));
    dom.zoomOut.addEventListener('click', () => applyZoom(S.zoom / 1.25));
    dom.zoomFit.addEventListener('click', () => { S.panOffset = { x: 0, y: 0 }; applyZoom(1); });
    dom.togglePoints.addEventListener('change', e => { S.showPoints = e.target.checked; redrawEditor(); });
    dom.toggleGuides.addEventListener('change', e => { S.showGuides = e.target.checked; redrawEditor(); });
    dom.previewText.addEventListener('input', renderPreviewText);
    dom.previewSize.addEventListener('input', () => {
        dom.previewSizeVal.textContent = dom.previewSize.value + 'px';
        dom.previewRender.style.fontSize = dom.previewSize.value + 'px';
    });

    dom.toolSelect.addEventListener('click', () => setMode(MODES.SELECT));
    dom.toolMarquee.addEventListener('click', () => setMode(MODES.MARQUEE));
    dom.toolPen.addEventListener('click', () => setMode(MODES.PEN));

    dom.undoBtn.addEventListener('click', () => doUndo());
    dom.redoBtn.addEventListener('click', () => doRedo());

    $$('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });

    dom.svg.addEventListener('mousedown', onSvgDown);
    window.addEventListener('mousemove', onSvgMove);
    window.addEventListener('mouseup', onSvgUp);
    dom.svg.addEventListener('wheel', onSvgWheel, { passive: false });
    dom.svg.addEventListener('dblclick', onSvgDblClick);
    dom.svg.addEventListener('click', onSvgClick);
    dom.svg.addEventListener('mousemove', onSvgHover);
    dom.svg.addEventListener('contextmenu', onContextMenu);

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);

    window.addEventListener('beforeunload', e => {
        if (S.modified) { e.preventDefault(); e.returnValue = ''; }
    });
}

/* ---------- Mode ---------- */
function setMode(mode) {
    S.mode = mode;
    $$('.tool-btn').forEach(b => b.classList.remove('active'));
    if (mode === MODES.SELECT)  dom.toolSelect.classList.add('active');
    if (mode === MODES.MARQUEE) dom.toolMarquee.classList.add('active');
    if (mode === MODES.PEN)     dom.toolPen.classList.add('active');
    const labels = { select: t('selectV'), marquee: t('marqueeM'), pen: t('penP') };
    dom.modeDisp.textContent = labels[mode] || '';
    if (mode !== MODES.PEN && S.penContour.length > 0) {
        S.penContour = [];
        redrawEditor();
    }
    dom.svg.style.cursor = mode === MODES.PEN ? 'crosshair'
        : mode === MODES.MARQUEE ? 'crosshair' : 'default';
}

/* ---------- Font List ---------- */
async function fetchFontList() {
    try {
        const r = await api('/api/list-fonts');
        dom.fontSelect.innerHTML = `<option value="">${t('selectFont')}</option>`;
        for (const f of r.fonts) {
            const o = document.createElement('option');
            o.value = f; o.textContent = f;
            dom.fontSelect.appendChild(o);
        }
    } catch (e) { console.warn('Could not fetch font list', e); }
}

/* ---------- Load Font ---------- */
async function loadFromSelect() {
    const name = dom.fontSelect.value;
    if (!name) return;
    await loadFont({ filename: name });
}

async function loadFromUpload() {
    const file = dom.uploadInput.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    await loadFont(fd, true);
}

async function loadFont(body, isForm) {
    try {
        const opts = isForm
            ? { method: 'POST', body }
            : { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) };
        const res = await fetch('/api/load-font', opts);
        const data = await res.json();
        if (data.error) { toast(data.error, 'error'); return; }

        S.font = data;
        S.glyphs = data.glyphs;
        S.glyphMap = {};
        S.glyphs.forEach(g => S.glyphMap[g.name] = g);
        S.sel = null;
        S.modified = false;
        S.cacheVer = data.cache_version || 0;
        S.selectedPts.clear();
        S.penContour = [];
        S.layers = {};

        for (const g of S.glyphs) {
            if (g.points) S.layers[g.name] = buildLayersFromPoints(g.points);
        }

        dom.fontNameDisp.textContent = data.font_name;
        dom.modBadge.style.display = 'none';
        dom.glyphCount.textContent = S.glyphs.length;

        renderGrid('');
        dom.glyphSearch.value = '';
        clearEditor();
        renderProps();
        await refreshFontFace();
        renderPreviewText();
        toast(t('fontLoaded') + ' (' + S.glyphs.length + ' ' + t('glyphs').toLowerCase() + ')', 'ok');
    } catch (e) {
        toast(t('loadFailed') + ': ' + e.message, 'error');
    }
}

/* ---------- Layers ---------- */
function buildLayersFromPoints(pts) {
    const layers = [];
    let start = 0;
    for (let ci = 0; ci < pts.endPts.length; ci++) {
        const end = pts.endPts[ci];
        layers.push({
            name: `Contour ${ci + 1}`,
            coords: pts.coords.slice(start, end + 1).map(p => [...p]),
            flags: pts.flags.slice(start, end + 1),
            visible: true,
        });
        start = end + 1;
    }
    return layers;
}

function allLayersPoints(glyphName) {
    const layers = S.layers[glyphName] || [];
    const coords = [], flags = [], endPts = [];
    let idx = 0;
    for (const L of layers) {
        for (let i = 0; i < L.coords.length; i++) {
            coords.push([...L.coords[i]]);
            flags.push(L.flags[i]);
        }
        idx += L.coords.length;
        if (idx > 0) endPts.push(idx - 1);
    }
    return { coords, flags, endPts };
}

function layerColor(idx) {
    const colors = [
        'rgb(124,124,240)', 'rgb(240,160,80)', 'rgb(100,220,140)',
        'rgb(240,100,100)', 'rgb(200,140,240)', 'rgb(100,200,240)',
        'rgb(240,220,100)', 'rgb(240,130,200)',
    ];
    return colors[idx % colors.length];
}

/* ---------- Glyph Grid ---------- */
function renderGrid(filter) {
    dom.glyphGrid.innerHTML = '';
    if (!S.font) return;
    const q = (filter || '').trim().toLowerCase();
    const asc = S.font.ascender, desc = S.font.descender, upm = S.font.units_per_em;

    for (const g of S.glyphs) {
        if (q && !g.char.includes(q) && !g.name.toLowerCase().includes(q)) continue;
        const cell = document.createElement('div');
        cell.className = 'grid-cell' + (g.name === S.sel ? ' active' : '');
        cell.dataset.name = g.name;
        cell.title = g.char ? g.char + ' — ' + g.name : g.name;

        const aw = g.advance_width || upm;
        const svgEl = document.createElementNS(NS, 'svg');
        svgEl.setAttribute('viewBox', `0 ${-asc} ${aw} ${asc - desc}`);
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        if (g.svg_path) {
            const p = document.createElementNS(NS, 'path');
            p.setAttribute('d', g.svg_path);
            p.setAttribute('fill', '#b0b0d0');
            const gr = document.createElementNS(NS, 'g');
            gr.setAttribute('transform', 'scale(1,-1)');
            gr.appendChild(p);
            svgEl.appendChild(gr);
        }
        cell.appendChild(svgEl);

        const lbl = document.createElement('span');
        lbl.className = 'grid-label';
        lbl.textContent = g.char || g.name;
        cell.appendChild(lbl);

        cell.addEventListener('click', () => selectGlyph(g.name));
        dom.glyphGrid.appendChild(cell);
    }
}

/* ---------- Select Glyph ---------- */
function selectGlyph(name) {
    S.sel = name;
    S.selectedPts.clear();
    S.penContour = [];
    S.activeLayer = 0;
    S.panOffset = { x: 0, y: 0 };
    $$('.grid-cell', dom.glyphGrid).forEach(c =>
        c.classList.toggle('active', c.dataset.name === name));
    redrawEditor();
    renderProps();
}

/* ---------- SVG Editor ---------- */
function clearEditor() {
    dom.svg.innerHTML = '';
    dom.canvasEmpty.style.display = 'flex';
    dom.infoChar.textContent = '—';
    dom.infoName.textContent = '';
    dom.infoCoord.textContent = '';
    S.localPoints = null;
    S.selectedPts.clear();
}

function redrawEditor() {
    if (!S.sel || !S.glyphMap[S.sel]) { clearEditor(); return; }
    const g = S.glyphMap[S.sel];
    const f = S.font;
    dom.canvasEmpty.style.display = 'none';

    const asc = f.ascender, desc = f.descender;
    const aw = g.advance_width || f.units_per_em;
    const pad = Math.round(f.units_per_em * 0.15);
    const vbX = -pad, vbY = -asc - pad;
    const vbW = aw + pad * 2, vbH = (asc - desc) + pad * 2;

    dom.svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
    dom.svg.innerHTML = '';

    if (S.showGuides) drawGuides(g, aw, asc, desc, vbX, vbW);

    // Draw layers / paths
    const layers = S.layers[S.sel] || [];
    const pathG = createSvg('g', { transform: 'scale(1,-1)' });

    if (layers.length > 0) {
        for (let li = 0; li < layers.length; li++) {
            const L = layers[li];
            if (!L.visible) continue;
            const lEndPts = [L.coords.length - 1];
            const pathD = buildPathFromPoints(L.coords, L.flags, lEndPts);
            if (pathD) {
                const opacity = li === S.activeLayer ? 1 : 0.4;
                const color = layerColor(li);
                pathG.appendChild(createSvg('path', {
                    d: pathD,
                    fill: color.replace('rgb', 'rgba').replace(')', ',0.15)'),
                    stroke: color,
                    'stroke-width': Math.max(1, f.units_per_em / 500),
                    'fill-rule': 'nonzero',
                    opacity,
                }));
            }
        }
    } else if (g.svg_path) {
        pathG.appendChild(createSvg('path', {
            d: g.svg_path,
            fill: 'rgba(124,124,240,0.15)',
            stroke: 'rgba(124,124,240,0.6)',
            'stroke-width': Math.max(1, f.units_per_em / 500),
            'fill-rule': 'nonzero',
        }));
    }
    dom.svg.appendChild(pathG);

    if (S.showPoints && g.points) drawPoints(g);
    if (S.mode === MODES.PEN && S.penContour.length > 0) drawPenPreview();

    dom.infoChar.textContent = g.char || '?';
    dom.infoName.textContent = g.name + (g.is_composite ? ' (composite)' : '');
    if (S.selectedPts.size > 0) {
        dom.infoCoord.textContent = t('ptsSelected', S.selectedPts.size);
    }

    // Apply zoom + pan via viewBox
    reapplyViewBox();
}

function drawGuides(g, aw, asc, desc, vbX, vbW) {
    const guides = createSvg('g', { class: 'guides' });
    const x1 = vbX, x2 = vbX + vbW;
    const sw = Math.max(0.5, (aw + 100) / 800);

    const addLine = (y, color, label) => {
        guides.appendChild(createSvg('line', {
            x1, x2, y1: y, y2: y,
            stroke: color, 'stroke-width': sw, class: 'guide-line',
        }));
        const tx = createSvg('text', {
            x: x1 + 3, y: y - 3, fill: color, class: 'guide-label',
            'font-size': Math.max(9, aw / 30),
        });
        tx.textContent = label;
        guides.appendChild(tx);
    };

    addLine(0, 'var(--baseline)', 'baseline');
    addLine(-asc, 'var(--ascender)', 'ascender');
    addLine(-desc, 'var(--descender)', 'descender');

    guides.appendChild(createSvg('line', {
        x1: aw, x2: aw, y1: -asc - 10, y2: -desc + 10,
        stroke: 'var(--advance)', 'stroke-width': sw,
        class: 'guide-line', 'stroke-dasharray': `${sw*4} ${sw*3}`,
    }));
    guides.appendChild(createSvg('line', {
        x1: 0, x2: 0, y1: -asc - 10, y2: -desc + 10,
        stroke: 'var(--advance)', 'stroke-width': sw * 0.5,
        class: 'guide-line', opacity: 0.3,
    }));
    dom.svg.appendChild(guides);
}

function drawPoints(g) {
    if (!g.points) return;
    const pts = S.localPoints || g.points.coords;
    const flags = S.localFlags || g.points.flags;
    const endPts = S.localEndPts || g.points.endPts;
    const r = Math.max(3, S.font.units_per_em / 200);
    const ptGroup = createSvg('g', { transform: 'scale(1,-1)', class: 'point-layer' });

    // Connecting lines
    let start = 0;
    for (const end of endPts) {
        for (let i = start; i <= end; i++) {
            const next = i === end ? start : i + 1;
            ptGroup.appendChild(createSvg('line', {
                x1: pts[i][0], y1: pts[i][1],
                x2: pts[next][0], y2: pts[next][1],
                stroke: 'rgba(255,255,255,0.15)',
                'stroke-width': r * 0.3,
            }));
        }
        start = end + 1;
    }

    // Points
    for (let i = 0; i < pts.length; i++) {
        const on = flags[i] === 1;
        const selected = S.selectedPts.has(i);
        const fillColor = selected ? 'var(--pt-selected)' : (on ? 'var(--on-curve)' : 'var(--off-curve)');
        const ptR = selected ? r * 1.4 : r;

        const c = createSvg(on ? 'circle' : 'rect', {});
        if (on) {
            c.setAttribute('cx', pts[i][0]);
            c.setAttribute('cy', pts[i][1]);
            c.setAttribute('r', ptR);
        } else {
            c.setAttribute('x', pts[i][0] - ptR);
            c.setAttribute('y', pts[i][1] - ptR);
            c.setAttribute('width', ptR * 2);
            c.setAttribute('height', ptR * 2);
        }
        c.setAttribute('fill', fillColor);
        c.setAttribute('stroke', '#000');
        c.setAttribute('stroke-width', r * 0.3);
        c.setAttribute('data-idx', i);
        c.classList.add('ctrl-point');
        if (selected) c.classList.add('selected');
        ptGroup.appendChild(c);
    }
    dom.svg.appendChild(ptGroup);
}

/* ---------- Pen Preview ---------- */
function drawPenPreview() {
    if (S.penContour.length === 0) return;
    const r = Math.max(3, S.font.units_per_em / 200);
    const penG = createSvg('g', { transform: 'scale(1,-1)', class: 'pen-preview' });

    for (let i = 0; i < S.penContour.length - 1; i++) {
        const a = S.penContour[i], b = S.penContour[i+1];
        penG.appendChild(createSvg('line', {
            x1: a.x, y1: a.y, x2: b.x, y2: b.y,
            stroke: 'var(--success)', 'stroke-width': r * 0.4,
            'stroke-dasharray': `${r} ${r*0.5}`,
        }));
    }

    if (S.penContour.length >= 3) {
        const first = S.penContour[0], last = S.penContour[S.penContour.length - 1];
        penG.appendChild(createSvg('line', {
            x1: last.x, y1: last.y, x2: first.x, y2: first.y,
            stroke: 'var(--success)', 'stroke-width': r * 0.2,
            'stroke-dasharray': `${r*0.5} ${r*0.5}`, opacity: 0.4,
        }));
    }

    for (let i = 0; i < S.penContour.length; i++) {
        const p = S.penContour[i];
        const isFirst = i === 0;
        const c = createSvg(p.on ? 'circle' : 'rect', {});
        const pr = isFirst ? r * 1.6 : r;
        if (p.on) {
            c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', pr);
        } else {
            c.setAttribute('x', p.x - pr); c.setAttribute('y', p.y - pr);
            c.setAttribute('width', pr * 2); c.setAttribute('height', pr * 2);
        }
        c.setAttribute('fill', isFirst ? 'var(--success)' : (p.on ? '#fff' : 'var(--off-curve)'));
        c.setAttribute('stroke', isFirst ? '#fff' : '#000');
        c.setAttribute('stroke-width', r * 0.3);
        c.classList.add('pen-point');
        c.dataset.penIdx = i;
        penG.appendChild(c);
    }
    dom.svg.appendChild(penG);
}

/* ==================== Mouse Handling ==================== */

function onSvgHover(e) {
    if (S.dragging || S.multiDrag || S.panning) return;
    const pt = e.target.closest('.ctrl-point');
    if (pt && S.glyphMap[S.sel]) {
        const idx = parseInt(pt.dataset.idx);
        const g = S.glyphMap[S.sel];
        const coords = S.localPoints || g.points.coords;
        const flags = S.localFlags || g.points.flags;
        if (idx < coords.length) {
            const type = flags[idx] === 1 ? t('onCurve') : t('offCurve');
            dom.infoCoord.textContent = `pt${idx} (${coords[idx][0]}, ${coords[idx][1]}) [${type}]`;
        }
    }
}

function onSvgDown(e) {
    // Middle-mouse or Space+click to pan
    if (e.button === 1 || (e.button === 0 && S.spaceHeld)) {
        e.preventDefault();
        S.panning = true;
        S.panStart = { x: e.clientX, y: e.clientY, ox: S.panOffset.x, oy: S.panOffset.y };
        dom.svg.style.cursor = 'grabbing';
        return;
    }

    if (S.mode === MODES.PEN) return;

    const sv = svgCoords(e);
    if (!sv || !S.sel) return;
    const pt = e.target.closest('.ctrl-point');
    const g = S.glyphMap[S.sel];

    if (S.mode === MODES.SELECT) {
        if (pt && g.points) {
            e.preventDefault();
            const idx = parseInt(pt.dataset.idx);

            // Ctrl/Meta toggle
            if (e.ctrlKey || e.metaKey) {
                if (S.selectedPts.has(idx)) S.selectedPts.delete(idx);
                else S.selectedPts.add(idx);
                redrawEditor();
                renderProps();
                return;
            }

            // Shift add
            if (e.shiftKey) {
                S.selectedPts.add(idx);
                redrawEditor();
                renderProps();
            }

            // Multi-drag if clicking an already-selected point with >1 selected
            if (S.selectedPts.has(idx) && S.selectedPts.size > 1) {
                startMultiDrag(sv, g);
                return;
            }

            // Single select + drag
            if (!S.selectedPts.has(idx) && !e.shiftKey) {
                S.selectedPts.clear();
                S.selectedPts.add(idx);
                redrawEditor();
                renderProps();
            }

            S.dragging = true;
            S.dragIdx = idx;
            S.dragSvgStart = sv;
            S.localPoints = g.points.coords.map(p => [...p]);
            S.localFlags = [...g.points.flags];
            S.localEndPts = [...g.points.endPts];
            pt.classList.add('dragging');
        } else {
            if (!e.ctrlKey && !e.shiftKey) {
                S.selectedPts.clear();
                redrawEditor();
                renderProps();
            }
        }
    }

    if (S.mode === MODES.MARQUEE) {
        e.preventDefault();
        S.marquee = true;
        S.marqueeStart = sv;
        S.marqueeRect = createSvg('rect', {
            x: sv.x, y: sv.y, width: 0, height: 0,
            fill: 'rgba(80,240,160,0.1)',
            stroke: 'var(--pt-selected)',
            'stroke-width': Math.max(1, S.font.units_per_em / 600),
            'stroke-dasharray': '5 3',
            class: 'marquee-rect',
        });
        dom.svg.appendChild(S.marqueeRect);
    }
}

function onSvgMove(e) {
    // Panning
    if (S.panning && S.panStart) {
        e.preventDefault();
        // Convert pixel delta to SVG units
        const rect = dom.svg.getBoundingClientRect();
        const vb = dom.svg.viewBox.baseVal;
        const scaleX = vb.width / rect.width;
        const scaleY = vb.height / rect.height;
        S.panOffset.x = S.panStart.ox - (e.clientX - S.panStart.x) * scaleX;
        S.panOffset.y = S.panStart.oy - (e.clientY - S.panStart.y) * scaleY;
        reapplyViewBox();
        return;
    }

    // Single drag
    if (S.dragging && S.mode === MODES.SELECT) {
        e.preventDefault();
        const sv = svgCoords(e);
        if (!sv) return;

        // Upgrade to multi-drag if needed
        if (S.selectedPts.size > 1 && S.selectedPts.has(S.dragIdx)) {
            S.dragging = false;
            startMultiDrag(S.dragSvgStart, S.glyphMap[S.sel]);
            onSvgMove(e);
            return;
        }

        S.localPoints[S.dragIdx] = [Math.round(sv.x), Math.round(-sv.y)];
        updateLocalVisuals();
        const p = S.localPoints[S.dragIdx];
        dom.infoCoord.textContent = `pt${S.dragIdx}: (${p[0]}, ${p[1]})`;
        return;
    }

    // Multi drag
    if (S.multiDrag) {
        e.preventDefault();
        const sv = svgCoords(e);
        if (!sv) return;
        const dx = sv.x - S.multiDragStart.x;
        const dy = -(sv.y - S.multiDragStart.y);

        for (const idx of S.selectedPts) {
            const orig = S.multiDragOrigCoords[idx];
            S.localPoints[idx] = [Math.round(orig[0] + dx), Math.round(orig[1] + dy)];
        }
        updateLocalVisuals();
        dom.infoCoord.textContent = `${t('movingPts', S.selectedPts.size)}  Δ(${Math.round(dx)}, ${Math.round(dy)})`;
        return;
    }

    // Marquee
    if (S.marquee && S.marqueeRect) {
        e.preventDefault();
        const sv = svgCoords(e);
        if (!sv) return;
        const x = Math.min(sv.x, S.marqueeStart.x);
        const y = Math.min(sv.y, S.marqueeStart.y);
        const w = Math.abs(sv.x - S.marqueeStart.x);
        const h = Math.abs(sv.y - S.marqueeStart.y);
        S.marqueeRect.setAttribute('x', x);
        S.marqueeRect.setAttribute('y', y);
        S.marqueeRect.setAttribute('width', w);
        S.marqueeRect.setAttribute('height', h);
    }
}

async function onSvgUp(e) {
    if (S.panning) {
        S.panning = false;
        S.panStart = null;
        dom.svg.style.cursor = S.mode === MODES.PEN || S.mode === MODES.MARQUEE ? 'crosshair' : 'default';
        return;
    }

    if (S.dragging) {
        S.dragging = false;
        $$('.ctrl-point.dragging', dom.svg).forEach(c => c.classList.remove('dragging'));
        if (S.localPoints && S.sel) await commitPoints();
        return;
    }

    if (S.multiDrag) {
        S.multiDrag = false;
        S.multiDragOrigCoords = null;
        if (S.localPoints && S.sel) await commitPoints();
        return;
    }

    if (S.marquee && S.marqueeRect) {
        S.marquee = false;
        const g = S.glyphMap[S.sel];
        if (g && g.points) {
            const rx = parseFloat(S.marqueeRect.getAttribute('x'));
            const ry = parseFloat(S.marqueeRect.getAttribute('y'));
            const rw = parseFloat(S.marqueeRect.getAttribute('width'));
            const rh = parseFloat(S.marqueeRect.getAttribute('height'));

            if (!e.ctrlKey && !e.shiftKey) S.selectedPts.clear();

            for (let i = 0; i < g.points.coords.length; i++) {
                const [px, py] = g.points.coords[i];
                const svgY = -py;
                if (px >= rx && px <= rx + rw && svgY >= ry && svgY <= ry + rh) {
                    S.selectedPts.add(i);
                }
            }
            dom.infoCoord.textContent = `${S.selectedPts.size} pts selected`;
        }
        S.marqueeRect.remove();
        S.marqueeRect = null;
        redrawEditor();
        renderProps();
    }
}

/* --- Pen --- */
function onSvgClick(e) {
    if (S.mode !== MODES.PEN || !S.sel) return;
    if (S.penClickLock) return;   // ignore click fired before dblclick
    const sv = svgCoords(e);
    if (!sv) return;

    const fontX = Math.round(sv.x);
    const fontY = Math.round(-sv.y);

    // Close contour if clicking near first point
    if (S.penContour.length >= 3) {
        const first = S.penContour[0];
        const threshold = S.font.units_per_em / 30;
        if (Math.abs(fontX - first.x) < threshold && Math.abs(fontY - first.y) < threshold) {
            finalizePenContour();
            return;
        }
    }

    // Alt = off-curve control point
    S.penContour.push({ x: fontX, y: fontY, on: !e.altKey });
    redrawEditor();
    dom.infoCoord.textContent = t('penStatus', S.penContour.length);
}

function onSvgDblClick(e) {
    if (S.mode !== MODES.PEN) return;
    // Remove the extra point the first click of the dbl-click added
    if (S.penContour.length > 3) S.penContour.pop();
    S.penClickLock = true;
    setTimeout(() => { S.penClickLock = false; }, 300);
    if (S.penContour.length >= 3) finalizePenContour();
}

async function finalizePenContour() {
    if (S.penContour.length < 3 || !S.sel) return;

    const coords = S.penContour.map(p => [p.x, p.y]);
    const flags = S.penContour.map(p => p.on ? 1 : 0);
    const name = S.sel;

    if (!S.layers[name]) S.layers[name] = [];
    S.layers[name].push({
        name: `Layer ${S.layers[name].length + 1}`,
        coords: coords.map(c => [...c]),
        flags: [...flags],
        visible: true,
    });
    S.activeLayer = S.layers[name].length - 1;

    try {
        const r = await api('/api/glyph/add-contour', {
            glyph_name: name, coords, flags,
        });
        if (r.glyph) {
            Object.assign(S.glyphMap[name], r.glyph);
            S.cacheVer = r.cache_version || S.cacheVer;
            markModified();
            updateGridCell(name);
            await refreshFontFace();
            renderPreviewText();
        }
    } catch (err) {
        toast(t('contourFailed') + ': ' + err.message, 'error');
    }

    S.penContour = [];
    redrawEditor();
    renderProps();
    toast(`${t('contourAdded')} (${coords.length} ${t('selPoints')})`, 'ok');
}

/* --- Multi-drag --- */
function startMultiDrag(svgStart, g) {
    if (!g || !g.points) return;
    S.multiDrag = true;
    S.multiDragStart = svgStart;
    S.localPoints = g.points.coords.map(p => [...p]);
    S.localFlags = [...g.points.flags];
    S.localEndPts = [...g.points.endPts];
    S.multiDragOrigCoords = g.points.coords.map(p => [...p]);
}

function updateLocalVisuals() {
    // Rebuild layer paths from local points
    const layers = S.layers[S.sel] || [];
    const pathEls = dom.svg.querySelectorAll('g[transform="scale(1,-1)"] path');

    if (layers.length > 0 && pathEls.length === layers.length) {
        // Per-layer update
        let start = 0;
        for (let li = 0; li < layers.length; li++) {
            const L = layers[li];
            const len = L.coords.length;
            const layerCoords = S.localPoints.slice(start, start + len);
            const layerFlags = S.localFlags.slice(start, start + len);
            const layerEndPts = [len - 1];
            const pathD = buildPathFromPoints(layerCoords, layerFlags, layerEndPts);
            if (pathEls[li]) pathEls[li].setAttribute('d', pathD);
            start += len;
        }
    } else if (pathEls.length >= 1) {
        const localPath = buildPathFromPoints(S.localPoints, S.localFlags, S.localEndPts);
        pathEls[0].setAttribute('d', localPath);
    }

    const oldPtLayer = dom.svg.querySelector('.point-layer');
    if (oldPtLayer) oldPtLayer.remove();
    drawPoints(S.glyphMap[S.sel]);
}

async function commitPoints() {
    try {
        const r = await api('/api/glyph/set-points', {
            glyph_name: S.sel, coords: S.localPoints,
        });
        if (r.glyph) {
            Object.assign(S.glyphMap[S.sel], r.glyph);
            if (r.glyph.points) S.layers[S.sel] = buildLayersFromPoints(r.glyph.points);
            S.cacheVer = r.cache_version || S.cacheVer;
            markModified();
            redrawEditor();
            updateGridCell(S.sel);
            await refreshFontFace();
            renderPreviewText();
        }
    } catch (err) { toast(t('ptUpdate'), 'error'); }
    S.localPoints = null;
    S.localFlags = null;
    S.localEndPts = null;
    S.multiDragOrigCoords = null;
}

/* ---------- Zoom ---------- */
function onSvgWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    applyZoom(S.zoom * factor, e);
}

function applyZoom(z, evt) {
    z = Math.max(0.2, Math.min(10, z));
    S.zoom = z;
    dom.zoomDisp.textContent = Math.round(S.zoom * 100) + '%';
    reapplyViewBox();
}

function reapplyViewBox() {
    if (!S.sel || !S.glyphMap[S.sel]) return;
    const g = S.glyphMap[S.sel];
    const f = S.font;
    const asc = f.ascender, desc = f.descender;
    const aw = g.advance_width || f.units_per_em;
    const pad = Math.round(f.units_per_em * 0.15);

    const baseW = aw + pad * 2;
    const baseH = (asc - desc) + pad * 2;
    const w = baseW / S.zoom;
    const h = baseH / S.zoom;
    const cx = -pad + baseW / 2 + S.panOffset.x;
    const cy = -asc - pad + baseH / 2 + S.panOffset.y;
    const vbX = cx - w / 2;
    const vbY = cy - h / 2;

    dom.svg.setAttribute('viewBox', `${vbX} ${vbY} ${w} ${h}`);
    dom.svg.style.transform = '';
    dom.svg.style.transformOrigin = '';
}

/* ---------- Properties Panel ---------- */
function renderProps() {
    if (!S.sel || !S.glyphMap[S.sel]) {
        dom.propsBody.innerHTML = `<p class="empty-hint">${t('selectGlyphProps')}</p>`;
        return;
    }
    const g = S.glyphMap[S.sel];
    let html = `
        <div class="prop-section">
            <div class="prop-section-title">${t('character')}</div>
            <div class="prop-row"><label>${t('char')}</label><span style="font-size:1.5em;font-weight:700">${g.char || '—'}</span></div>
            <div class="prop-row"><label>${t('unicode')}</label><span>U+${(g.unicode||0).toString(16).toUpperCase().padStart(4,'0')}</span></div>
            <div class="prop-row"><label>${t('name')}</label><span style="font-size:0.85em">${g.name}</span></div>
        </div>
        <div class="prop-section">
            <div class="prop-section-title">${t('metrics')}</div>
            <div class="prop-row">
                <label>${t('width')}</label>
                <input type="number" id="prop-aw" value="${g.advance_width}" step="10">
            </div>
        </div>`;

    // Selection transform
    if (S.selectedPts.size > 0) {
        const g2 = g;
        const onCount = [...S.selectedPts].filter(i => g2.points && g2.points.flags[i] === 1).length;
        const offCount = S.selectedPts.size - onCount;

        html += `
        <div class="prop-section selection-section">
            <div class="prop-section-title">${t('selection')} (${S.selectedPts.size} ${t('selPoints')})</div>
            <div class="prop-row"><label>${t('shiftX')}</label><input type="number" id="sel-sx" value="0" step="10"></div>
            <div class="prop-row"><label>${t('shiftY')}</label><input type="number" id="sel-sy" value="0" step="10"></div>
            <div class="prop-row"><label>${t('scalePct')}</label><input type="number" id="sel-sc" value="100" step="5" min="10" max="500"></div>
            <button class="prop-btn primary" id="btn-sel-apply">${t('applyToSel')}</button>
            <button class="prop-btn" id="btn-sel-delete">${t('deleteSelPts')}</button>
            <div class="prop-section-title" style="margin-top:8px;">${t('pointTypeSmooth')}</div>
            <div class="prop-row info-row"><span class="dim">${onCount} ${t('onCurve')} · ${offCount} ${t('offCurve')}</span></div>
            <button class="prop-btn" id="btn-toggle-type" title="${t('toggleOnOff')}">${t('toggleOnOff')}</button>`;

        if (onCount > 0) {
            html += `
            <div class="prop-row"><label>${t('radius')}</label>
                <input type="range" id="smooth-radius" min="0.05" max="0.5" step="0.05" value="0.35" style="flex:1">
                <span id="smooth-radius-val" style="width:36px;text-align:right">0.35</span>
            </div>
            <button class="prop-btn accent" id="btn-smooth" title="${t('smoothCorners')}">${t('smoothCorners')}</button>`;
        }

        html += `</div>`;
    }

    html += `
        <div class="prop-section">
            <div class="prop-section-title">${t('fullTransform')}</div>
            <div class="prop-row"><label>${t('shiftX')}</label><input type="number" id="prop-sx" value="0" step="10"></div>
            <div class="prop-row"><label>${t('shiftY')}</label><input type="number" id="prop-sy" value="0" step="10"></div>
            <div class="prop-row"><label>${t('scalePct')}</label><input type="number" id="prop-sc" value="100" step="5" min="10" max="500"></div>
            <button class="prop-btn primary" id="btn-apply">${t('applyTransform')}</button>
        </div>`;

    // Layers
    const layers = S.layers[S.sel] || [];
    if (layers.length > 0 || S.mode === MODES.PEN) {
        html += `<div class="prop-section">
            <div class="prop-section-title">${t('layersContours')}</div>
            <div id="layer-list" class="layer-list">`;
        for (let i = 0; i < layers.length; i++) {
            const L = layers[i];
            html += `<div class="layer-item${i === S.activeLayer ? ' active' : ''}" data-li="${i}">
                <input type="checkbox" class="layer-vis" data-li="${i}" ${L.visible ? 'checked' : ''}>
                <span class="layer-color" style="background:${layerColor(i)}"></span>
                <span class="layer-name">${L.name}</span>
                <span class="layer-pts">${L.coords.length}pts</span>
                <button class="layer-del" data-li="${i}" title="${t('deleteLayer')}">✕</button>
            </div>`;
        }
        html += `</div></div>`;
    }

    html += `
        <div class="prop-section">
            <button class="prop-btn danger" id="btn-reset">${t('resetToOrig')}</button>
        </div>`;

    dom.propsBody.innerHTML = html;
    wirePropsEvents(g);
}

function wirePropsEvents(g) {
    $('#prop-aw').addEventListener('change', async () => {
        const v = parseInt($('#prop-aw').value);
        if (isNaN(v) || v < 0) return;
        await apiEditGlyph('/api/glyph/set-width', { glyph_name: S.sel, advance_width: v });
    });

    $('#btn-apply').addEventListener('click', async () => {
        const sx = parseInt($('#prop-sx').value) || 0;
        const sy = parseInt($('#prop-sy').value) || 0;
        const sc = (parseInt($('#prop-sc').value) || 100) / 100;
        if (sx === 0 && sy === 0 && sc === 1) return;
        await apiEditGlyph('/api/glyph/transform', {
            glyph_name: S.sel, shift_x: sx, shift_y: sy, scale: sc,
        });
        $('#prop-sx').value = 0; $('#prop-sy').value = 0; $('#prop-sc').value = 100;
    });

    $('#btn-reset').addEventListener('click', async () => {
        await apiEditGlyph('/api/glyph/reset', { glyph_name: S.sel });
        if (S.glyphMap[S.sel].points) S.layers[S.sel] = buildLayersFromPoints(S.glyphMap[S.sel].points);
        S.selectedPts.clear();
        redrawEditor();
    });

    if ($('#btn-sel-apply')) {
        $('#btn-sel-apply').addEventListener('click', () => applySelectionTransform());
        $('#btn-sel-delete').addEventListener('click', () => deleteSelectedPoints());
        $('#btn-toggle-type').addEventListener('click', () => togglePointType());
        if ($('#btn-smooth')) {
            $('#btn-smooth').addEventListener('click', () => smoothSelectedCorners());
        }
        if ($('#smooth-radius')) {
            $('#smooth-radius').addEventListener('input', e => {
                $('#smooth-radius-val').textContent = parseFloat(e.target.value).toFixed(2);
            });
        }
    }

    $$('.layer-vis').forEach(cb => {
        cb.addEventListener('change', e => {
            S.layers[S.sel][parseInt(e.target.dataset.li)].visible = e.target.checked;
            redrawEditor();
        });
    });

    $$('.layer-item').forEach(el => {
        el.addEventListener('click', e => {
            if (e.target.classList.contains('layer-vis') || e.target.classList.contains('layer-del')) return;
            S.activeLayer = parseInt(el.dataset.li);
            renderProps();
            redrawEditor();
        });
    });

    $$('.layer-del').forEach(btn => {
        btn.addEventListener('click', () => deleteLayer(parseInt(btn.dataset.li)));
    });
}

/* ---------- Selection Transform ---------- */
async function applySelectionTransform() {
    const g = S.glyphMap[S.sel];
    if (!g || !g.points || S.selectedPts.size === 0) return;

    const sx = parseInt($('#sel-sx').value) || 0;
    const sy = parseInt($('#sel-sy').value) || 0;
    const sc = (parseInt($('#sel-sc').value) || 100) / 100;
    const coords = g.points.coords.map(p => [...p]);

    if (sc !== 1) {
        let cxSum = 0, cySum = 0;
        for (const idx of S.selectedPts) { cxSum += coords[idx][0]; cySum += coords[idx][1]; }
        const cx = cxSum / S.selectedPts.size, cy = cySum / S.selectedPts.size;
        for (const idx of S.selectedPts) {
            coords[idx][0] = Math.round((coords[idx][0] - cx) * sc + cx + sx);
            coords[idx][1] = Math.round((coords[idx][1] - cy) * sc + cy + sy);
        }
    } else if (sx || sy) {
        for (const idx of S.selectedPts) {
            coords[idx][0] += sx; coords[idx][1] += sy;
        }
    }

    try {
        const r = await api('/api/glyph/set-points', { glyph_name: S.sel, coords });
        if (r.glyph) {
            Object.assign(S.glyphMap[S.sel], r.glyph);
            if (r.glyph.points) S.layers[S.sel] = buildLayersFromPoints(r.glyph.points);
            S.cacheVer = r.cache_version || S.cacheVer;
            markModified();
            redrawEditor(); updateGridCell(S.sel);
            await refreshFontFace(); renderPreviewText(); renderProps();
        }
        if ($('#sel-sx')) { $('#sel-sx').value = 0; $('#sel-sy').value = 0; $('#sel-sc').value = 100; }
    } catch (err) { toast(t('selTransformFailed'), 'error'); }
}

/* ---------- Delete Selected Points ---------- */
async function deleteSelectedPoints() {
    const g = S.glyphMap[S.sel];
    if (!g || !g.points || S.selectedPts.size === 0) return;
    if (S.selectedPts.size >= g.points.coords.length) {
        toast(t('cannotDeleteAll'), 'error'); return;
    }

    const keep = [];
    for (let i = 0; i < g.points.coords.length; i++) {
        if (!S.selectedPts.has(i)) keep.push(i);
    }

    const newCoords = [], newFlags = [], newEndPts = [];
    let start = 0;
    for (const end of g.points.endPts) {
        const contourKeep = keep.filter(k => k >= start && k <= end);
        if (contourKeep.length >= 2) {
            for (const k of contourKeep) {
                newCoords.push([...g.points.coords[k]]);
                newFlags.push(g.points.flags[k]);
            }
            newEndPts.push(newCoords.length - 1);
        }
        start = end + 1;
    }

    if (newCoords.length < 2) { toast(t('tooFewPts'), 'error'); return; }

    const delCount = S.selectedPts.size;
    try {
        const r = await api('/api/glyph/set-points-full', {
            glyph_name: S.sel, coords: newCoords, flags: newFlags, endPts: newEndPts,
        });
        if (r.glyph) {
            Object.assign(S.glyphMap[S.sel], r.glyph);
            if (r.glyph.points) S.layers[S.sel] = buildLayersFromPoints(r.glyph.points);
            S.cacheVer = r.cache_version || S.cacheVer;
            markModified(); S.selectedPts.clear();
            redrawEditor(); updateGridCell(S.sel);
            await refreshFontFace(); renderPreviewText(); renderProps();
            toast(`${t('deleted')} ${delCount} ${t('selPoints')}`, 'ok');
        }
    } catch (err) { toast(t('deleteFailed') + ': ' + err.message, 'error'); }
}

/* ---------- Delete Layer ---------- */
async function deleteLayer(layerIdx) {
    const layers = S.layers[S.sel];
    if (!layers || layerIdx >= layers.length) return;
    if (layers.length <= 1) { toast(t('cannotDelLast'), 'error'); return; }

    layers.splice(layerIdx, 1);
    if (S.activeLayer >= layers.length) S.activeLayer = layers.length - 1;

    const merged = allLayersPoints(S.sel);
    try {
        const r = await api('/api/glyph/set-points-full', {
            glyph_name: S.sel, coords: merged.coords, flags: merged.flags, endPts: merged.endPts,
        });
        if (r.glyph) {
            Object.assign(S.glyphMap[S.sel], r.glyph);
            if (r.glyph.points) S.layers[S.sel] = buildLayersFromPoints(r.glyph.points);
            S.cacheVer = r.cache_version || S.cacheVer;
            markModified(); redrawEditor(); updateGridCell(S.sel);
            await refreshFontFace(); renderPreviewText(); renderProps();
            toast(t('layerDeleted'), 'ok');
        }
    } catch (err) { toast(t('layerDelFailed'), 'error'); }
}

/* ---------- API helpers ---------- */
async function apiEditGlyph(endpoint, body) {
    try {
        const r = await api(endpoint, body);
        if (r.glyph) {
            Object.assign(S.glyphMap[S.sel], r.glyph);
            if (r.glyph.points) S.layers[S.sel] = buildLayersFromPoints(r.glyph.points);
            S.cacheVer = r.cache_version || S.cacheVer;
            markModified(); redrawEditor(); renderProps();
            updateGridCell(S.sel);
            await refreshFontFace(); renderPreviewText();
        }
    } catch (err) { toast(t('editFailed') + ': ' + err.message, 'error'); }
}

function updateGridCell(name) {
    const cell = $(`.grid-cell[data-name="${name}"]`, dom.glyphGrid);
    if (!cell) return;
    const g = S.glyphMap[name];
    const svgEl = cell.querySelector('svg');
    if (svgEl && g.svg_path) {
        const p = svgEl.querySelector('path');
        if (p) p.setAttribute('d', g.svg_path);
    }
}

/* ---------- Font Preview ---------- */
async function refreshFontFace() {
    if (!S.font) return;
    try {
        const res = await fetch('/api/font-file?v=' + Date.now());
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        S.fontVer++;
        const family = `EditPreview${S.fontVer}`;
        if (S.fontStyleEl) S.fontStyleEl.remove();
        if (S.blobUrl) URL.revokeObjectURL(S.blobUrl);
        const style = document.createElement('style');
        style.textContent = `@font-face { font-family: '${family}'; src: url('${url}') format('truetype'); }`;
        document.head.appendChild(style);
        S.fontStyleEl = style; S.blobUrl = url;
        dom.previewRender.style.fontFamily = `'${family}', serif`;
    } catch (e) { console.warn('Preview refresh error', e); }
}

function renderPreviewText() {
    const text = dom.previewText.value || '';
    if (!S.font) { dom.previewRender.textContent = text; return; }
    const cmap = {};
    S.glyphs.forEach(g => { if (g.char) cmap[g.char] = g.name; });
    dom.previewRender.innerHTML = '';
    for (const ch of text) {
        const span = document.createElement('span');
        span.className = 'preview-char'; span.textContent = ch;
        if (cmap[ch]) { span.title = cmap[ch]; span.addEventListener('click', () => selectGlyph(cmap[ch])); }
        dom.previewRender.appendChild(span);
    }
}

/* ---------- Save ---------- */
async function saveFont(saveAs) {
    if (!S.font) { toast(t('noFontErr'), 'error'); return; }
    if (saveAs) { showSaveDialog(); return; }
    try {
        const r = await api('/api/save', {});
        if (r.status === 'success') {
            S.modified = false; dom.modBadge.style.display = 'none';
            await fetchFontList(); toast(t('saved') + ': ' + r.filename, 'ok');
        }
    } catch (e) { toast(t('saveFailed') + ': ' + e.message, 'error'); }
}

function showSaveDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
        <div class="dialog-box">
            <h3>${t('saveAsTitle')}</h3>
            <input type="text" id="save-as-name" placeholder="filename.ttf" value="">
            <div class="dialog-actions">
                <button class="tb-btn" id="dlg-cancel">${t('cancel')}</button>
                <button class="tb-btn tb-save" id="dlg-ok">${t('save')}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#save-as-name');
    input.focus();
    overlay.querySelector('#dlg-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#dlg-ok').onclick = async () => {
        const name = input.value.trim();
        if (!name) return;
        const fname = name.endsWith('.ttf') ? name : name + '.ttf';
        try {
            const r = await api('/api/save', { filename: fname });
            if (r.status === 'success') {
                S.modified = false; dom.modBadge.style.display = 'none';
                await fetchFontList(); toast(t('saved') + ': ' + r.filename, 'ok');
            }
        } catch (e) { toast(t('saveFailed') + ': ' + e.message, 'error'); }
        overlay.remove();
    };
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') overlay.querySelector('#dlg-ok').click();
        if (e.key === 'Escape') overlay.remove();
    });
}

/* ---------- Metadata Editor ---------- */
async function showMetadataEditor() {
    if (!S.font) { toast(t('noFontErr'), 'error'); return; }

    let meta;
    try {
        meta = await api('/api/font-metadata');
    } catch (err) { toast(t('editFailed'), 'error'); return; }

    const entries = meta.entries || {};
    const labels = {
        '1': t('metaFamily'),
        '2': t('metaStyle'),
        '4': t('metaFullName'),
        '5': t('metaVersion'),
        '6': t('metaPostScript'),
        '9': t('metaDesigner'),
        '11': t('metaURL'),
        '0': t('metaCopyright'),
    };

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    let fieldsHtml = '';
    for (const [id, label] of Object.entries(labels)) {
        fieldsHtml += `
            <div class="prop-row" style="margin:4px 0">
                <label style="min-width:100px">${label}</label>
                <input type="text" class="meta-input" data-id="${id}" value="${(entries[id]||'').replace(/"/g,'&quot;')}" style="flex:1">
            </div>`;
    }
    fieldsHtml += `
        <div class="prop-section-title" style="margin-top:12px">${t('metaMetrics')}</div>
        <div class="prop-row" style="margin:4px 0">
            <label style="min-width:100px">${t('metaAscender')}</label>
            <input type="number" id="meta-asc" value="${meta.ascender}" step="10">
        </div>
        <div class="prop-row" style="margin:4px 0">
            <label style="min-width:100px">${t('metaDescender')}</label>
            <input type="number" id="meta-desc" value="${meta.descender}" step="10">
        </div>
        <div class="prop-row" style="margin:4px 0">
            <label style="min-width:100px">${t('metaLineGap')}</label>
            <input type="number" id="meta-gap" value="${meta.lineGap}" step="10">
        </div>`;

    overlay.innerHTML = `
        <div class="dialog-box" style="min-width:450px;max-height:80vh;overflow-y:auto">
            <h3>⚙ ${t('metaTitle')}</h3>
            ${fieldsHtml}
            <div class="dialog-actions" style="margin-top:16px">
                <button class="tb-btn" id="meta-cancel">${t('cancel')}</button>
                <button class="tb-btn tb-save" id="meta-ok">${t('metaSave')}</button>
            </div>
        </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#meta-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#meta-ok').onclick = async () => {
        const newEntries = {};
        overlay.querySelectorAll('.meta-input').forEach(inp => {
            const val = inp.value.trim();
            if (val) newEntries[inp.dataset.id] = val;
        });
        const body = { entries: newEntries };
        const ascV = overlay.querySelector('#meta-asc').value;
        const descV = overlay.querySelector('#meta-desc').value;
        const gapV = overlay.querySelector('#meta-gap').value;
        if (ascV) body.ascender = parseInt(ascV);
        if (descV) body.descender = parseInt(descV);
        if (gapV !== '') body.lineGap = parseInt(gapV);

        try {
            const r = await api('/api/font-metadata', body);
            if (r.status === 'success') {
                markModified();
                toast(t('metaSaved'), 'ok');
            }
        } catch (err) { toast(t('editFailed'), 'error'); }
        overlay.remove();
    };
    overlay.querySelector('.meta-input').focus();
}

/* ---------- Undo / Redo ---------- */
async function doUndo() {
    if (!S.sel) return;
    try {
        const r = await api('/api/undo', { glyph_name: S.sel });
        if (r.error) { toast(r.error, 'error'); return; }
        if (r.glyph) {
            Object.assign(S.glyphMap[S.sel], r.glyph);
            if (r.glyph.points) S.layers[S.sel] = buildLayersFromPoints(r.glyph.points);
            S.cacheVer = r.cache_version || S.cacheVer;
            S.selectedPts.clear();
            markModified();
            redrawEditor(); renderProps(); updateGridCell(S.sel);
            await refreshFontFace(); renderPreviewText();
            toast(t('undo'), 'ok');
        }
    } catch (err) { toast(t('undoFailed') + ': ' + err.message, 'error'); }
}

async function doRedo() {
    if (!S.sel) return;
    try {
        const r = await api('/api/redo', { glyph_name: S.sel });
        if (r.error) { toast(r.error, 'error'); return; }
        if (r.glyph) {
            Object.assign(S.glyphMap[S.sel], r.glyph);
            if (r.glyph.points) S.layers[S.sel] = buildLayersFromPoints(r.glyph.points);
            S.cacheVer = r.cache_version || S.cacheVer;
            S.selectedPts.clear();
            markModified();
            redrawEditor(); renderProps(); updateGridCell(S.sel);
            await refreshFontFace(); renderPreviewText();
            toast(t('redo'), 'ok');
        }
    } catch (err) { toast(t('redoFailed') + ': ' + err.message, 'error'); }
}

/* ---------- Toggle Point Type (on/off curve) ---------- */
async function togglePointType() {
    const g = S.glyphMap[S.sel];
    if (!g || !g.points || S.selectedPts.size === 0) return;

    const indices = [...S.selectedPts];
    try {
        const r = await api('/api/glyph/toggle-point-type', {
            glyph_name: S.sel, indices,
        });
        if (r.glyph) {
            Object.assign(S.glyphMap[S.sel], r.glyph);
            if (r.glyph.points) S.layers[S.sel] = buildLayersFromPoints(r.glyph.points);
            S.cacheVer = r.cache_version || S.cacheVer;
            markModified();
            redrawEditor(); renderProps(); updateGridCell(S.sel);
            await refreshFontFace(); renderPreviewText();
            toast(t('toggled'), 'ok');
        }
    } catch (err) { toast(t('toggleFailed') + ': ' + err.message, 'error'); }
}

/* ---------- Smooth / Round Corners ---------- */
async function smoothSelectedCorners() {
    const g = S.glyphMap[S.sel];
    if (!g || !g.points || S.selectedPts.size === 0) return;

    // Only on-curve points can be smoothed
    const onCurveIndices = [...S.selectedPts].filter(i => g.points.flags[i] === 1);
    if (onCurveIndices.length === 0) {
        toast(t('selectOnCurve'), 'error');
        return;
    }

    const radiusInput = $('#smooth-radius');
    const radius = radiusInput ? parseFloat(radiusInput.value) || 0.35 : 0.35;

    try {
        const r = await api('/api/glyph/smooth-points', {
            glyph_name: S.sel, indices: onCurveIndices, radius,
        });
        if (r.glyph) {
            Object.assign(S.glyphMap[S.sel], r.glyph);
            if (r.glyph.points) S.layers[S.sel] = buildLayersFromPoints(r.glyph.points);
            S.cacheVer = r.cache_version || S.cacheVer;
            S.selectedPts.clear();
            markModified();
            redrawEditor(); renderProps(); updateGridCell(S.sel);
            await refreshFontFace(); renderPreviewText();
            toast(`${t('smoothed')} ${onCurveIndices.length} ${t('corners')}`, 'ok');
        }
    } catch (err) { toast(t('smoothFailed') + ': ' + err.message, 'error'); }
}

/* ---------- Keyboard ---------- */
function onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const g = S.sel ? S.glyphMap[S.sel] : null;

    // Space held = pan mode
    if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        S.spaceHeld = true;
        dom.svg.style.cursor = 'grab';
        return;
    }

    if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.metaKey) { setMode(MODES.SELECT); return; }
    if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey) { setMode(MODES.MARQUEE); return; }
    if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey) { setMode(MODES.PEN); return; }

    if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (g && g.points) {
            S.selectedPts.clear();
            for (let i = 0; i < g.points.coords.length; i++) S.selectedPts.add(i);
            redrawEditor(); renderProps();
        }
        return;
    }

    // Copy / Paste points (Ctrl+C / Ctrl+V)
    if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (S.selectedPts.size > 0) copySelectedPoints();
        else if (g) copyGlyph();
        return;
    }
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (S.clipboard) pastePoints();
        return;
    }

    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault(); doUndo(); return;
    }
    if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
        (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault(); doRedo(); return;
    }

    if (e.key === 'Escape') {
        if (S.mode === MODES.PEN && S.penContour.length > 0) {
            S.penContour = []; redrawEditor();
        } else {
            S.selectedPts.clear(); redrawEditor(); renderProps();
        }
        return;
    }

    const shift = e.shiftKey ? 1 : 10;

    switch (e.key) {
        case 'ArrowRight': e.preventDefault();
            if (S.selectedPts.size > 0) accumulateMove(shift, 0);
            else if (g) accumulateGlyphMove(shift, 0); break;
        case 'ArrowLeft': e.preventDefault();
            if (S.selectedPts.size > 0) accumulateMove(-shift, 0);
            else if (g) accumulateGlyphMove(-shift, 0); break;
        case 'ArrowUp': e.preventDefault();
            if (S.selectedPts.size > 0) accumulateMove(0, shift);
            else if (g) accumulateGlyphMove(0, shift); break;
        case 'ArrowDown': e.preventDefault();
            if (S.selectedPts.size > 0) accumulateMove(0, -shift);
            else if (g) accumulateGlyphMove(0, -shift); break;
        case '+': case '=': e.preventDefault();
            if (g) quickScale(1.05); break;
        case '-': case '_': e.preventDefault();
            if (g) quickScale(0.95); break;
        case 's':
            if (e.ctrlKey) { e.preventDefault(); saveFont(false); } break;
        case 'h':
            if (g) { e.preventDefault(); flipSelection('h'); } break;
        case 'H':
            if (g) { e.preventDefault(); flipSelection('v'); } break;
        case 'r':
            if (g && !e.ctrlKey) {
                e.preventDefault();
                const angle = e.shiftKey ? -90 : 90;
                rotateSelection(angle);
            } break;
        case '?':
            e.preventDefault(); showShortcutOverlay(); break;
        case 'Delete':
            if (S.selectedPts.size > 0) deleteSelectedPoints();
            else if (g) apiEditGlyph('/api/glyph/reset', { glyph_name: S.sel });
            break;
    }
}

function onKeyUp(e) {
    if (e.key === ' ') {
        S.spaceHeld = false;
        if (!S.panning) {
            dom.svg.style.cursor = S.mode === MODES.PEN || S.mode === MODES.MARQUEE ? 'crosshair' : 'default';
        }
    }
}

/* ---------- Arrow-key debounced move ---------- */
function accumulateMove(dx, dy) {
    S.arrowAccum.dx += dx;
    S.arrowAccum.dy += dy;
    // Immediate visual feedback
    const g = S.glyphMap[S.sel];
    if (g && g.points) {
        if (!S.localPoints) {
            S.localPoints = g.points.coords.map(p => [...p]);
            S.localFlags = [...g.points.flags];
            S.localEndPts = [...g.points.endPts];
        }
        for (const idx of S.selectedPts) {
            S.localPoints[idx][0] += dx;
            S.localPoints[idx][1] += dy;
        }
        updateLocalVisuals();
    }
    clearTimeout(S.arrowTimer);
    S.arrowTimer = setTimeout(() => {
        const adx = S.arrowAccum.dx, ady = S.arrowAccum.dy;
        S.arrowAccum.dx = 0; S.arrowAccum.dy = 0;
        S.localPoints = null; S.localFlags = null; S.localEndPts = null;
        moveSelectedPts(adx, ady);
    }, 250);
}

function accumulateGlyphMove(dx, dy) {
    S.arrowAccum.dx += dx;
    S.arrowAccum.dy += dy;
    clearTimeout(S.arrowTimer);
    S.arrowTimer = setTimeout(() => {
        const adx = S.arrowAccum.dx, ady = S.arrowAccum.dy;
        S.arrowAccum.dx = 0; S.arrowAccum.dy = 0;
        quickTransform(adx, ady);
    }, 250);
}

async function moveSelectedPts(dx, dy) {
    const g = S.glyphMap[S.sel];
    if (!g || !g.points) return;
    const coords = g.points.coords.map(p => [...p]);
    for (const idx of S.selectedPts) { coords[idx][0] += dx; coords[idx][1] += dy; }
    try {
        const r = await api('/api/glyph/set-points', { glyph_name: S.sel, coords });
        if (r.glyph) {
            Object.assign(S.glyphMap[S.sel], r.glyph);
            if (r.glyph.points) S.layers[S.sel] = buildLayersFromPoints(r.glyph.points);
            S.cacheVer = r.cache_version || S.cacheVer;
            markModified(); redrawEditor(); updateGridCell(S.sel);
            await refreshFontFace(); renderPreviewText();
        }
    } catch (err) { toast(t('moveFailed'), 'error'); }
}

async function quickTransform(dx, dy) {
    await apiEditGlyph('/api/glyph/transform', {
        glyph_name: S.sel, shift_x: dx, shift_y: dy, scale: 1,
    });
}

async function quickScale(factor) {
    await apiEditGlyph('/api/glyph/transform', {
        glyph_name: S.sel, shift_x: 0, shift_y: 0, scale: factor,
    });
}

/* ---------- Flip / Rotate ---------- */
async function flipSelection(axis) {
    const g = S.glyphMap[S.sel];
    if (!g || !g.points) return;
    const body = { glyph_name: S.sel, axis };
    if (S.selectedPts.size > 0) body.indices = [...S.selectedPts];
    await apiEditGlyph('/api/glyph/flip', body);
}

async function rotateSelection(angle) {
    const g = S.glyphMap[S.sel];
    if (!g || !g.points) return;
    const body = { glyph_name: S.sel, angle };
    if (S.selectedPts.size > 0) body.indices = [...S.selectedPts];
    await apiEditGlyph('/api/glyph/rotate', body);
}

/* ---------- Copy / Paste Points ---------- */
function copySelectedPoints() {
    const g = S.glyphMap[S.sel];
    if (!g || !g.points || S.selectedPts.size === 0) return;
    const sorted = [...S.selectedPts].sort((a, b) => a - b);
    S.clipboard = {
        coords: sorted.map(i => [...g.points.coords[i]]),
        flags: sorted.map(i => g.points.flags[i]),
    };
    toast(t('copied', S.clipboard.coords.length), 'ok');
}

async function pastePoints() {
    if (!S.clipboard || !S.sel) return;
    const g = S.glyphMap[S.sel];
    if (!g) return;
    try {
        const r = await api('/api/glyph/add-contour', {
            glyph_name: S.sel,
            coords: S.clipboard.coords,
            flags: S.clipboard.flags,
        });
        if (r.glyph) {
            Object.assign(S.glyphMap[S.sel], r.glyph);
            if (r.glyph.points) S.layers[S.sel] = buildLayersFromPoints(r.glyph.points);
            S.cacheVer = r.cache_version || S.cacheVer;
            markModified();
            redrawEditor(); updateGridCell(S.sel);
            await refreshFontFace(); renderPreviewText(); renderProps();
            toast(t('pasted', S.clipboard.coords.length), 'ok');
        }
    } catch (err) { toast(t('pasteFailed'), 'error'); }
}

/* ---------- Copy / Paste Glyphs ---------- */
function copyGlyph() {
    const g = S.glyphMap[S.sel];
    if (!g || !g.points) return;
    S.glyphClipboard = {
        points: JSON.parse(JSON.stringify(g.points)),
        advance_width: g.advance_width,
    };
    toast(t('glyphCopied'), 'ok');
}

async function pasteGlyphTo(targetName) {
    if (!S.glyphClipboard || !targetName) return;
    try {
        const r = await api('/api/glyph/set-points-full', {
            glyph_name: targetName,
            coords: S.glyphClipboard.points.coords,
            flags: S.glyphClipboard.points.flags,
            endPts: S.glyphClipboard.points.endPts,
        });
        if (r.glyph) {
            Object.assign(S.glyphMap[targetName], r.glyph);
            if (r.glyph.points) S.layers[targetName] = buildLayersFromPoints(r.glyph.points);
            S.cacheVer = r.cache_version || S.cacheVer;
            markModified();
            if (S.sel === targetName) { redrawEditor(); renderProps(); }
            updateGridCell(targetName);
            await refreshFontFace(); renderPreviewText();
            toast(t('glyphPasted'), 'ok');
        }
    } catch (err) { toast(t('pasteFailed'), 'error'); }
}

/* ---------- Add Point on Segment ---------- */
async function addPointOnSegment(afterIdx, x, y) {
    if (!S.sel) return;
    try {
        const r = await api('/api/glyph/add-point-on-segment', {
            glyph_name: S.sel, after_index: afterIdx, x, y,
        });
        if (r.glyph) {
            Object.assign(S.glyphMap[S.sel], r.glyph);
            if (r.glyph.points) S.layers[S.sel] = buildLayersFromPoints(r.glyph.points);
            S.cacheVer = r.cache_version || S.cacheVer;
            markModified(); S.selectedPts.clear(); S.selectedPts.add(afterIdx + 1);
            redrawEditor(); updateGridCell(S.sel); renderProps();
            await refreshFontFace(); renderPreviewText();
            toast(t('pointAdded'), 'ok');
        }
    } catch (err) { toast(t('editFailed'), 'error'); }
}

/* ---------- Right-click Context Menu ---------- */
function onContextMenu(e) {
    e.preventDefault();
    removeContextMenu();
    if (!S.sel || !S.glyphMap[S.sel]) return;
    const g = S.glyphMap[S.sel];
    const sv = svgCoords(e);

    const items = [];

    // If right-clicking on a line segment, offer to add point
    if (g.points && S.mode === MODES.SELECT) {
        const nearest = findNearestSegment(sv, g);
        if (nearest !== null) {
            items.push({
                label: t('addPointHere'),
                action: () => addPointOnSegment(nearest.afterIdx, Math.round(sv.x), Math.round(-sv.y)),
            });
        }
    }

    // Point-related items
    if (S.selectedPts.size > 0) {
        items.push({ label: t('deleteSelPts'), action: deleteSelectedPoints });
        items.push({ label: t('toggleOnOff'), action: togglePointType });
        items.push({ label: `${t('flipH')} (H)`, action: () => flipSelection('h') });
        items.push({ label: `${t('flipV')} (Shift+H)`, action: () => flipSelection('v') });
        items.push({ label: `${t('rotate90')} (R)`, action: () => rotateSelection(90) });
        items.push(null); // separator
        items.push({ label: `${t('copy')} (Ctrl+C)`, action: copySelectedPoints });
    }

    if (S.clipboard) {
        items.push({ label: `${t('paste')} (Ctrl+V)`, action: pastePoints });
    }

    if (g) {
        items.push(null);
        items.push({ label: t('copyGlyph'), action: copyGlyph });
        if (S.glyphClipboard) {
            items.push({ label: t('pasteGlyphHere'), action: () => pasteGlyphTo(S.sel) });
        }
    }

    if (items.length === 0) return;

    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    for (const item of items) {
        if (item === null) {
            const sep = document.createElement('div');
            sep.className = 'ctx-sep';
            menu.appendChild(sep);
            continue;
        }
        const btn = document.createElement('div');
        btn.className = 'ctx-item';
        btn.textContent = item.label;
        btn.addEventListener('click', () => { removeContextMenu(); item.action(); });
        menu.appendChild(btn);
    }

    document.body.appendChild(menu);

    // Close on next click
    setTimeout(() => {
        window.addEventListener('click', removeContextMenu, { once: true });
        window.addEventListener('contextmenu', removeContextMenu, { once: true });
    }, 10);
}

function removeContextMenu() {
    const old = document.querySelector('.ctx-menu');
    if (old) old.remove();
}

function findNearestSegment(sv, g) {
    if (!g.points) return null;
    const pts = g.points.coords;
    const endPts = g.points.endPts;
    const threshold = S.font.units_per_em / 25;
    let bestDist = threshold;
    let best = null;

    let start = 0;
    for (const end of endPts) {
        for (let i = start; i <= end; i++) {
            const next = i === end ? start : i + 1;
            const ax = pts[i][0], ay = pts[i][1];
            const bx = pts[next][0], by = pts[next][1];
            const px = sv.x, py = -sv.y;  // convert SVG y to font y

            // Distance from point to line segment
            const dx = bx - ax, dy = by - ay;
            const len2 = dx * dx + dy * dy;
            if (len2 < 1) continue;
            let t2 = ((px - ax) * dx + (py - ay) * dy) / len2;
            t2 = Math.max(0, Math.min(1, t2));
            const cx = ax + t2 * dx, cy = ay + t2 * dy;
            const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
            if (dist < bestDist) {
                bestDist = dist;
                best = { afterIdx: i, dist };
            }
        }
        start = end + 1;
    }
    return best;
}

/* ---------- Keyboard Shortcut Overlay ---------- */
function showShortcutOverlay() {
    if (document.querySelector('.shortcut-overlay')) { removeShortcutOverlay(); return; }
    const shortcuts = [
        ['V', t('selectV')],
        ['M', t('marqueeM')],
        ['P', t('penP')],
        ['H', t('flipH')],
        ['Shift+H', t('flipV')],
        ['R', t('rotate90')],
        ['Ctrl+A', t('selectAll')],
        ['Ctrl+C', t('copy')],
        ['Ctrl+V', t('paste')],
        ['Ctrl+Z', t('undo')],
        ['Ctrl+Y', t('redo')],
        ['Ctrl+S', t('save')],
        ['Space+Drag', t('panCanvas')],
        ['Arrows', t('nudge')],
        ['Shift+Arrows', t('nudgeFine')],
        ['+/-', t('scaleUpDown')],
        ['Delete', t('deleteSelPts')],
        ['Escape', t('deselectCancel')],
        ['?', t('shortcuts')],
    ];

    const overlay = document.createElement('div');
    overlay.className = 'shortcut-overlay';
    let html = `<h3>${t('shortcuts')}</h3><div class="shortcut-grid">`;
    for (const [key, desc] of shortcuts) {
        html += `<kbd>${key}</kbd><span>${desc}</span>`;
    }
    html += `</div><button class="prop-btn" onclick="this.parentElement.remove()">${t('close')}</button>`;
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
}

function removeShortcutOverlay() {
    const el = document.querySelector('.shortcut-overlay');
    if (el) el.remove();
}

/* ---------- Utility ---------- */
function api(url, body) {
    const opts = body != null
        ? { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) }
        : {};
    return fetch(url, opts).then(r => r.json());
}

function svgCoords(e) {
    const svg = dom.svg;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
}

function createSvg(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
}

function markModified() {
    S.modified = true;
    dom.modBadge.style.display = 'inline';
}

function toast(msg, type) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.background = type === 'error' ? 'var(--danger)' : 'var(--success)';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

/* ---------- Client-side Path Builder ---------- */
function buildPathFromPoints(coords, flags, endPts) {
    let d = '';
    let start = 0;
    for (const end of endPts) {
        const n = end - start + 1;
        if (n < 2) { start = end + 1; continue; }
        const cpts = [];
        for (let i = start; i <= end; i++) {
            cpts.push({ x: coords[i][0], y: coords[i][1], on: flags[i] === 1 });
        }
        let firstOn = cpts.findIndex(p => p.on);
        let startPt;
        if (firstOn < 0) {
            startPt = { x: (cpts[0].x + cpts[n-1].x)/2, y: (cpts[0].y + cpts[n-1].y)/2 };
            firstOn = 0;
        } else {
            startPt = cpts[firstOn];
        }
        d += `M${startPt.x} ${startPt.y} `;
        let idx = (firstOn + 1) % n;
        let processed = 0;
        while (processed < n - (cpts.findIndex(p => p.on) >= 0 ? 1 : 0)) {
            const p = cpts[idx];
            if (p.on) {
                d += `L${p.x} ${p.y} `;
                idx = (idx + 1) % n; processed++;
            } else {
                const nextIdx = (idx + 1) % n;
                const next = cpts[nextIdx];
                if (next.on) {
                    d += `Q${p.x} ${p.y} ${next.x} ${next.y} `;
                    idx = (nextIdx + 1) % n; processed += 2;
                } else {
                    const mx = (p.x + next.x)/2, my = (p.y + next.y)/2;
                    d += `Q${p.x} ${p.y} ${mx} ${my} `;
                    idx = nextIdx; processed++;
                }
            }
            if (processed > n + 2) break;
        }
        d += 'Z ';
        start = end + 1;
    }
    return d;
}

})();
