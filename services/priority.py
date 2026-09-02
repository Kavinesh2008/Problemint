def detectPriority(text):
    """
    Detect priority based on rule matching: Low, Medium, High, Critical.
    """
    text_lower = text.lower()

    critical_keywords = ["fire", "danger", "emergency", "spark", "electric shock", "hazard", "gas leak", "life threatening"]
    high_keywords = ["urgent", "serious", "unsafe", "immediately", "broken", "overflow", "stuck", "flood", "stolen", "security threat"]
    low_keywords = ["minor", "small issue", "slight", "cosmetic", "suggestion", "low priority"]

    for kw in critical_keywords:
        if kw in text_lower:
            return "Critical"

    for kw in high_keywords:
        if kw in text_lower:
            return "High"

    for kw in low_keywords:
        if kw in text_lower:
            return "Low"

    return "Medium"

def detectLocation(text, default_location="Main Block"):
    """
    Rule-based location extraction from description if user omitted manual location.
    """
    text_lower = text.lower()
    
    locations_map = {
        "block a": "Block A",
        "block b": "Block B",
        "block c": "Block C",
        "hostel block a": "Hostel Block A",
        "hostel block b": "Hostel Block B",
        "hostel": "Hostel Block A",
        "library": "Library",
        "lab": "Central Laboratory",
        "laboratory": "Central Laboratory",
        "mess": "Cafeteria / Mess",
        "canteen": "Cafeteria / Mess",
        "cafeteria": "Cafeteria / Mess",
        "auditorium": "Auditorium",
        "parking": "Campus Parking",
        "ground": "Sports Ground",
    }

    for key, loc in locations_map.items():
        if key in text_lower:
            return loc

    return default_location
