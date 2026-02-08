"""
Flask API backend for Hebrew Font Maker
"""

from flask import Flask, request, jsonify, send_file, send_from_directory
try:
    from flask_cors import CORS
except ImportError:
    # Fallback if flask-cors not installed
    CORS = lambda app: None

import os
import io
import json
import sys
import base64
import cv2
import numpy as np
import threading
import webbrowser
from datetime import datetime
from werkzeug.utils import secure_filename

# Ensure parent directory is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from config import Config
    from backend.image_processor import LetterDetector, GlyphExtractor
    from backend.font_generator import FontCreator
    from backend.hebrew_support import HebrewReader, HEBREW_LETTERS
except ImportError:
    # Fallback for direct execution
    from config import Config
    from image_processor import LetterDetector, GlyphExtractor
    from font_generator import FontCreator
    from hebrew_support import HebrewReader, HEBREW_LETTERS

# Resolve frontend directory path
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_frontend_dir = os.path.join(_project_root, 'frontend')

app = Flask(__name__, static_folder=_frontend_dir, static_url_path='')
CORS(app)
app.config.from_object(Config)

# Initialize processors
letter_detector = LetterDetector()
glyph_extractor = GlyphExtractor()

# Store current session data
current_session = {
    'upload_path': None,
    'detected_letters': [],
    'verified_glyphs': {},
    'original_image': None,
    'binary_image': None,
    'processed_image': None
}

@app.route('/')
def serve_frontend():
    """Serve the frontend UI"""
    return send_from_directory(_frontend_dir, 'index.html')

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Hebrew Font Maker API is running'})

@app.route('/api/upload', methods=['POST'])
def upload_image():
    """Upload image and detect letters"""
    try:
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file type
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}
        if not ('.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return jsonify({'error': 'Invalid file type. Allowed: ' + ', '.join(allowed_extensions)}), 400
        
        # Save file
        filename = secure_filename(f"upload_{datetime.now().timestamp()}.png")
        upload_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(upload_path)
        
        current_session['upload_path'] = upload_path
        
        # Get separation level from form data (default=1)
        separation_level = int(request.form.get('separation_level', 1))
        separation_level = max(0, min(5, separation_level))
        current_session['separation_level'] = separation_level
        
        # Detect letters
        letters, original_image, processed_image = letter_detector.detect_letters(
            upload_path, separation_level=separation_level
        )
        
        # Store image info
        current_session['detected_letters'] = letters
        current_session['original_image'] = original_image
        current_session['binary_image'] = processed_image
        
        # Prepare response with letter detections + cropped images as base64
        detection_data = []
        for idx, letter in enumerate(letters):
            x, y, w, h = letter['bbox']
            
            # Crop the letter from the original image
            padding = 6
            x1 = max(0, x - padding)
            y1 = max(0, y - padding)
            x2 = min(original_image.shape[1], x + w + padding)
            y2 = min(original_image.shape[0], y + h + padding)
            cropped = original_image[y1:y2, x1:x2]
            
            # Encode as base64 PNG
            _, buffer = cv2.imencode('.png', cropped)
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            
            detection_data.append({
                'id': idx,
                'bbox': {'x': x, 'y': y, 'w': w, 'h': h},
                'area': letter['area'],
                'fill_ratio': letter['fill_ratio'],
                'image': img_base64
            })
        
        return jsonify({
            'status': 'success',
            'message': f'Detected {len(letters)} potential letters',
            'count': len(letters),
            'detections': detection_data,
            'image_info': {
                'width': original_image.shape[1],
                'height': original_image.shape[0]
            }
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/redetect', methods=['POST'])
def redetect_letters():
    """
    Re-run letter detection on the already uploaded image with a different
    separation level. Useful when characters are too close together.
    """
    try:
        upload_path = current_session.get('upload_path')
        if not upload_path or not os.path.exists(upload_path):
            return jsonify({'error': 'No image uploaded yet. Please upload first.'}), 400
        
        data = request.get_json()
        separation_level = int(data.get('separation_level', 1))
        separation_level = max(0, min(5, separation_level))
        current_session['separation_level'] = separation_level
        
        # Re-detect with new separation level
        letters, original_image, processed_image = letter_detector.detect_letters(
            upload_path, separation_level=separation_level
        )
        
        current_session['detected_letters'] = letters
        current_session['original_image'] = original_image
        current_session['binary_image'] = processed_image
        current_session['verified_glyphs'] = {}  # reset assignments
        
        # Build detection data the same way as upload
        detection_data = []
        for idx, letter in enumerate(letters):
            x, y, w, h = letter['bbox']
            padding = 6
            x1 = max(0, x - padding)
            y1 = max(0, y - padding)
            x2 = min(original_image.shape[1], x + w + padding)
            y2 = min(original_image.shape[0], y + h + padding)
            cropped = original_image[y1:y2, x1:x2]
            _, buffer = cv2.imencode('.png', cropped)
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            
            detection_data.append({
                'id': idx,
                'bbox': {'x': x, 'y': y, 'w': w, 'h': h},
                'area': letter['area'],
                'fill_ratio': letter['fill_ratio'],
                'image': img_base64
            })
        
        return jsonify({
            'status': 'success',
            'message': f'Re-detected {len(letters)} potential letters (separation={separation_level})',
            'count': len(letters),
            'detections': detection_data,
            'image_info': {
                'width': original_image.shape[1],
                'height': original_image.shape[0]
            }
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _build_detection_response():
    """Helper: build detection_data list from current_session['detected_letters']."""
    original_image = current_session['original_image']
    detection_data = []
    for idx, letter in enumerate(current_session['detected_letters']):
        x, y, w, h = letter['bbox']
        padding = 6
        x1 = max(0, x - padding)
        y1 = max(0, y - padding)
        x2 = min(original_image.shape[1], x + w + padding)
        y2 = min(original_image.shape[0], y + h + padding)
        cropped = original_image[y1:y2, x1:x2]
        _, buffer = cv2.imencode('.png', cropped)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        detection_data.append({
            'id': idx,
            'bbox': {'x': x, 'y': y, 'w': w, 'h': h},
            'area': letter['area'],
            'fill_ratio': letter['fill_ratio'],
            'image': img_base64
        })
    return detection_data

@app.route('/api/original-image', methods=['GET'])
def get_original_image():
    """Return the uploaded original image as base64 for canvas display."""
    try:
        original_image = current_session.get('original_image')
        if original_image is None:
            return jsonify({'error': 'No image uploaded'}), 400
        _, buffer = cv2.imencode('.jpg', original_image, [cv2.IMWRITE_JPEG_QUALITY, 85])
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        return jsonify({
            'image': img_base64,
            'width': original_image.shape[1],
            'height': original_image.shape[0]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/add-detection', methods=['POST'])
def add_detection():
    """
    Manually add a detection bounding box.
    Expects: { x, y, w, h } in original image coordinates.
    """
    try:
        original_image = current_session.get('original_image')
        if original_image is None:
            return jsonify({'error': 'No image uploaded'}), 400
        
        data = request.get_json()
        x = int(data['x'])
        y = int(data['y'])
        w = int(data['w'])
        h = int(data['h'])
        
        # Clamp to image bounds
        img_h, img_w = original_image.shape[:2]
        x = max(0, min(x, img_w - 1))
        y = max(0, min(y, img_h - 1))
        w = min(w, img_w - x)
        h = min(h, img_h - y)
        
        if w < 4 or h < 4:
            return jsonify({'error': 'Box too small'}), 400
        
        # Create a contour from the bounding box (for compatibility)
        contour = np.array([
            [[x, y]], [[x + w, y]], [[x + w, y + h]], [[x, y + h]]
        ], dtype=np.int32)
        
        area = w * h
        new_letter = {
            'bbox': (x, y, w, h),
            'contour': contour,
            'fill_ratio': 1.0,
            'area': area
        }
        current_session['detected_letters'].append(new_letter)
        
        detection_data = _build_detection_response()
        
        return jsonify({
            'status': 'success',
            'count': len(detection_data),
            'detections': detection_data
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/remove-detection', methods=['POST'])
def remove_detection():
    """
    Remove a detection by index.
    Expects: { id: <index> }
    """
    try:
        data = request.get_json()
        det_id = int(data['id'])
        letters = current_session.get('detected_letters', [])
        
        if det_id < 0 or det_id >= len(letters):
            return jsonify({'error': 'Invalid detection id'}), 400
        
        letters.pop(det_id)
        current_session['detected_letters'] = letters
        
        detection_data = _build_detection_response()
        
        return jsonify({
            'status': 'success',
            'count': len(detection_data),
            'detections': detection_data
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/assign-letters', methods=['POST'])
def assign_letters():
    """
    Assign detected areas to characters.
    Expects: { assignments: [ {detection_id: 0, hebrew_char: 'א'}, ... ] }
    """
    try:
        data = request.get_json()
        assignments = data.get('assignments', [])
        
        if not assignments:
            return jsonify({'error': 'No assignments provided'}), 400
        
        # Validate and store assignments
        current_session['verified_glyphs'] = {}
        
        for assignment in assignments:
            detection_id = assignment.get('detection_id')
            hebrew_char = assignment.get('hebrew_char')
            manual_label = assignment.get('manual_label', '')
            
            if detection_id is None or detection_id >= len(current_session['detected_letters']):
                continue
            
            # Accept any single character (Hebrew, Latin, digit, punctuation)
            if not hebrew_char or len(hebrew_char) != 1:
                continue
            
            letter = current_session['detected_letters'][detection_id]
            x, y, w, h = letter['bbox']
            
            current_session['verified_glyphs'][hebrew_char] = {
                'detection_id': detection_id,
                'bbox': (x, y, w, h),
                'label': manual_label,
                'confirmed': True
            }
        
        return jsonify({
            'status': 'success',
            'message': f'Assigned {len(current_session["verified_glyphs"])} letters',
            'assigned_count': len(current_session['verified_glyphs'])
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-font', methods=['POST'])
def generate_font():
    """
    Generate TTF font from verified glyphs
    """
    try:
        data = request.get_json()
        font_name = data.get('font_name', 'HebrewFont')
        adjustments = data.get('adjustments', {})  # { char: {scale, offsetX, offsetY} }
        
        if not current_session['verified_glyphs']:
            return jsonify({'error': 'No verified glyphs. Please verify letters first.'}), 400
        
        # Create font
        metadata = data.get('metadata', {})
        creator = FontCreator(font_name=font_name, units_per_em=1024, metadata=metadata)
        
        # Get the binary image for contour extraction
        binary_image = current_session.get('binary_image')
        if binary_image is None:
            # Re-process if binary not stored
            image = letter_detector.load_image(current_session['upload_path'])
            binary_image = letter_detector.preprocess_image(image)
        
        # Use client's refHeight for exact preview-to-font match.
        # The client computes this from assigned detections' bbox heights.
        # Fallback: compute from all detections if not provided.
        ref_height = data.get('ref_height', 0)
        if not ref_height:
            ref_height = 0
            for ltr in current_session['detected_letters']:
                _, _, _, lh = ltr['bbox']
                ref_height = max(ref_height, lh)
        
        for hebrew_char, glyph_info in current_session['verified_glyphs'].items():
            detection_id = glyph_info['detection_id']
            letter = current_session['detected_letters'][detection_id]
            x, y, w, h = letter['bbox']
            
            # Extract all contours (outer + holes) from the original image
            # (using original avoids preprocessing distortion from bilateral/CLAHE/morph)
            original_image = current_session.get('original_image')
            contour_data = glyph_extractor.extract_glyph_contours(
                binary_image, (x, y, w, h), original_image=original_image
            )
            
            # Get per-character adjustments if any
            char_adj = adjustments.get(hebrew_char, {})
            adj_scale = char_adj.get('scale', 100) / 100.0
            adj_offset_x = char_adj.get('offsetX', 0)
            adj_offset_y = char_adj.get('offsetY', 0)
            adj_spacing = char_adj.get('spacing', 0)
            
            if adj_scale != 1.0 or adj_offset_x != 0 or adj_offset_y != 0:
                px_to_font = 750.0 / 80.0
                computed_fy = round(-adj_offset_y * px_to_font * adj_scale)
                computed_fx = round(adj_offset_x * px_to_font * adj_scale)
                print(f"  Glyph '{hebrew_char}': scale={adj_scale:.0%}, "
                      f"offsetX={adj_offset_x}→{computed_fx}fu, "
                      f"offsetY={adj_offset_y}→{computed_fy}fu")
            
            if contour_data:
                # Use the new multi-contour method with proper aspect ratio
                creator.add_glyph_from_contours(
                    hebrew_char, contour_data, w, h,
                    scale_factor=adj_scale,
                    offset_x=adj_offset_x,
                    offset_y=adj_offset_y,
                    spacing=adj_spacing,
                    reference_height=ref_height
                )
            else:
                # Fallback to legacy single-contour method
                contour = letter['contour']
                smoothed_contour = glyph_extractor.smooth_contour(contour)
                points = glyph_extractor.contour_to_bezier_points(smoothed_contour)
                if points:
                    creator.add_glyph(hebrew_char, points, width=int(max(h, w) * 0.7))
        
        # Save font
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_filename = secure_filename(f"{font_name}_{timestamp}.ttf")
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)
        
        success, result = creator.save_font(output_path)
        
        if success:
            return jsonify({
                'status': 'success',
                'message': 'Font generated successfully',
                'filename': output_filename,
                'path': output_path,
                'glyph_count': len(current_session['verified_glyphs'])
            }), 200
        else:
            return jsonify({'error': f'Font generation failed: {result}'}), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/preview', methods=['GET'])
def preview_detection():
    """Get preview of detected letters"""
    try:
        if not current_session['upload_path']:
            return jsonify({'error': 'No image uploaded'}), 400
        
        preview_data = {
            'detected_count': len(current_session['detected_letters']),
            'verified_count': len(current_session['verified_glyphs']),
            'verified_letters': list(current_session['verified_glyphs'].keys()),
            'hebrew_alphabet': list(HEBREW_LETTERS.keys()),
            'hebrew_count': len(HEBREW_LETTERS)
        }
        
        return jsonify(preview_data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/open-output-folder', methods=['POST'])
def open_output_folder():
    """Open the fonts_output folder in Windows Explorer"""
    try:
        folder = os.path.abspath(app.config['OUTPUT_FOLDER'])
        os.makedirs(folder, exist_ok=True)
        import subprocess
        subprocess.Popen(['explorer', folder])
        return jsonify({'status': 'success', 'path': folder}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/session-clear', methods=['POST'])
def clear_session():
    """Clear current session"""
    global current_session
    current_session = {
        'upload_path': None,
        'detected_letters': [],
        'verified_glyphs': {},
        'original_image': None,
        'binary_image': None,
        'processed_image': None
    }
    return jsonify({'status': 'success', 'message': 'Session cleared'}), 200

@app.route('/api/merge-detections', methods=['POST'])
def merge_detections():
    """
    Merge multiple detections into one.
    Expects: { ids: [0, 3, 7] }  -- indices of detections to merge
    Returns updated detection list with merged entries.
    """
    try:
        data = request.get_json()
        ids = data.get('ids', [])
        
        if len(ids) < 2:
            return jsonify({'error': 'Select at least 2 detections to merge'}), 400
        
        letters = current_session['detected_letters']
        original_image = current_session['original_image']
        
        if not letters or original_image is None:
            return jsonify({'error': 'No detections available'}), 400
        
        # Validate all ids
        for idx in ids:
            if idx < 0 or idx >= len(letters):
                return jsonify({'error': f'Invalid detection id: {idx}'}), 400
        
        # Compute merged bounding box
        to_merge = [letters[i] for i in ids]
        x_min = min(l['bbox'][0] for l in to_merge)
        y_min = min(l['bbox'][1] for l in to_merge)
        x_max = max(l['bbox'][0] + l['bbox'][2] for l in to_merge)
        y_max = max(l['bbox'][1] + l['bbox'][3] for l in to_merge)
        
        merged_contour = np.vstack([l['contour'] for l in to_merge])
        total_area = sum(l['area'] for l in to_merge)
        merged_w = x_max - x_min
        merged_h = y_max - y_min
        
        merged_letter = {
            'bbox': (x_min, y_min, merged_w, merged_h),
            'contour': merged_contour,
            'fill_ratio': total_area / (merged_w * merged_h) if merged_w * merged_h > 0 else 0,
            'area': total_area
        }
        
        # Rebuild the list: remove merged indices, insert merged one at the position of the first
        ids_set = set(ids)
        insert_pos = min(ids)
        new_letters = []
        inserted = False
        for i, letter in enumerate(letters):
            if i in ids_set:
                if not inserted:
                    new_letters.append(merged_letter)
                    inserted = True
                # skip others
            else:
                new_letters.append(letter)
        
        current_session['detected_letters'] = new_letters
        
        # Rebuild detection_data response (same format as upload)
        detection_data = _build_detection_data(new_letters, original_image)
        
        return jsonify({
            'status': 'success',
            'message': f'Merged {len(ids)} detections into 1',
            'count': len(new_letters),
            'detections': detection_data
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/split-detection', methods=['POST'])
def split_detection():
    """
    Split a single detection into its connected components.
    Expects: { id: 3 }  -- index of detection to split
    Returns updated detection list with split entries.
    """
    try:
        data = request.get_json()
        det_id = data.get('id')
        
        if det_id is None:
            return jsonify({'error': 'No detection id provided'}), 400
        
        letters = current_session['detected_letters']
        original_image = current_session['original_image']
        binary_image = current_session.get('binary_image')
        
        if not letters or original_image is None:
            return jsonify({'error': 'No detections available'}), 400
        
        if det_id < 0 or det_id >= len(letters):
            return jsonify({'error': f'Invalid detection id: {det_id}'}), 400
        
        target = letters[det_id]
        x, y, w, h = target['bbox']
        
        # Crop the binary image for this detection and find connected components
        padding = 4
        img_h, img_w = binary_image.shape[:2]
        x1 = max(0, x - padding)
        y1 = max(0, y - padding)
        x2 = min(img_w, x + w + padding)
        y2 = min(img_h, y + h + padding)
        crop = binary_image[y1:y2, x1:x2]
        
        # Find separate contours in this region
        contours, _ = cv2.findContours(crop, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if len(contours) < 2:
            return jsonify({'error': 'לא ניתן לפצל - זוהה רכיב אחד בלבד'}), 400
        
        # Create a new detection for each contour
        new_parts = []
        for contour in contours:
            cx, cy, cw, ch = cv2.boundingRect(contour)
            if cw < 5 or ch < 5:
                continue  # skip tiny noise
            
            # Convert back to full-image coords
            abs_x = x1 + cx
            abs_y = y1 + cy
            
            # Shift contour points to absolute coords
            contour_abs = contour.copy()
            contour_abs[:, 0, 0] += x1
            contour_abs[:, 0, 1] += y1
            
            area = cv2.contourArea(contour)
            new_parts.append({
                'bbox': (abs_x, abs_y, cw, ch),
                'contour': contour_abs,
                'fill_ratio': area / (cw * ch) if cw * ch > 0 else 0,
                'area': area
            })
        
        if len(new_parts) < 2:
            return jsonify({'error': 'לא ניתן לפצל - רכיב אחד משמעותי בלבד'}), 400
        
        # Sort parts right-to-left (Hebrew)
        new_parts.sort(key=lambda p: p['bbox'][0], reverse=True)
        
        # Replace the original detection with the split parts
        new_letters = letters[:det_id] + new_parts + letters[det_id + 1:]
        current_session['detected_letters'] = new_letters
        
        # Rebuild detection_data response
        detection_data = _build_detection_data(new_letters, original_image)
        
        return jsonify({
            'status': 'success',
            'message': f'Split into {len(new_parts)} parts',
            'split_count': len(new_parts),
            'count': len(new_letters),
            'detections': detection_data
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _build_detection_data(letters_list, original_image):
    """Helper to build the detection data response array."""
    detection_data = []
    for idx, letter in enumerate(letters_list):
        x, y, w, h = letter['bbox']
        padding = 6
        x1 = max(0, x - padding)
        y1 = max(0, y - padding)
        x2 = min(original_image.shape[1], x + w + padding)
        y2 = min(original_image.shape[0], y + h + padding)
        cropped = original_image[y1:y2, x1:x2]
        
        _, buffer = cv2.imencode('.png', cropped)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        detection_data.append({
            'id': idx,
            'bbox': {'x': x, 'y': y, 'w': w, 'h': h},
            'area': letter['area'],
            'fill_ratio': letter['fill_ratio'],
            'image': img_base64
        })
    return detection_data


# ==================== Export / Import Project ====================

@app.route('/api/export-project', methods=['POST'])
def export_project():
    """
    Export the current project state to a .hfm (JSON) file so the user
    can resume editing later.   Includes the original image (base64-encoded)
    so the project is fully self-contained.
    """
    try:
        data = request.get_json() or {}
        font_name = data.get('font_name', 'HebrewFont')
        assignments = data.get('assignments', {})
        adjustments = data.get('adjustments', {})
        metadata = data.get('metadata', {})

        if not current_session.get('upload_path') or not current_session.get('detected_letters'):
            return jsonify({'error': 'אין פרויקט פתוח לייצוא. יש להעלות תמונה קודם.'}), 400

        # Encode the original uploaded image as base64 PNG so the file is portable
        original_image = current_session.get('original_image')
        if original_image is not None:
            _, buf = cv2.imencode('.png', original_image)
            image_b64 = base64.b64encode(buf).decode('utf-8')
        else:
            image_b64 = None

        # Encode the binary (pre-processed) image — needed for contour extraction at font generation
        binary_image = current_session.get('binary_image')
        if binary_image is not None:
            _, buf2 = cv2.imencode('.png', binary_image)
            binary_b64 = base64.b64encode(buf2).decode('utf-8')
        else:
            binary_b64 = None

        # Serialise detected_letters INCLUDING contour data so the exact
        # detections (manual adds/removes/merges) are preserved.
        det_export = []
        for ltr in current_session['detected_letters']:
            entry = {
                'bbox': list(ltr['bbox']),
                'area': int(ltr['area']),
                'fill_ratio': float(ltr['fill_ratio']),
            }
            # Serialize numpy contour to plain list
            cnt = ltr.get('contour')
            if cnt is not None:
                entry['contour'] = np.array(cnt).tolist()
            det_export.append(entry)

        project = {
            'version': 2,
            'font_name': font_name,
            'separation_level': current_session.get('separation_level', 1),
            'assignments': assignments,          # { detId: char }
            'adjustments': adjustments,          # { char: {scale,offsetX,offsetY,spacing} }
            'metadata': metadata,                # { author, description, version, license, url }
            'detections': det_export,            # full detection data with contours
            'image_b64': image_b64,              # full original image
            'binary_b64': binary_b64,            # binary image for contour extraction
        }

        filename = secure_filename(f"{font_name}_project.hfm")
        out_path = os.path.join(app.config['OUTPUT_FOLDER'], filename)
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(project, f, ensure_ascii=False)

        return send_file(out_path, as_attachment=True, download_name=filename,
                         mimetype='application/json')

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/import-project', methods=['POST'])
def import_project():
    """
    Import a previously exported .hfm project file.
    Restores the exact detections (including manual adds/removals/merges)
    without re-detecting.
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'לא נבחר קובץ'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'לא נבחר קובץ'}), 400

        content = file.read().decode('utf-8')
        project = json.loads(content)

        version = project.get('version', 1)
        if version not in (1, 2):
            return jsonify({'error': 'גרסת קובץ לא נתמכת'}), 400

        image_b64 = project.get('image_b64')
        if not image_b64:
            return jsonify({'error': 'קובץ הפרויקט לא מכיל תמונה'}), 400

        # Decode the original image
        img_bytes = base64.b64decode(image_b64)
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        original_image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if original_image is None:
            return jsonify({'error': 'שגיאה בפענוח התמונה'}), 400

        # Save the image to temp so the session has a valid upload_path
        filename = secure_filename(f"import_{datetime.now().timestamp()}.png")
        upload_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        cv2.imwrite(upload_path, original_image)

        separation_level = project.get('separation_level', 1)

        # Decode binary image if present (v2)
        binary_b64 = project.get('binary_b64')
        if binary_b64:
            bin_bytes = base64.b64decode(binary_b64)
            bin_array = np.frombuffer(bin_bytes, dtype=np.uint8)
            binary_image = cv2.imdecode(bin_array, cv2.IMREAD_GRAYSCALE)
        else:
            binary_image = None

        saved_dets = project.get('detections', [])

        if version >= 2 and saved_dets and 'contour' in saved_dets[0]:
            # ── V2: restore exact detections (preserves manual edits) ──
            letters = []
            for det in saved_dets:
                entry = {
                    'bbox': tuple(det['bbox']),
                    'area': det['area'],
                    'fill_ratio': det['fill_ratio'],
                }
                if det.get('contour') is not None:
                    entry['contour'] = np.array(det['contour'], dtype=np.int32)
                else:
                    entry['contour'] = np.array([], dtype=np.int32)
                letters.append(entry)

            # If binary image wasn't saved, regenerate it
            if binary_image is None:
                image = letter_detector.load_image(upload_path)
                binary_image = letter_detector.preprocess_image(
                    image, separation_level=separation_level
                )

            matched_assignments = project.get('assignments', {})
        else:
            # ── V1 fallback: re-detect and match assignments by bbox ──
            letters, original_image, binary_image = letter_detector.detect_letters(
                upload_path, separation_level=separation_level
            )

            old_assignments = project.get('assignments', {})
            matched_assignments = {}

            if len(letters) == len(saved_dets):
                matched_assignments = old_assignments
            else:
                for old_id_str, char in old_assignments.items():
                    old_idx = int(old_id_str)
                    if old_idx >= len(saved_dets):
                        continue
                    ob = saved_dets[old_idx]['bbox']
                    ox, oy = ob[0], ob[1]
                    best_new = None
                    best_dist = 9999999
                    for ni, nl in enumerate(letters):
                        nx, ny = nl['bbox'][0], nl['bbox'][1]
                        d = abs(nx - ox) + abs(ny - oy)
                        if d < best_dist:
                            best_dist = d
                            best_new = ni
                    if best_new is not None and best_dist < 50:
                        matched_assignments[str(best_new)] = char

        # Update session
        current_session['upload_path'] = upload_path
        current_session['separation_level'] = separation_level
        current_session['detected_letters'] = letters
        current_session['original_image'] = original_image
        current_session['binary_image'] = binary_image
        current_session['verified_glyphs'] = {}

        # Build detection response with cropped images
        detection_data = _build_detection_response()

        return jsonify({
            'status': 'success',
            'font_name': project.get('font_name', 'HebrewFont'),
            'assignments': matched_assignments,
            'adjustments': project.get('adjustments', {}),
            'metadata': project.get('metadata', {}),
            'count': len(letters),
            'detections': detection_data,
            'image_info': {
                'width': original_image.shape[1],
                'height': original_image.shape[0]
            }
        }), 200

    except json.JSONDecodeError:
        return jsonify({'error': 'קובץ לא תקין (JSON)'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def open_browser():
    """Open the browser after a short delay to let Flask start"""
    import time
    time.sleep(1.5)
    webbrowser.open('http://127.0.0.1:5000')

if __name__ == '__main__':
    # Auto-open browser (only in the main process, not the reloader)
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        threading.Thread(target=open_browser, daemon=True).start()
    app.run(debug=True, host='127.0.0.1', port=5000)
