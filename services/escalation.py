import os
import json
from datetime import datetime, timezone

CONFIG_PATH = os.path.join(os.path.dirname(__file__), '..', 'config.json')

def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def checkEscalation(complaint):
    """
    Check if a complaint requires escalation due to lack of action or delay.
    Returns (should_escalate, new_assigned_person, reason)
    """
    status = complaint.get("status")
    department = complaint.get("department")
    assigned_person = complaint.get("assigned_person")

    # If already resolved or closed, no escalation needed
    if status in ["Resolved", "Closed"]:
        return False, assigned_person, "Complaint is already resolved or closed."

    config = load_config()
    escalation_chain = config.get("escalation_chain", {}).get(department, [])

    # If assigned person is in the chain, find the next level
    if assigned_person in escalation_chain:
        current_index = escalation_chain.index(assigned_person)
        if current_index + 1 < len(escalation_chain):
            next_person = escalation_chain[current_index + 1]
            return True, next_person, f"Automated Escalation: No action taken within expected response window. Escalated from {assigned_person} to {next_person}."

    # Default escalation fallback
    if assigned_person != "College Admin":
        return True, "College Admin", f"Automated Escalation: Delayed action by {assigned_person}. Escalated to College Admin."

    return False, assigned_person, "Already at top escalation level."
