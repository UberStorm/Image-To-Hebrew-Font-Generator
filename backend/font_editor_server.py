"""
Font Editor Server — visual TTF font editor
Runs on port 5001, separate from the font maker (port 5000).
"""

from flask import Flask, request, jsonify, send_from_directory, Response
try:
    from flask_cors import CORS
except ImportError:
    CORS = lambda app: None

import os, io, json, sys, copy, base64, array, threading, webbrowser
from datetime import datetime
from werkzeug.utils import secure_filename

from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates

# --------------- paths ---------------
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_editor_dir = os.path.join(_project_root, 'font_editor')
_fonts_dir = os.path.join(_project_root, 'fonts_output')
_temp_dir = os.path.join(_project_root, 'temp')
os.makedirs(_fonts_dir, exist_ok=True)
os.makedirs(_temp_dir, exist_ok=True)

app = Flask(__name__, static_folder=_editor_dir, static_url_path='')
CORS(app)

# --------------- editor state ---------------
editor_state = {
    'font': None,
    'font_path': None,
    'font_name': '',
    'originals': {},      # glyph_name -> { coords, flags, endPts, aw, lsb }
    'modified': False,
    'history': {},        # glyph_name -> { 'undo': [snapshots], 'redo': [snapshots] }
}

MAX_HISTORY = 50


def _snapshot_glyph(name):
    """Capture current glyph state for undo/redo."""
    font = editor_state['font']
    if not font:
        return None
    glyf = font['glyf']
    g = glyf[name]
    snap = {}
    if hasattr(g, 'numberOfContours') and g.numberOfContours > 0 and g.coordinates is not None:
        snap['coords'] = [[int(x), int(y)] for x, y in g.coordinates]
        snap['flags'] = list(g.flags)
        snap['endPts'] = list(g.endPtsOfContours)
    elif hasattr(g, 'numberOfContours') and g.numberOfContours == 0:
        snap['coords'] = []
        snap['flags'] = []
        snap['endPts'] = []
    aw, lsb = font['hmtx'][name]
    snap['aw'] = aw
    snap['lsb'] = lsb
    return snap


def _push_undo(name):
    """Save current state to undo stack before an edit. Clears redo."""
    snap = _snapshot_glyph(name)
    if snap is None:
        return
    hist = editor_state['history'].setdefault(name, {'undo': [], 'redo': []})
    hist['undo'].append(snap)
    if len(hist['undo']) > MAX_HISTORY:
        hist['undo'] = hist['undo'][-MAX_HISTORY:]
    hist['redo'].clear()


def _restore_snapshot(name, snap):
    """Apply a snapshot to the glyph."""
    font = editor_state['font']
    glyf = font['glyf']
    g = glyf[name]
    if 'coords' in snap and len(snap['coords']) > 0:
        g.coordinates = GlyphCoordinates([(c[0], c[1]) for c in snap['coords']])
        g.flags = array.array('B', snap['flags'])
        g.endPtsOfContours = list(snap['endPts'])
        g.numberOfContours = len(snap['endPts'])
        g.recalcBounds(glyf)
    if 'aw' in snap:
        font['hmtx'][name] = (snap['aw'], snap['lsb'])

_font_cache = {'version': 0, 'data': None}


def _invalidate():
    _font_cache['data'] = None
    _font_cache['version'] += 1


def _font_bytes():
    if editor_state['font'] is None:
        return None
    if _font_cache['data'] is None:
        buf = io.BytesIO()
        editor_state['font'].save(buf)
        _font_cache['data'] = buf.getvalue()
    return _font_cache['data']


def _svg_path(glyph_name):
    font = editor_state['font']
    if font is None:
        return ''
    try:
        gs = font.getGlyphSet()
        pen = SVGPathPen(gs)
        gs[glyph_name].draw(pen)
        return pen.getCommands()
    except Exception:
        return ''


def _glyph_info(glyph_name):
    font = editor_state['font']
    cmap = font.getBestCmap() or {}
    rev = {v: k for k, v in cmap.items()}
    cc = rev.get(glyph_name, 0)
    char = chr(cc) if cc > 31 else ''
    aw, lsb = font['hmtx'][glyph_name]
    svg = _svg_path(glyph_name)

    glyf = font['glyf']
    glyph = glyf[glyph_name]
    points = None
    is_composite = False

    if hasattr(glyph, 'numberOfContours'):
        if glyph.numberOfContours > 0 and glyph.coordinates is not None:
            points = {
                'coords': [[int(x), int(y)] for x, y in glyph.coordinates],
                'flags': [int(f) & 1 for f in glyph.flags],
                'endPts': list(glyph.endPtsOfContours),
            }
        elif glyph.numberOfContours == -1:
            is_composite = True

    return {
        'name': glyph_name,
        'char': char,
        'unicode': cc,
        'advance_width': aw,
        'lsb': lsb,
        'svg_path': svg,
        'points': points,
        'is_composite': is_composite,
    }


# --------------- routes ---------------

@app.route('/')
def index():
    return send_from_directory(_editor_dir, 'index.html')


@app.route('/api/list-fonts')
def list_fonts():
    fonts = sorted(f for f in os.listdir(_fonts_dir) if f.lower().endswith('.ttf'))
    return jsonify({'fonts': fonts})


@app.route('/api/load-font', methods=['POST'])
def load_font():
    try:
        path = None

        if 'file' in request.files and request.files['file'].filename:
            f = request.files['file']
            fname = secure_filename(f"edit_{datetime.now().timestamp()}.ttf")
            path = os.path.join(_temp_dir, fname)
            f.save(path)
        elif request.is_json:
            data = request.get_json()
            fname = data.get('filename')
            if fname:
                path = os.path.join(_fonts_dir, secure_filename(fname))

        if not path or not os.path.exists(path):
            return jsonify({'error': 'No font file provided'}), 400

        font = TTFont(path)
        editor_state['font'] = font
        editor_state['font_path'] = path
        editor_state['modified'] = False

        # Store originals for reset
        originals = {}
        glyf = font['glyf']
        hmtx = font['hmtx']
        for name in font.getGlyphOrder():
            entry = {}
            try:
                g = glyf[name]
                if hasattr(g, 'numberOfContours') and g.numberOfContours > 0 and g.coordinates is not None:
                    entry['coords'] = [[int(x), int(y)] for x, y in g.coordinates]
                    entry['flags'] = list(g.flags)
                    entry['endPts'] = list(g.endPtsOfContours)
                aw, lsb = hmtx[name]
                entry['aw'] = aw
                entry['lsb'] = lsb
            except Exception:
                pass
            originals[name] = entry
        editor_state['originals'] = originals
        editor_state['history'] = {}

        _invalidate()

        # Font metadata
        name_tbl = font['name']
        font_name = name_tbl.getDebugName(1) or 'Unknown'
        editor_state['font_name'] = font_name

        upm = font['head'].unitsPerEm
        ascender = font['OS/2'].sTypoAscender if 'OS/2' in font else 800
        descender = font['OS/2'].sTypoDescender if 'OS/2' in font else -200

        # Build glyph list
        cmap = font.getBestCmap() or {}
        rev = {v: k for k, v in cmap.items()}
        glyphs = []
        for gn in font.getGlyphOrder():
            if gn in ('.notdef', '.null', 'NULL'):
                continue
            try:
                glyphs.append(_glyph_info(gn))
            except Exception:
                continue

        return jsonify({
            'status': 'success',
            'font_name': font_name,
            'units_per_em': upm,
            'ascender': ascender,
            'descender': descender,
            'glyph_count': len(glyphs),
            'glyphs': glyphs,
            'cache_version': _font_cache['version'],
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/font-file')
def serve_font_file():
    data = _font_bytes()
    if data is None:
        return jsonify({'error': 'No font loaded'}), 400
    return Response(data, mimetype='font/ttf',
                    headers={'Cache-Control': 'no-cache, no-store'})


@app.route('/api/glyph/transform', methods=['POST'])
def transform_glyph():
    """Apply shift / scale to a glyph (incremental from current state)."""
    try:
        font = editor_state['font']
        if not font:
            return jsonify({'error': 'No font loaded'}), 400

        d = request.get_json()
        name = d['glyph_name']
        dx = int(d.get('shift_x', 0))
        dy = int(d.get('shift_y', 0))
        scale = float(d.get('scale', 1.0))

        glyf = font['glyf']
        g = glyf[name]

        if hasattr(g, 'numberOfContours') and g.numberOfContours > 0 and g.coordinates is not None:
            _push_undo(name)
            coords = [[int(x), int(y)] for x, y in g.coordinates]

            if scale != 1.0:
                xs = [c[0] for c in coords]
                ys = [c[1] for c in coords]
                cx = (min(xs) + max(xs)) / 2
                cy = (min(ys) + max(ys)) / 2
                coords = [
                    [round((x - cx) * scale + cx + dx),
                     round((y - cy) * scale + cy + dy)]
                    for x, y in coords
                ]
            elif dx or dy:
                coords = [[x + dx, y + dy] for x, y in coords]

            g.coordinates = GlyphCoordinates([(c[0], c[1]) for c in coords])
            g.recalcBounds(glyf)

        editor_state['modified'] = True
        _invalidate()

        return jsonify({
            'status': 'success',
            'glyph': _glyph_info(name),
            'cache_version': _font_cache['version'],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/glyph/set-width', methods=['POST'])
def set_width():
    try:
        font = editor_state['font']
        if not font:
            return jsonify({'error': 'No font loaded'}), 400
        d = request.get_json()
        name = d['glyph_name']
        new_aw = int(d['advance_width'])
        _push_undo(name)
        aw, lsb = font['hmtx'][name]
        font['hmtx'][name] = (new_aw, lsb)
        editor_state['modified'] = True
        _invalidate()
        return jsonify({
            'status': 'success',
            'glyph': _glyph_info(name),
            'cache_version': _font_cache['version'],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/glyph/set-points', methods=['POST'])
def set_points():
    """Replace all contour points for a glyph."""
    try:
        font = editor_state['font']
        if not font:
            return jsonify({'error': 'No font loaded'}), 400
        d = request.get_json()
        name = d['glyph_name']
        new_coords = d['coords']  # [[x,y], ...]

        glyf = font['glyf']
        g = glyf[name]
        if not hasattr(g, 'numberOfContours') or g.numberOfContours <= 0:
            return jsonify({'error': 'Cannot edit points of this glyph'}), 400

        _push_undo(name)
        g.coordinates = GlyphCoordinates([(int(x), int(y)) for x, y in new_coords])
        g.recalcBounds(glyf)
        editor_state['modified'] = True
        _invalidate()

        return jsonify({
            'status': 'success',
            'glyph': _glyph_info(name),
            'cache_version': _font_cache['version'],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/glyph/reset', methods=['POST'])
def reset_glyph():
    try:
        font = editor_state['font']
        if not font:
            return jsonify({'error': 'No font loaded'}), 400
        d = request.get_json()
        name = d['glyph_name']
        orig = editor_state['originals'].get(name, {})

        _push_undo(name)
        glyf = font['glyf']
        g = glyf[name]

        if 'coords' in orig and hasattr(g, 'numberOfContours') and g.numberOfContours > 0:
            g.coordinates = GlyphCoordinates([(c[0], c[1]) for c in orig['coords']])
            g.flags = array.array('B', orig['flags'])
            g.endPtsOfContours = list(orig['endPts'])
            g.recalcBounds(glyf)

        if 'aw' in orig:
            font['hmtx'][name] = (orig['aw'], orig['lsb'])

        _invalidate()
        return jsonify({
            'status': 'success',
            'glyph': _glyph_info(name),
            'cache_version': _font_cache['version'],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/glyph/add-contour', methods=['POST'])
def add_contour():
    """Add a new contour (from pen tool) to an existing glyph."""
    try:
        font = editor_state['font']
        if not font:
            return jsonify({'error': 'No font loaded'}), 400

        d = request.get_json()
        name = d['glyph_name']
        new_coords = d['coords']    # [[x,y], ...]
        new_flags = d.get('flags', [1] * len(new_coords))

        glyf = font['glyf']
        g = glyf[name]

        if not hasattr(g, 'numberOfContours') or g.numberOfContours < 0:
            return jsonify({'error': 'Cannot add contour to composite glyph'}), 400

        _push_undo(name)
        if g.numberOfContours == 0 or g.coordinates is None:
            # Empty glyph — set the first contour
            g.coordinates = GlyphCoordinates([(int(x), int(y)) for x, y in new_coords])
            g.flags = array.array('B', [int(f) & 1 for f in new_flags])
            g.endPtsOfContours = [len(new_coords) - 1]
            g.numberOfContours = 1
        else:
            # Append new contour to existing points
            existing_coords = [[int(x), int(y)] for x, y in g.coordinates]
            existing_flags = list(g.flags)
            existing_endPts = list(g.endPtsOfContours)

            offset = len(existing_coords)
            for c in new_coords:
                existing_coords.append([int(c[0]), int(c[1])])
            for f in new_flags:
                existing_flags.append(int(f) & 1)
            existing_endPts.append(offset + len(new_coords) - 1)

            g.coordinates = GlyphCoordinates([(c[0], c[1]) for c in existing_coords])
            g.flags = array.array('B', existing_flags)
            g.endPtsOfContours = existing_endPts
            g.numberOfContours = len(existing_endPts)

        g.recalcBounds(glyf)
        editor_state['modified'] = True
        _invalidate()

        return jsonify({
            'status': 'success',
            'glyph': _glyph_info(name),
            'cache_version': _font_cache['version'],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/glyph/set-points-full', methods=['POST'])
def set_points_full():
    """Replace points, flags and endPtsOfContours for a glyph (for delete/layer ops)."""
    try:
        font = editor_state['font']
        if not font:
            return jsonify({'error': 'No font loaded'}), 400

        d = request.get_json()
        name = d['glyph_name']
        new_coords = d['coords']
        new_flags = d['flags']
        new_endPts = d['endPts']

        glyf = font['glyf']
        g = glyf[name]

        if not hasattr(g, 'numberOfContours') or g.numberOfContours < 0:
            return jsonify({'error': 'Cannot edit composite glyph'}), 400

        _push_undo(name)
        g.coordinates = GlyphCoordinates([(int(x), int(y)) for x, y in new_coords])
        g.flags = array.array('B', [int(f) & 1 for f in new_flags])
        g.endPtsOfContours = [int(e) for e in new_endPts]
        g.numberOfContours = len(new_endPts)
        g.recalcBounds(glyf)

        editor_state['modified'] = True
        _invalidate()

        return jsonify({
            'status': 'success',
            'glyph': _glyph_info(name),
            'cache_version': _font_cache['version'],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/undo', methods=['POST'])
def undo():
    try:
        font = editor_state['font']
        if not font:
            return jsonify({'error': 'No font loaded'}), 400
        d = request.get_json()
        name = d['glyph_name']
        hist = editor_state['history'].get(name, {'undo': [], 'redo': []})
        if not hist['undo']:
            return jsonify({'error': 'Nothing to undo'}), 400

        # Push current to redo
        cur = _snapshot_glyph(name)
        if cur:
            hist['redo'].append(cur)

        snap = hist['undo'].pop()
        _restore_snapshot(name, snap)
        editor_state['modified'] = True
        _invalidate()

        return jsonify({
            'status': 'success',
            'glyph': _glyph_info(name),
            'cache_version': _font_cache['version'],
            'can_undo': len(hist['undo']) > 0,
            'can_redo': len(hist['redo']) > 0,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/redo', methods=['POST'])
def redo():
    try:
        font = editor_state['font']
        if not font:
            return jsonify({'error': 'No font loaded'}), 400
        d = request.get_json()
        name = d['glyph_name']
        hist = editor_state['history'].get(name, {'undo': [], 'redo': []})
        if not hist['redo']:
            return jsonify({'error': 'Nothing to redo'}), 400

        # Push current to undo
        cur = _snapshot_glyph(name)
        if cur:
            hist['undo'].append(cur)

        snap = hist['redo'].pop()
        _restore_snapshot(name, snap)
        editor_state['modified'] = True
        _invalidate()

        return jsonify({
            'status': 'success',
            'glyph': _glyph_info(name),
            'cache_version': _font_cache['version'],
            'can_undo': len(hist['undo']) > 0,
            'can_redo': len(hist['redo']) > 0,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/glyph/toggle-point-type', methods=['POST'])
def toggle_point_type():
    """Toggle selected points between on-curve (1) and off-curve (0)."""
    try:
        font = editor_state['font']
        if not font:
            return jsonify({'error': 'No font loaded'}), 400

        d = request.get_json()
        name = d['glyph_name']
        indices = d['indices']  # list of point indices to toggle

        glyf = font['glyf']
        g = glyf[name]

        if not hasattr(g, 'numberOfContours') or g.numberOfContours <= 0 or g.coordinates is None:
            return jsonify({'error': 'No points to edit'}), 400

        _push_undo(name)

        flags = list(g.flags)
        for idx in indices:
            if 0 <= idx < len(flags):
                flags[idx] = 0 if (flags[idx] & 1) else 1
        g.flags = array.array('B', flags)

        editor_state['modified'] = True
        _invalidate()

        return jsonify({
            'status': 'success',
            'glyph': _glyph_info(name),
            'cache_version': _font_cache['version'],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/glyph/smooth-points', methods=['POST'])
def smooth_points():
    """Round corners at selected on-curve points by inserting off-curve control points."""
    try:
        font = editor_state['font']
        if not font:
            return jsonify({'error': 'No font loaded'}), 400

        d = request.get_json()
        name = d['glyph_name']
        indices = sorted(d['indices'])  # on-curve point indices to smooth
        radius = float(d.get('radius', 0.35))  # fraction along edge (0-0.5)
        radius = max(0.05, min(0.5, radius))

        glyf = font['glyf']
        g = glyf[name]

        if not hasattr(g, 'numberOfContours') or g.numberOfContours <= 0 or g.coordinates is None:
            return jsonify({'error': 'No points to edit'}), 400

        _push_undo(name)

        coords = [[int(x), int(y)] for x, y in g.coordinates]
        flags = [int(f) & 1 for f in g.flags]
        endPts = list(g.endPtsOfContours)

        # For each corner point, we need to know its contour and neighbors
        def get_contour(idx):
            start = 0
            for ci, ep in enumerate(endPts):
                if idx <= ep:
                    return ci, start, ep
                start = ep + 1
            return -1, 0, 0

        # Process in reverse so indices stay valid
        insertions = []
        for idx in reversed(indices):
            if idx >= len(coords):
                continue
            if flags[idx] != 1:
                continue  # Only smooth on-curve corner points

            ci, cstart, cend = get_contour(idx)
            if ci < 0:
                continue
            clen = cend - cstart + 1
            if clen < 3:
                continue  # Need at least 3 points in contour

            # Previous and next points in contour (wrap)
            prev_idx = cstart + ((idx - cstart - 1) % clen)
            next_idx = cstart + ((idx - cstart + 1) % clen)

            px, py = coords[idx]
            prev_x, prev_y = coords[prev_idx]
            next_x, next_y = coords[next_idx]

            # New points: on-curve near prev, off-curve at corner, on-curve near next
            on1 = [round(px + (prev_x - px) * radius), round(py + (prev_y - py) * radius)]
            off = [px, py]  # the original corner becomes the off-curve control point
            on2 = [round(px + (next_x - px) * radius), round(py + (next_y - py) * radius)]

            insertions.append((idx, on1, off, on2))

        # Apply insertions (reverse order preserves indices)
        for idx, on1, off, on2 in insertions:
            # Replace the single on-curve point with 3 points: on, off, on
            coords[idx:idx+1] = [on1, off, on2]
            flags[idx:idx+1] = [1, 0, 1]

            # Fix endPts — shift all endpoints after idx by +2 (net gain = 2 points)
            ci_target, cstart, cend = get_contour(idx)
            # Actually recalculate properly after each insertion
            # Since we're in reverse order, we adjust endPts for points at/after idx
            for i in range(len(endPts)):
                if endPts[i] >= idx:
                    endPts[i] += 2

        g.coordinates = GlyphCoordinates([(c[0], c[1]) for c in coords])
        g.flags = array.array('B', flags)
        g.endPtsOfContours = endPts
        g.numberOfContours = len(endPts)
        g.recalcBounds(glyf)

        editor_state['modified'] = True
        _invalidate()

        return jsonify({
            'status': 'success',
            'glyph': _glyph_info(name),
            'cache_version': _font_cache['version'],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/save', methods=['POST'])
def save_font():
    try:
        font = editor_state['font']
        if not font:
            return jsonify({'error': 'No font loaded'}), 400

        d = request.get_json() or {}
        filename = d.get('filename', '')
        if filename:
            out = os.path.join(_fonts_dir, secure_filename(filename))
        else:
            out = editor_state['font_path']

        font.save(out)
        editor_state['modified'] = False

        return jsonify({
            'status': 'success',
            'path': out,
            'filename': os.path.basename(out),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --------------- launch ---------------

def _open_browser():
    import time
    time.sleep(1.5)
    webbrowser.open('http://127.0.0.1:5001')


if __name__ == '__main__':
    print("=" * 50)
    print("  Hebrew Font Editor — http://127.0.0.1:5001")
    print("=" * 50)
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        threading.Thread(target=_open_browser, daemon=True).start()
    app.run(debug=True, host='127.0.0.1', port=5001)
