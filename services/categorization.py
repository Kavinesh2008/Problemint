import re
import json
import os

CONFIG_PATH = os.path.join(os.path.dirname(__file__), '..', 'config.json')

def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

CATEGORY_KEYWORDS = {
    "Garden/Landscaping": ["garden", "lawn", "plant", "tree", "grass", "landscaping", "gardener", "flower", "hedge", "grounds", "park"],
    "Hostel Food/Mess": ["food", "mess", "canteen", "meal", "dinner", "breakfast", "lunch", "taste", "quality of food", "dish", "cook"],
    "Water Supply": ["water", "cooler", "drinking water", "tap", "pipeline", "water supply", "no water", "leakage", "pressure"],
    "Electricity": ["electricity", "power", "fan", "light", "plug", "socket", "short circuit", "voltage", "blackout", "wiring"],
    "Lift/Elevator": ["lift", "elevator", "stuck", "lift issue", "elevator not working"],
    "Internet/Wi-Fi": ["wi-fi", "wifi", "internet", "network", "router", "slow speed", "no connection", "lan", "signal"],
    "Sanitization/Cleanliness": ["clean", "washroom", "dirty", "toilet", "garbage", "trash", "sanitation", "dustbin", "hygiene", "sweeping", "waste"],
    "Restrooms": ["restroom", "toilet", "bathroom", "flush"],
    "Building/Infrastructure": ["wall", "ceiling", "crack", "paint", "roof", "staircase", "window", "door", "building", "infrastructure"],
    "Classroom Facilities": ["projector", "bench", "blackboard", "whiteboard", "podium", "classroom", "desk", "ac", "air conditioner"],
    "Laboratory": ["lab", "equipment", "microscope", "chemical", "oscillation", "lab component"],
    "Library": ["library", "book", "journal", "reading room", "library card"],
    "Transport": ["bus", "transport", "van", "driver", "shuttle"],
    "Parking": ["parking", "vehicle", "bike", "car park"],
    "Security": ["security", "guard", "gate", "theft", "unauthorized", "stolen"],
    "CCTV/Surveillance": ["cctv", "camera", "surveillance"],
    "Hostel Maintenance": ["room door", "bed", "cupboard", "hostel room", "geyser"],
    "Fees/Finance": ["fee", "payment", "challan", "fine", "scholarship", "finance", "receipt"],
    "Examination": ["exam", "hall ticket", "marksheet", "result", "grade", "revaluation"],
    "Plumbing": ["pipe", "drainage", "sewage", "sink", "faucet"],
    "Noise/Disturbance": ["noise", "loud", "sound", "disturbance", "music"],
    "Environmental Issues": ["pollution", "smell", "odor", "chemical smell", "smoke"]
}

def categorizeComplaint(text):
    """
    Simulated AI / Rule-based keyword matching categorization.
    """
    text_lower = text.lower()
    scores = {}

    for category, keywords in CATEGORY_KEYWORDS.items():
        score = 0
        for kw in keywords:
            if kw in text_lower:
                score += 1
        if score > 0:
            scores[category] = score

    if scores:
        sorted_cats = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        return sorted_cats[0][0]

    return "General Maintenance"
