import os
import json

CONFIG_PATH = os.path.join(os.path.dirname(__file__), '..', 'config.json')

def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

# Lazily-loaded set of valid (department, assigned_person) pairs from the DB.
# Populated on first call so the service module stays import-safe.
_valid_routes = None

def _load_valid_routes():
    global _valid_routes
    if _valid_routes is not None:
        return _valid_routes
    try:
        db_path = os.path.join(os.path.dirname(__file__), '..', 'database_demo.db')
        if not os.path.exists(db_path):
            db_path = os.path.join(os.path.dirname(__file__), '..', 'database.db')
        import sqlite3
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        # Collect every department name that exists in the departments table
        c.execute("SELECT name FROM departments")
        valid_depts = {r['name'] for r in c.fetchall()}
        # Collect every user name that can receive assignments
        # (Department Admins + operational staff types)
        c.execute("""
            SELECT name FROM users
            WHERE role IN ('Department Admin', 'Organization Admin')
               OR LOWER(user_type) IN (
                   'lab technician', 'maintenance worker', 'housekeeping worker'
               )
        """)
        valid_persons = {r['name'] for r in c.fetchall()}
        conn.close()
        _valid_routes = (valid_depts, valid_persons)
    except Exception:
        _valid_routes = (set(), set())
    return _valid_routes


def routeComplaint(category):
    """
    Resolve a complaint category to a department and responsible person.

    Returns a dict with keys:
      department      – name of a real department in the DB, or 'Pending Assignment'
      assigned_person – name of a real user who can act, or 'Pending Assignment'
      routing_reason  – human-readable explanation shown in the complaint timeline
      pending         – True when no valid route could be confirmed
    """
    config = load_config()
    routing_rules = config.get("routing_rules", {})

    rule = routing_rules.get(category)

    if rule:
        dept   = rule.get("department", "")
        person = rule.get("assigned_person", "")
    else:
        dept   = ""
        person = ""

    valid_depts, valid_persons = _load_valid_routes()

    dept_ok   = dept   in valid_depts
    person_ok = person in valid_persons

    if dept_ok and person_ok:
        return {
            "department":     dept,
            "assigned_person": person,
            "routing_reason": f"Routed to {dept} ({person})",
            "pending":        False
        }

    # Department exists but person doesn't → use the department's DB head
    if dept_ok and not person_ok:
        try:
            db_path = os.path.join(os.path.dirname(__file__), '..', 'database_demo.db')
            if not os.path.exists(db_path):
                db_path = os.path.join(os.path.dirname(__file__), '..', 'database.db')
            import sqlite3
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT head_person FROM departments WHERE name = ?", (dept,))
            row = c.fetchone()
            conn.close()
            if row and row['head_person'] in valid_persons:
                return {
                    "department":     dept,
                    "assigned_person": row['head_person'],
                    "routing_reason": f"Routed to {dept} ({row['head_person']})",
                    "pending":        False
                }
        except Exception:
            pass

    # No valid route – mark as Pending Assignment for admin review
    return {
        "department":     "Pending Assignment",
        "assigned_person": "Pending Assignment",
        "routing_reason": (
            f"No configured department for category '{category}'. "
            "Awaiting manual assignment by Institutional Admin."
        ),
        "pending": True
    }
