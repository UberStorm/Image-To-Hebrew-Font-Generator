"""
Hebrew language support for font creation
"""

HEBREW_LETTERS = {
    'א': 'alef',
    'ב': 'bet',
    'ג': 'gimel',
    'ד': 'dalet',
    'ה': 'he',
    'ו': 'vav',
    'ז': 'zayin',
    'ח': 'het',
    'ט': 'tet',
    'י': 'yod',
    'כ': 'kaf',
    'ל': 'lamed',
    'מ': 'mem',
    'נ': 'nun',
    'ס': 'samekh',
    'ע': 'ayin',
    'פ': 'pe',
    'צ': 'tzadi',
    'ק': 'qof',
    'ר': 'resh',
    'ש': 'shin',
    'ת': 'tav',
    # Final forms
    'ך': 'finalkaf',
    'ם': 'finalmem',
    'ן': 'finalnun',
    'ף': 'finalpe',
    'ץ': 'finaltsadi'
}

HEBREW_FINAL_FORMS = {
    'כ': 'ך',  # kaf final
    'מ': 'ם',  # mem final
    'נ': 'ן',  # nun final
    'פ': 'ף',  # pe final
    'צ': 'ץ'   # tzadi final
}

class HebrewReader:
    """Handle Hebrew text direction and properties"""
    
    @staticmethod
    def is_hebrew_char(char):
        """Check if character is Hebrew"""
        return 0x0590 <= ord(char) <= 0x05FF
    
    @staticmethod
    def reverse_hebrew_text(text):
        """Reverse text for RTL processing"""
        return text[::-1]
    
    @staticmethod
    def get_letter_name(char):
        """Get English name for Hebrew letter"""
        return HEBREW_LETTERS.get(char, f'hebrew_{ord(char):04x}')
    
    @staticmethod
    def normalize_letter(char):
        """Normalize letter (e.g., final forms to regular)"""
        # Map final forms to their regular counterparts
        final_to_regular = {v: k for k, v in HEBREW_FINAL_FORMS.items()}
        return final_to_regular.get(char, char)

def validate_hebrew_input(text):
    """Validate input contains Hebrew characters"""
    return any(HebrewReader.is_hebrew_char(c) for c in text)
