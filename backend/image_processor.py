"""
Image processing module for detecting and extracting letters from images
"""

import cv2
import numpy as np
from PIL import Image
import os
from config import Config

class LetterDetector:
    """Detect letters from image using contour detection and image processing"""
    
    def __init__(self):
        self.min_size = Config.MIN_LETTER_SIZE
        self.max_size = Config.MAX_LETTER_SIZE
    
    def load_image(self, image_path):
        """Load image from file"""
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Failed to load image: {image_path}")
        return img
    
    def preprocess_image(self, image, separation_level=1):
        """
        Preprocess image for letter detection.
        Returns a binary image where letters are WHITE (255) on BLACK (0) background.
        
        Args:
            separation_level: 0-5, controls morphological opening strength for
                              separating touching characters. Higher = more aggressive.
                              0 = no separation, 1 = light (default), 5 = heavy.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply bilateral filter to reduce noise while preserving edges
        blurred = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # Enhance contrast with CLAHE
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(blurred)
        
        # Try Otsu thresholding first (works better for clean font sheets)
        _, binary_otsu = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        # Also try adaptive thresholding
        binary_adaptive = cv2.adaptiveThreshold(
            enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 25, 10
        )
        
        # Use Otsu if it has reasonable coverage (cleaner result for font sheets)
        otsu_coverage = np.count_nonzero(binary_otsu) / binary_otsu.size
        if 0.01 < otsu_coverage < 0.6:
            binary = binary_otsu
        else:
            binary = binary_adaptive
        
        # Light morphological opening to separate barely-touching letters
        # separation_level controls kernel size and iterations
        if separation_level > 0:
            kernel_size = 2 + separation_level  # 3 at level 1, up to 7 at level 5
            iterations = 1 if separation_level <= 2 else (2 if separation_level <= 4 else 3)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
            binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=iterations)
        
        return binary
    
    def detect_letters(self, image_path, separation_level=1):
        """
        Detect letters in image and return their bounding boxes and contours.
        
        Args:
            image_path: path to the image file
            separation_level: 0-5, controls how aggressively touching chars are separated
        
        Returns: list of letter dicts, original image, binary image
        """
        image = self.load_image(image_path)
        binary = self.preprocess_image(image, separation_level=separation_level)
        
        # Find contours (binary should have white letters on black background)
        contours, hierarchy = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        img_h, img_w = image.shape[:2]
        
        # Separate into "normal" letters and "tiny" fragments (potential dots)
        # We use a smaller min size for fragments so dots are not lost
        tiny_min = max(8, self.min_size // 6)  # ~8px minimum for dots
        
        letters = []
        fragments = []  # small pieces that might be dots of ! ? ; : etc.
        
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            
            # Filter out truly tiny noise (< 8px)
            if w < tiny_min or h < tiny_min:
                continue
            
            # Filter out contours that span the entire image (background)
            if w > img_w * 0.9 and h > img_h * 0.9:
                continue
            
            # Filter by max size
            if w > self.max_size or h > self.max_size:
                continue
            
            # Calculate aspect ratio (filter out very elongated shapes like lines)
            aspect_ratio = float(w) / h if h != 0 else 0
            if aspect_ratio < 0.15 or aspect_ratio > 6:
                continue
            
            # Calculate contour area and fill ratio
            area = cv2.contourArea(contour)
            bbox_area = w * h
            fill_ratio = area / bbox_area if bbox_area > 0 else 0
            
            # Very low fill ratio means it's noise, not a letter
            if fill_ratio < 0.08:
                continue
            
            entry = {
                'bbox': (x, y, w, h),
                'contour': contour,
                'fill_ratio': fill_ratio,
                'area': area
            }
            
            # Below normal min_size → it's a fragment (dot candidate)
            if w < self.min_size or h < self.min_size:
                fragments.append(entry)
            else:
                letters.append(entry)
        
        # --- Auto-merge nearby fragments (e.g. dots of ! ? ; : i) ---
        # Merge fragments into letters, and also merge small letters into larger ones
        letters = self._merge_fragments(letters, fragments)
        
        # Sort by position: top-to-bottom first (group by rows), then right-to-left (Hebrew)
        if letters:
            # Determine row grouping based on average letter height
            avg_h = np.mean([l['bbox'][3] for l in letters])
            row_threshold = avg_h * 0.5
            
            # Sort by y first to group into rows
            letters.sort(key=lambda l: l['bbox'][1])
            
            # Group into rows
            rows = []
            current_row = [letters[0]]
            for letter in letters[1:]:
                if abs(letter['bbox'][1] - current_row[0]['bbox'][1]) < row_threshold:
                    current_row.append(letter)
                else:
                    rows.append(current_row)
                    current_row = [letter]
            rows.append(current_row)
            
            # Sort each row right-to-left (Hebrew reading direction)
            sorted_letters = []
            for row in rows:
                row.sort(key=lambda l: l['bbox'][0], reverse=True)
                sorted_letters.extend(row)
            
            letters = sorted_letters
        
        return letters, image, binary
    
    def _merge_fragments(self, letters, extra_fragments=None):
        """
        Merge small fragments that belong to the same character.
        Handles punctuation like ! ? ; : i where the dot is a separate contour.
        
        Args:
            letters: detected letters that pass the normal min_size filter
            extra_fragments: tiny contours (below min_size) that might be dots
        
        Strategy: 
        1. Try to merge extra_fragments into the nearest letter
        2. Then also try to merge small letters into larger nearby ones
        """
        # Combine letters + fragments for the merge pass.
        # Fragments that don't merge will be discarded (too small to be standalone).
        all_items = list(letters)
        fragment_start_idx = len(all_items)
        if extra_fragments:
            all_items.extend(extra_fragments)
        
        if len(all_items) < 2:
            return letters  # nothing to merge
        
        # Compute median area of LETTERS only (not fragments) for threshold
        if letters:
            letter_areas = [l['area'] for l in letters]
            median_area = np.median(letter_areas)
            heights = [l['bbox'][3] for l in letters]
            median_h = np.median(heights)
        else:
            return letters
        
        # A contour is "small" if its area is less than 25% of the median letter area
        small_threshold = median_area * 0.25
        
        # Maximum vertical gap (fraction of median letter height)
        max_gap = median_h * 0.8
        
        # Mark which items should be merged into which
        merged_into = {}  # small_idx -> large_idx
        
        for i, small in enumerate(all_items):
            # Extra fragments are always candidates for merging;
            # letters are candidates only if they're small relative to median
            is_fragment = i >= fragment_start_idx
            if not is_fragment and small['area'] >= small_threshold:
                continue  # normal-sized letter, skip
            
            sx, sy, sw, sh = small['bbox']
            s_cx = sx + sw / 2  # horizontal center
            
            best_target = None
            best_dist = float('inf')
            
            for j, large in enumerate(all_items):
                if i == j:
                    continue
                if j in merged_into:
                    continue  # already merged into something else
                # Don't merge a fragment into another fragment
                if j >= fragment_start_idx:
                    continue
                
                lx, ly, lw, lh = large['bbox']
                l_cx = lx + lw / 2
                
                # Check horizontal alignment: centers must be within
                # max(half of the larger width, half of the small width)
                h_tolerance = max(lw, sw) * 0.6
                if abs(s_cx - l_cx) > h_tolerance:
                    continue
                
                # Check vertical proximity
                # Vertical gap = distance between the closest edges
                if sy + sh <= ly:
                    # small is above large
                    v_gap = ly - (sy + sh)
                elif ly + lh <= sy:
                    # small is below large
                    v_gap = sy - (ly + lh)
                else:
                    # overlapping vertically — definitely merge
                    v_gap = 0
                
                if v_gap > max_gap:
                    continue
                
                # Prefer the closest target
                dist = v_gap + abs(s_cx - l_cx) * 0.5
                if dist < best_dist:
                    best_dist = dist
                    best_target = j
            
            if best_target is not None:
                merged_into[i] = best_target
        
        # Now build merged letters list
        # For each target, expand its bbox to include the small fragment(s)
        merges = {}  # target_idx -> list of small_idx
        for small_idx, target_idx in merged_into.items():
            merges.setdefault(target_idx, []).append(small_idx)
        
        result = []
        skip = set(merged_into.keys())
        
        for idx, item in enumerate(all_items):
            if idx in skip:
                continue
            
            # Unmerged fragments (tiny contours that didn't match any letter) are discarded
            if idx >= fragment_start_idx:
                continue
            
            if idx in merges:
                # Expand bounding box to include all fragments
                x, y, w, h = item['bbox']
                x2 = x + w
                y2 = y + h
                
                all_contours = [item['contour']]
                total_area = item['area']
                
                for frag_idx in merges[idx]:
                    frag = all_items[frag_idx]
                    fx, fy, fw, fh = frag['bbox']
                    x = min(x, fx)
                    y = min(y, fy)
                    x2 = max(x2, fx + fw)
                    y2 = max(y2, fy + fh)
                    all_contours.append(frag['contour'])
                    total_area += frag['area']
                
                merged_contour = np.vstack(all_contours)
                merged_w = x2 - x
                merged_h = y2 - y
                
                result.append({
                    'bbox': (x, y, merged_w, merged_h),
                    'contour': merged_contour,
                    'fill_ratio': total_area / (merged_w * merged_h) if merged_w * merged_h > 0 else 0,
                    'area': total_area
                })
            else:
                result.append(item)
        
        return result
    
    def extract_letter_image(self, image, x, y, w, h, padding=10):
        """Extract individual letter image with padding"""
        # Add padding
        x1 = max(0, x - padding)
        y1 = max(0, y - padding)
        x2 = min(image.shape[1], x + w + padding)
        y2 = min(image.shape[0], y + h + padding)
        
        letter_img = image[y1:y2, x1:x2]
        return letter_img
    
    def draw_detections(self, image, letters):
        """Draw detected letters on image for visualization"""
        result = image.copy()
        
        for letter in letters:
            x, y, w, h = letter['bbox']
            cv2.rectangle(result, (x, y), (x + w, y + h), (0, 255, 0), 2)
        
        return result

class GlyphExtractor:
    """Extract glyph outlines from letter images for font creation"""
    
    def __init__(self):
        self.font_size = Config.FONT_SIZE
    
    def _smooth_contour_pts(self, pts, window):
        """
        Smooth contour points with circular (wrap-around) averaging.
        pts: numpy array of shape (N, 2)
        window: odd integer for averaging window size
        """
        n = len(pts)
        if n <= window or window < 3:
            return pts
        half = window // 2
        # Create circular index offsets
        offsets = np.arange(-half, half + 1)
        indices = (np.arange(n)[:, None] + offsets[None, :]) % n  # (N, window)
        # Average over the window for each point
        smoothed = pts[indices].mean(axis=1)
        return smoothed
    
    def extract_glyph_contours(self, binary_image, bbox, padding=4, original_image=None):
        """
        Extract all contours (outer + holes) for a single letter region
        with high fidelity for smooth font outlines.
        
        Args:
            binary_image: full binary image (white letters on black bg)
            bbox: (x, y, w, h) bounding box of the letter
            padding: extra pixels around the bbox
            original_image: if provided, a clean Otsu threshold is done on
                            the original crop for maximum fidelity
            
        Returns:
            list of dicts: [{'points': [(x,y),...], 'is_hole': bool}, ...]
            Points are in bbox-relative coordinates (float).
        """
        x, y, w, h = bbox
        img_h, img_w = binary_image.shape[:2]
        
        # Crop region with padding
        x1 = max(0, x - padding)
        y1 = max(0, y - padding)
        x2 = min(img_w, x + w + padding)
        y2 = min(img_h, y + h + padding)
        
        # If original image is available, do a CLEAN threshold on the crop
        # (avoids bilateral filter / CLAHE / morph-open distortion)
        if original_image is not None:
            orig_crop = original_image[y1:y2, x1:x2]
            gray = cv2.cvtColor(orig_crop, cv2.COLOR_BGR2GRAY)
            _, crop = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        else:
            crop = binary_image[y1:y2, x1:x2].copy()
        
        # Offset from crop origin to bbox origin
        ox = x - x1  # typically = padding
        oy = y - y1
        
        # Get ALL contour points at pixel level for maximum fidelity
        contours, hierarchy = cv2.findContours(
            crop, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE
        )
        
        if not contours or hierarchy is None:
            return []
        
        result = []
        hierarchy = hierarchy[0]  # shape: (N, 4)
        
        for i, contour in enumerate(contours):
            if len(contour) < 6:
                continue
            
            # Check if this is a hole (has a parent in hierarchy)
            # hierarchy[i] = [next, prev, child, parent]
            is_hole = hierarchy[i][3] >= 0
            
            # Get points as float array and convert to bbox-relative coords
            pts = contour.reshape(-1, 2).astype(np.float64)
            pts[:, 0] -= ox
            pts[:, 1] -= oy
            
            n = len(pts)
            
            # Smooth the contour to remove pixel-level staircase noise
            smooth_window = max(3, min(9, n // 50))
            if smooth_window % 2 == 0:
                smooth_window += 1
            pts = self._smooth_contour_pts(pts, smooth_window)
            
            # Subsample to a reasonable number of control points
            target_n = max(24, min(100, n // 4))
            if n > target_n:
                indices = np.round(np.linspace(0, n - 1, target_n)).astype(int)
                pts = pts[indices]
            
            points = [(float(p[0]), float(p[1])) for p in pts]
            
            result.append({
                'points': points,
                'is_hole': is_hole
            })
        
        return result
    
    def contour_to_bezier_points(self, contour, num_points=100):
        """
        Legacy: Convert contour to bezier curve points.
        Kept for backward compatibility.
        """
        if len(contour) < 3:
            return None
        
        epsilon = 0.02 * cv2.arcLength(contour, True)
        simplified = cv2.approxPolyDP(contour, epsilon, True)
        
        if len(simplified) < 3:
            return None
        
        x, y, w, h = cv2.boundingRect(simplified)
        
        normalized_points = []
        for point in simplified:
            px = point[0][0]
            py = point[0][1]
            nx = ((px - x) / w * self.font_size) if w > 0 else 0
            ny = ((py - y) / h * self.font_size) if h > 0 else 0
            normalized_points.append((int(nx), int(ny)))
        
        return normalized_points
    
    def smooth_contour(self, contour, kernel_size=5):
        """Smooth contour using morphological operations"""
        mask = np.zeros((max(int(np.max(contour[:, 0, 1])) + 10, 100),
                        max(int(np.max(contour[:, 0, 0])) + 10, 100)), dtype=np.uint8)
        cv2.drawContours(mask, [contour], 0, 255, -1)
        
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        smoothed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        smoothed = cv2.morphologyEx(smoothed, cv2.MORPH_OPEN, kernel)
        
        contours, _ = cv2.findContours(smoothed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            return max(contours, key=cv2.contourArea)
        return contour

if __name__ == '__main__':
    # Test image processing
    detector = LetterDetector()
    print("Image processor module loaded successfully")
