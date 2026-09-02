import os
import json

CONFIG_PATH = os.path.join(os.path.dirname(__file__), '..', 'config.json')

def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def routeComplaint(category):
    """
    Lookup department and responsible person based on category.
    """
    config = load_config()
    routing_rules = config.get("routing_rules", {})

    if category in routing_rules:
        rule = routing_rules[category]
        return {
            "department": rule.get("department", "General Administration"),
            "assigned_person": rule.get("assigned_person", "Campus Administrator")
        }

    return {
        "department": "General Administration",
        "assigned_person": "Campus Administrator"
    }
