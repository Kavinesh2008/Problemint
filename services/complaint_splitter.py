import re

def splitComplaint(text):
    """
    Splits multi-issue natural language text into discrete issue descriptions.
    Example:
    Input: "The hostel food quality is poor, the water cooler near Block B is not working, Wi-Fi is slow, the washroom is dirty and the lift is not working."
    Returns: List of distinct issue statements.
    """
    if not text or not text.strip():
        return []

    cleaned_text = text.strip()
    
    # Split pattern for sentence delimiters, semicolons, newlines, commas, and conjunctions like "and", "also", "as well as"
    pattern = r'\.\s+|;\s+|\n+|(?:,\s*and\s+)|(?:,\s*also\s+)|(?:\s+and\s+also\s+)|(?:\s+as\s+well\s+as\s+)|(?:\s+and\s+)|(?:\s*,\s*)'
    
    raw_chunks = re.split(pattern, cleaned_text, flags=re.IGNORECASE)
    
    issues = []
    for chunk in raw_chunks:
        chunk_clean = chunk.strip()
        # Clean trailing punctuation
        chunk_clean = re.sub(r'[\.\,;]+$', '', chunk_clean).strip()
        # Remove leading conjunctions if any left
        chunk_clean = re.sub(r'^(and\s+|also\s+|plus\s+|furthermore\s+)', '', chunk_clean, flags=re.IGNORECASE).strip()
        if len(chunk_clean) > 3: # Ignore trivial fragments
            issues.append(chunk_clean)

    # Fallback if split produced nothing
    if not issues:
        issues = [cleaned_text]

    return issues
