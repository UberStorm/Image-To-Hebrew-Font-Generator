import os

class Config:
    """Configuration for Hebrew Font Maker"""
    
    # Flask settings
    DEBUG = True
    SECRET_KEY = 'hebrew-font-maker-secret-key-2024'
    
    # Upload settings
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'temp')
    OUTPUT_FOLDER = os.path.join(os.path.dirname(__file__), 'fonts_output')
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB max file size
    
    # Hebrew alphabet characters
    HEBREW_LETTERS = [
        'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 
        'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 
        'ש', 'ת'
    ]
    
    # Unicode ranges for Hebrew
    HEBREW_START = 0x0590
    HEBREW_END = 0x05FF
    
    # Font settings
    FONT_SIZE = 1024  # em units
    ASCENDER = 800
    DESCENDER = -200
    
    # Image processing settings
    MIN_LETTER_SIZE = 50  # minimum pixels
    MAX_LETTER_SIZE = 5000
    LETTER_THRESHOLD = 0.2  # contrast threshold

# Create necessary directories if they don't exist
os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
os.makedirs(Config.OUTPUT_FOLDER, exist_ok=True)
