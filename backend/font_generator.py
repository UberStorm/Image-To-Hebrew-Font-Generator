"""
Font generation module - creates TTF font files from glyph data
"""

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.transformPen import TransformPen
import os
import logging
from config import Config
from backend.hebrew_support import HebrewReader, HEBREW_LETTERS

logger = logging.getLogger(__name__)

class FontCreator:
    """Create TTF font from glyph data"""
    
    # Descender letters: these extend below the baseline
    # ף=pe-final, ץ=tsadi-final, ן=nun-final, ק=qof, ך=kaf-final
    DESCENDER_CHARS = set('ףץןקך')
    DESCENDER_SHIFT = -200  # font units below baseline
    
    def __init__(self, font_name='HebrewFont', units_per_em=1024, metadata=None):
        self.font_name = font_name
        self.units_per_em = units_per_em
        self.metadata = metadata or {}
        self.glyphs = {}
        self.metrics = {}
        self.glyph_order = ['.notdef', 'space']
        self._char_map = {32: 'space'}  # always include space
        
    def add_glyph_from_contours(self, char, contour_data, src_w, src_h,
                                scale_factor=1.0, offset_x=0, offset_y=0,
                                spacing=0, reference_height=None):
        """
        Add a glyph to the font from multiple contours (supports holes).
        Uses quadratic B-spline curves for smooth outlines matching the design.
        
        Args:
            char: the character this glyph represents
            contour_data: list of {'points': [(x,y),...], 'is_hole': bool}
                          points are in bbox-relative coordinates
            src_w: width of the letter region in pixels
            src_h: height of the letter region in pixels
            scale_factor: user adjustment scale (1.0 = 100%)
            offset_x: horizontal offset in preview pixels
            offset_y: vertical offset in preview pixels
            spacing: advance width adjustment in preview pixels (negative=tighter, positive=wider)
            reference_height: if provided, all letters are scaled uniformly relative
                              to this height (preserves natural proportions)
        
        Returns: True if glyph was added
        """
        if not contour_data:
            return False
        
        # Get glyph name
        if HebrewReader.is_hebrew_char(char):
            glyph_name = HebrewReader.get_letter_name(char)
        else:
            glyph_name = f'uni{ord(char):04X}'
        
        # --- Normalize coordinates preserving aspect ratio ---
        # Use reference_height for uniform scaling across all letters.
        # This preserves natural proportions: a short letter stays short.
        # Without reference_height, falls back to per-letter normalization.
        norm_h = reference_height if reference_height else src_h
        target_h = 750
        base_scale = target_h / norm_h if norm_h > 0 else 1
        scale = base_scale * scale_factor
        target_w = int(src_w * scale)
        
        lsb = 50  # left side bearing
        
        # Convert offset from preview pixels to font units.
        # CSS transform is: scale(S) translate(X, Y) with transformOrigin center bottom.
        # This means translate happens in the SCALED coordinate system,
        # so the actual visual movement is S*X and S*Y pixels.
        # preview_display_h is the CSS max-height of the tallest letter in preview.
        preview_display_h = 80.0
        px_to_font = target_h / preview_display_h  # ~9.375 font units per preview pixel
        
        font_offset_x = round(offset_x * px_to_font * scale_factor)
        font_offset_y = round(-offset_y * px_to_font * scale_factor)  # CSS down = font down (negative Y)
        
        # Descender letters: shift the entire glyph downward so the tail
        # extends below the baseline (y=0) instead of being pushed up
        if char in self.DESCENDER_CHARS:
            font_offset_y += self.DESCENDER_SHIFT
        
        pen = TTGlyphPen(glyphSet=None)
        
        has_contour = False
        for contour in contour_data:
            pts = contour['points']
            if len(pts) < 4:
                continue
            
            # Convert to font coordinates:
            # - Scale with uniform aspect ratio
            # - Flip Y (image y-down → font y-up)
            # - Add left side bearing offset
            font_pts = []
            for px, py in pts:
                fx = round(px * scale) + lsb + font_offset_x
                fy = round((src_h - py) * scale) + font_offset_y
                font_pts.append((fx, fy))
            
            n = len(font_pts)
            
            if n >= 6:
                # ---- Quadratic B-spline approach ----
                # Treat ALL points as off-curve control points.
                # On-curve points are the midpoints between consecutive controls.
                # This produces smooth quadratic Bézier curves that faithfully
                # follow the original letter shapes.
                ctrls = font_pts
                
                # Start point: midpoint of last and first control
                start = (round((ctrls[-1][0] + ctrls[0][0]) / 2),
                         round((ctrls[-1][1] + ctrls[0][1]) / 2))
                
                pen.moveTo(start)
                
                for i in range(len(ctrls)):
                    ctrl = ctrls[i]
                    nc = ctrls[(i + 1) % len(ctrls)]
                    end = (round((ctrl[0] + nc[0]) / 2),
                           round((ctrl[1] + nc[1]) / 2))
                    pen.qCurveTo(ctrl, end)
                
                pen.closePath()
                has_contour = True
            else:
                # Fallback for very small contours: use straight lines
                pen.moveTo(font_pts[0])
                for pt in font_pts[1:]:
                    pen.lineTo(pt)
                pen.closePath()
                has_contour = True
        
        if not has_contour:
            return False
        
        advance_width = target_w + lsb * 2
        
        # Apply spacing adjustment: convert from preview pixels to font units
        if spacing != 0:
            spacing_fu = round(spacing * px_to_font)
            advance_width = max(100, advance_width + spacing_fu * 2)
        
        glyph = pen.glyph()
        self.glyphs[glyph_name] = glyph
        self.metrics[glyph_name] = (advance_width, lsb)
        self._char_map[ord(char)] = glyph_name
        
        if glyph_name not in self.glyph_order:
            self.glyph_order.append(glyph_name)
        
        return True
    
    def add_glyph(self, char, points, width=600):
        """
        Legacy: Add glyph from a single flat list of points.
        Kept for backward compatibility.
        """
        if points is None or len(points) < 3:
            return False
        
        if HebrewReader.is_hebrew_char(char):
            glyph_name = HebrewReader.get_letter_name(char)
        else:
            glyph_name = f'uni{ord(char):04X}'
        
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        src_w = max_x - min_x or 1
        src_h = max_y - min_y or 1
        
        target_h = 750
        scale = target_h / src_h
        target_w = int(src_w * scale)
        lsb = 50
        
        normalized = []
        for px, py in points:
            nx = int((px - min_x) * scale) + lsb
            ny = int((1.0 - (py - min_y) / src_h) * target_h)
            normalized.append((nx, ny))
        
        advance_width = target_w + lsb * 2
        
        pen = TTGlyphPen(glyphSet=None)
        pen.moveTo(normalized[0])
        for point in normalized[1:]:
            pen.lineTo(point)
        pen.closePath()
        
        glyph = pen.glyph()
        self.glyphs[glyph_name] = glyph
        self.metrics[glyph_name] = (advance_width, lsb)
        self._char_map[ord(char)] = glyph_name
        
        if glyph_name not in self.glyph_order:
            self.glyph_order.append(glyph_name)
        
        return True
    
    def _create_notdef_glyph(self):
        """Create .notdef glyph (simple rectangle)"""
        pen = TTGlyphPen(glyphSet=None)
        # Outer rectangle (counter-clockwise for TrueType)
        pen.moveTo((50, 0))
        pen.lineTo((450, 0))
        pen.lineTo((450, 700))
        pen.lineTo((50, 700))
        pen.closePath()
        self.glyphs['.notdef'] = pen.glyph()
        self.metrics['.notdef'] = (500, 50)
    
    def _create_space_glyph(self):
        """Create space glyph (empty, just width)"""
        pen = TTGlyphPen(glyphSet=None)
        # Empty glyph — just a pen with no contours
        self.glyphs['space'] = pen.glyph()
        self.metrics['space'] = (250, 0)
    
    # Common characters to auto-fill from a fallback font when missing
    FALLBACK_CHARS = (
        # Digits
        '0123456789'
        # Basic punctuation
        '!?.,;:\'"'
        # Brackets & delimiters
        '()[]{}/<>'
        # Math & symbols
        '+-=*@#$%^&~_|\\'
        # Hebrew punctuation
        '\u05BE'   # ־ maqaf (Hebrew hyphen)
        '\u05C0'   # ׀ paseq
        '\u05C3'   # ׃ sof pasuq
        '\u05F3'   # ׳ geresh
        '\u05F4'   # ״ gershayim
    )
    
    # Paths to try for fallback font (Windows)
    FALLBACK_FONT_PATHS = [
        r'C:\Windows\Fonts\arial.ttf',
        r'C:\Windows\Fonts\Arial.ttf',
        r'C:\Windows\Fonts\segoeui.ttf',
        r'C:\Windows\Fonts\tahoma.ttf',
        r'C:\Windows\Fonts\calibri.ttf',
    ]
    
    def _inject_fallback_glyphs(self):
        """
        For any common character not already in self._char_map,
        copy its glyph from a system fallback font (Arial, etc.)
        and scale it to match our unitsPerEm.
        """
        # Find a usable fallback font
        fallback_path = None
        for path in self.FALLBACK_FONT_PATHS:
            if os.path.exists(path):
                fallback_path = path
                break
        
        if fallback_path is None:
            logger.warning("No fallback font found on system, skipping glyph injection")
            return
        
        try:
            fallback_tt = TTFont(fallback_path)
        except Exception as e:
            logger.warning(f"Could not load fallback font {fallback_path}: {e}")
            return
        
        # Build reverse cmap: codepoint → glyph name in fallback font
        fallback_cmap = {}
        for table in fallback_tt['cmap'].tables:
            if table.isUnicode():
                fallback_cmap.update(table.cmap)
                break
        
        fallback_glyf = fallback_tt['glyf']
        fallback_hmtx = fallback_tt['hmtx']
        fallback_upem = fallback_tt['head'].unitsPerEm  # Arial = 2048
        
        scale = self.units_per_em / fallback_upem  # e.g. 1024/2048 = 0.5
        
        fallback_glyphset = fallback_tt.getGlyphSet()
        injected = 0
        
        for char in self.FALLBACK_CHARS:
            codepoint = ord(char)
            
            # Skip if user already defined this character
            if codepoint in self._char_map:
                continue
            
            # Check if fallback font has this glyph
            if codepoint not in fallback_cmap:
                continue
            
            src_glyph_name = fallback_cmap[codepoint]
            if src_glyph_name not in fallback_glyphset:
                continue
            
            dst_glyph_name = f'uni{codepoint:04X}'
            
            try:
                # Record the glyph drawing operations from the fallback font
                recording_pen = RecordingPen()
                fallback_glyphset[src_glyph_name].draw(recording_pen)
                
                # Replay into our TTGlyphPen with scaling transform
                tt_pen = TTGlyphPen(glyphSet=None)
                transform_pen = TransformPen(tt_pen, (scale, 0, 0, scale, 0, 0))
                recording_pen.replay(transform_pen)
                
                glyph = tt_pen.glyph()
                
                # Scale the advance width too
                src_width, src_lsb = fallback_hmtx[src_glyph_name]
                dst_width = round(src_width * scale)
                dst_lsb = round(src_lsb * scale)
                
                self.glyphs[dst_glyph_name] = glyph
                self.metrics[dst_glyph_name] = (dst_width, dst_lsb)
                self._char_map[codepoint] = dst_glyph_name
                
                if dst_glyph_name not in self.glyph_order:
                    self.glyph_order.append(dst_glyph_name)
                
                injected += 1
            except Exception as e:
                logger.debug(f"Could not copy fallback glyph for '{char}' (U+{codepoint:04X}): {e}")
                continue
        
        fallback_tt.close()
        logger.info(f"Injected {injected} fallback glyphs from {os.path.basename(fallback_path)}")
    
    def build_font(self):
        """Build complete TTF font object"""
        self._create_notdef_glyph()
        self._create_space_glyph()
        self._inject_fallback_glyphs()
        
        fb = FontBuilder(self.units_per_em, isTTF=True)
        
        fb.setupGlyphOrder(self.glyph_order)
        fb.setupCharacterMap(self._char_map)
        
        # glyf must be set up before head/metrics for correct calculations
        fb.setupGlyf(self.glyphs)
        fb.setupHorizontalMetrics(self.metrics)
        
        fb.setupHorizontalHeader(ascent=800, descent=-200)
        fb.setupHead(unitsPerEm=self.units_per_em, created=0, modified=0)
        
        # Build the name table dict with optional metadata
        name_table = {
            'familyName': self.font_name,
            'styleName': 'Regular',
            'uniqueFontIdentifier': f'{self.font_name}-Regular',
            'fullName': f'{self.font_name} Regular',
            'psName': self.font_name.replace(' ', '').replace('-', ''),
        }

        meta = self.metadata
        if meta.get('version'):
            name_table['version'] = f'Version {meta["version"]}'
        if meta.get('description'):
            name_table['description'] = meta['description']
        if meta.get('license'):
            name_table['licenseDescription'] = meta['license']
        if meta.get('url'):
            name_table['vendorURL'] = meta['url']
        if meta.get('author'):
            name_table['manufacturer'] = meta['author']
            name_table['designer'] = meta['author']

        fb.setupNameTable(name_table)
        
        fb.setupOS2(
            sTypoAscender=800,
            sTypoDescender=-200,
            sTypoLineGap=200,
            usWinAscent=1000,
            usWinDescent=200,
            sxHeight=500,
            sCapHeight=700,
        )
        
        fb.setupPost()
        
        return fb.font
    
    def save_font(self, output_path):
        """Save font to TTF file"""
        try:
            font = self.build_font()
            font.save(output_path)
            return True, output_path
        except Exception as e:
            return False, str(e)

class FontPreview:
    """Generate preview of font"""
    
    @staticmethod
    def export_preview_data(glyphs_dict):
        """Export basic glyph metrics for preview"""
        preview = {}
        for char, data in glyphs_dict.items():
            if 'points' in data:
                preview[char] = {
                    'width': data.get('width', 600),
                    'has_points': len(data['points']) > 0,
                    'point_count': len(data['points'])
                }
        return preview

if __name__ == '__main__':
    # Test font creation
    creator = FontCreator('TestFont')
    print("Font generator module loaded successfully")
