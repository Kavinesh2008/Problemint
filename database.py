import sqlite3
import os

# Central DEMO_MODE Configuration Switch:
# Set DEMO_MODE = True for faculty demonstration with 12 connected records (database_demo.db)
# Set DEMO_MODE = False for original full institutional dataset (database.db)
DEMO_MODE = os.environ.get('DEMO_MODE', 'true').lower() in ('true', '1', 'yes')

def get_db_path():
    if DEMO_MODE:
        return os.path.join(os.path.dirname(__file__), 'database_demo.db')
    return os.path.join(os.path.dirname(__file__), 'database.db')

DB_PATH = get_db_path()

def get_db():
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL DEFAULT 'password123',
        role TEXT NOT NULL,
        user_type TEXT NOT NULL DEFAULT 'Student',
        roll_number TEXT,
        employee_id TEXT,
        designation TEXT,
        status TEXT NOT NULL DEFAULT 'Active',
        organization_id INTEGER,
        department TEXT,
        created_at TEXT,
        last_login_at TEXT,
        FOREIGN KEY (organization_id) REFERENCES organizations (id)
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY,
        full_name TEXT,
        notify_forwarding INTEGER DEFAULT 1,
        notify_seen INTEGER DEFAULT 1,
        notify_resolution INTEGER DEFAULT 1,
        notify_escalation INTEGER DEFAULT 1,
        ai_threshold INTEGER DEFAULT 75,
        sla_window TEXT DEFAULT '24 Hours (Standard)',
        updated_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        organization_id INTEGER,
        head_person TEXT,
        FOREIGN KEY (organization_id) REFERENCES organizations (id)
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS incidents (
        incident_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        location TEXT NOT NULL,
        department TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        first_reported_at TEXT,
        last_reported_at TEXT,
        complaint_count INTEGER DEFAULT 1,
        affected_users INTEGER DEFAULT 1,
        pattern_detected TEXT,
        possible_root_cause TEXT,
        root_cause_confidence REAL DEFAULT 0.85,
        assigned_team TEXT,
        resolution_status TEXT DEFAULT 'Pending'
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS complaints (
        id TEXT PRIMARY KEY,
        original_complaint_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT,
        department TEXT NOT NULL,
        assigned_person TEXT NOT NULL,
        location TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        seen INTEGER DEFAULT 0,
        seen_at TEXT,
        seen_by TEXT,
        first_viewed_at TEXT,
        assigned_at TEXT,
        acknowledged_at TEXT,
        acknowledged_by TEXT,
        acknowledgement_deadline TEXT,
        resolution_note TEXT,
        escalated INTEGER DEFAULT 0,
        escalation_level INTEGER DEFAULT 0,
        escalated_at TEXT,
        escalation_reason TEXT,
        incident_id TEXT,
        source TEXT DEFAULT 'Web',
        has_evidence INTEGER DEFAULT 0,
        evidence_provenance TEXT DEFAULT 'User Submission',
        user_verified INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (incident_id) REFERENCES incidents (incident_id)
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS self_service_resolutions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        problem_type TEXT NOT NULL,
        location TEXT,
        solution_used TEXT NOT NULL,
        resolved_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS complaint_timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id TEXT NOT NULL,
        status TEXT NOT NULL,
        description TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (complaint_id) REFERENCES complaints (id)
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS resolutions (
        resolution_id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL,
        attempt_number INTEGER DEFAULT 1,
        action_taken TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        performed_at TEXT NOT NULL,
        action_type TEXT,
        outcome TEXT,
        success INTEGER DEFAULT 0,
        resolution_time_hours REAL DEFAULT 2.0,
        verification_status TEXT DEFAULT 'Not Verified',
        user_feedback_summary TEXT,
        follow_up_required INTEGER DEFAULT 0,
        incident_final_status TEXT DEFAULT 'In Progress',
        FOREIGN KEY (incident_id) REFERENCES incidents (incident_id)
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS knowledge_base (
        knowledge_id TEXT PRIMARY KEY,
        incident_id TEXT,
        problem_type TEXT NOT NULL,
        problem_description TEXT NOT NULL,
        location TEXT NOT NULL,
        root_cause TEXT NOT NULL,
        root_cause_confidence REAL DEFAULT 0.90,
        solution_attempted TEXT,
        successful_solution TEXT NOT NULL,
        failed_solution TEXT,
        outcome TEXT,
        resolution_time_hours REAL DEFAULT 4.0,
        success_rate TEXT DEFAULT '100%',
        lesson_learned TEXT,
        recommended_future_action TEXT,
        created_from_incident TEXT,
        last_updated TEXT
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS prevention_recommendations (
        recommendation_id TEXT PRIMARY KEY,
        incident_id TEXT,
        problem TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        reason TEXT NOT NULL,
        evidence TEXT,
        risk_level TEXT DEFAULT 'Medium',
        priority TEXT DEFAULT 'Medium',
        expected_impact TEXT,
        suggested_timeline TEXT,
        responsible_department TEXT NOT NULL,
        recommended_action_type TEXT,
        status TEXT DEFAULT 'Approved',
        created_at TEXT,
        based_on_previous_incident INTEGER DEFAULT 1,
        supporting_complaint_count INTEGER DEFAULT 1,
        decision_note TEXT,
        reviewed_by TEXT,
        reviewed_at TEXT
    );
    ''')

    conn.commit()
    conn.close()
