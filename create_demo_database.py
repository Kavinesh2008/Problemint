#!/usr/bin/env python3
"""
create_demo_database.py
Initializes database_demo.db with the exact 12 connected demonstration complaints
covering all institutional problem areas, with valid relationships:
Complaint -> User -> Department -> Assigned Admin -> Incident -> Resolution -> Verification.
"""
import sqlite3
import datetime
import os
from werkzeug.security import generate_password_hash

DEMO_DB_PATH = os.path.join(os.path.dirname(__file__), 'database_demo.db')

def build_demo_db():
    if os.path.exists(DEMO_DB_PATH):
        try:
            os.remove(DEMO_DB_PATH)
        except Exception:
            pass

    conn = sqlite3.connect(DEMO_DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Create tables
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    );''')

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
    );''')

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
    );''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        organization_id INTEGER,
        head_person TEXT,
        FOREIGN KEY (organization_id) REFERENCES organizations (id)
    );''')

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
    );''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS complaints (
        id TEXT PRIMARY KEY,
        original_complaint_id TEXT,
        user_id INTEGER,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT,
        department TEXT NOT NULL,
        assigned_person TEXT,
        location TEXT NOT NULL,
        priority TEXT DEFAULT 'Medium',
        status TEXT DEFAULT 'Investigating',
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
        source TEXT DEFAULT 'Web Submission',
        has_evidence INTEGER DEFAULT 0,
        evidence_provenance TEXT DEFAULT 'Demo Verified Record',
        user_verified INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (incident_id) REFERENCES incidents (incident_id)
    );''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS complaint_timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id TEXT NOT NULL,
        status TEXT NOT NULL,
        description TEXT,
        updated_by TEXT,
        timestamp TEXT,
        FOREIGN KEY (complaint_id) REFERENCES complaints (id)
    );''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS resolutions (
        resolution_id TEXT PRIMARY KEY,
        incident_id TEXT,
        attempt_number INTEGER DEFAULT 1,
        action_taken TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        performed_at TEXT,
        action_type TEXT,
        outcome TEXT,
        success INTEGER DEFAULT 1,
        resolution_time_hours REAL DEFAULT 2.0,
        verification_status TEXT DEFAULT 'Not Verified',
        user_feedback_summary TEXT,
        follow_up_required INTEGER DEFAULT 0,
        incident_final_status TEXT DEFAULT 'In Progress',
        FOREIGN KEY (incident_id) REFERENCES incidents (incident_id)
    );''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS knowledge_base (
        knowledge_id TEXT PRIMARY KEY,
        incident_id TEXT,
        problem_type TEXT NOT NULL,
        problem_description TEXT NOT NULL,
        location TEXT NOT NULL,
        root_cause TEXT,
        root_cause_confidence REAL DEFAULT 0.90,
        solution_attempted TEXT,
        successful_solution TEXT,
        failed_solution TEXT,
        outcome TEXT,
        resolution_time_hours REAL DEFAULT 4.0,
        success_rate TEXT DEFAULT '100%',
        lesson_learned TEXT,
        recommended_future_action TEXT,
        created_from_incident TEXT,
        last_updated TEXT
    );''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS prevention_recommendations (
        recommendation_id TEXT PRIMARY KEY,
        incident_id TEXT,
        problem TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        reason TEXT,
        evidence TEXT,
        risk_level TEXT DEFAULT 'Medium',
        priority TEXT DEFAULT 'Medium',
        expected_impact TEXT,
        suggested_timeline TEXT,
        responsible_department TEXT,
        recommended_action_type TEXT,
        status TEXT DEFAULT 'Approved',
        created_at TEXT,
        based_on_previous_incident INTEGER DEFAULT 1,
        supporting_complaint_count INTEGER DEFAULT 1,
        decision_note TEXT,
        reviewed_by TEXT,
        reviewed_at TEXT
    );''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS self_service_resolutions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        problem_type TEXT NOT NULL,
        location TEXT,
        solution_used TEXT,
        resolved_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );''')

    # 1. Organization
    cursor.execute("INSERT INTO organizations (id, name) VALUES (1, 'ABC Engineering College')")

    # 2. Departments
    departments = [
        ("Mess / Food Administration", "Mess Manager"),
        ("Water & Maintenance Dept", "Maintenance Admin"),
        ("Electrical Maintenance", "Chief Electrician"),
        ("Lift Maintenance Dept", "Lift Maintenance Officer"),
        ("Network Administration", "Network Admin"),
        ("Housekeeping Dept", "Housekeeping Supervisor"),
        ("Security & Parking", "Security Officer"),
        ("Academic Administration", "Academic Admin"),
        ("Transport Dept", "Transport Admin")
    ]
    for dept_name, head in departments:
        cursor.execute("INSERT INTO departments (name, organization_id, head_person) VALUES (?, 1, ?)", (dept_name, head))

    # 3. Users (All 14 accounts so any persona can log in during faculty demo)
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    users = [
        ("Student User", "student@college.edu", "student123", "User", "Student", "2024CS101", None, "Undergraduate Student (CS)", 1, "Computer Science"),
        ("Prof. Ramesh Kumar", "teacher@college.edu", "teacher123", "User", "Teaching staff", None, "FAC-1002", "Associate Professor (EE)", 1, "Electrical Engineering"),
        ("Anita Sharma", "staff@college.edu", "staff123", "User", "Non-teaching staff", None, "STF-2005", "Administrative Executive", 1, "Administration"),
        ("Dr. Vikram Rao", "researcher@college.edu", "research123", "User", "Research staff", None, "RES-3012", "Senior Postdoc Researcher", 1, "Biotech Research"),
        ("Suresh Verma", "labtech@college.edu", "labpass", "User", "Lab technician", None, "LAB-4040", "Senior Systems Lab Technician", 1, "Central Laboratory"),
        ("Raju M.", "maintworker@college.edu", "maintworkerpass", "User", "Maintenance worker", None, "OPS-5011", "Lead Plumber & Maintenance Specialist", 1, "Water & Maintenance Dept"),
        ("Meena Devi", "houseworker@college.edu", "houseworkerpass", "User", "Housekeeping worker", None, "OPS-6022", "Senior Sanitation Staff", 1, "Housekeeping Dept"),
        ("Network Admin", "network.admin@college.edu", "networkpass", "Department Admin", "Department admin", None, "ADM-IT01", "Head of IT Network", 1, "Network Administration"),
        ("Mess Manager", "mess.manager@college.edu", "messpass", "Department Admin", "Department admin", None, "ADM-MS01", "Chief Mess Supervisor", 1, "Mess / Food Administration"),
        ("Maintenance Admin", "maintenance.admin@college.edu", "maintpass", "Department Admin", "Department admin", None, "ADM-MT01", "Estate Maintenance Director", 1, "Water & Maintenance Dept"),
        ("Housekeeping Supervisor", "housekeeping@college.edu", "cleanpass", "Department Admin", "Department admin", None, "ADM-HK01", "Chief Housekeeping Officer", 1, "Housekeeping Dept"),
        ("Security Officer", "security@college.edu", "secpass", "Department Admin", "Department admin", None, "ADM-SC01", "Chief Security Officer", 1, "Security & Parking"),
        ("Lift Maintenance Officer", "lift.officer@college.edu", "liftpass", "Department Admin", "Department admin", None, "ADM-LF01", "Lead Lift Safety Officer", 1, "Lift Maintenance Dept"),
        ("College Admin", "admin@college.edu", "admin123", "Organization Admin", "Organization admin", None, "ADM-ORG01", "Director / Principal", 1, "Central Administration")
    ]

    user_map = {}
    for name, email, password, role, user_type, roll_no, emp_id, designation, org_id, dept in users:
        pw_hash = generate_password_hash(password)
        cursor.execute('''
            INSERT INTO users (
                name, email, password, role, user_type, roll_number, employee_id,
                designation, status, organization_id, department, created_at, last_login_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?)
        ''', (name, email, pw_hash, role, user_type, roll_no, emp_id, designation, org_id, dept, now_str, now_str))
        user_id = cursor.lastrowid
        user_map[email] = user_id
        cursor.execute('''
        INSERT INTO user_settings (user_id, full_name, notify_forwarding, notify_seen, notify_resolution, notify_escalation, ai_threshold, sla_window, updated_at)
        VALUES (?, ?, 1, 1, 1, 1, 75, '24 Hours (Standard)', ?)
        ''', (user_id, name, now_str))

    student_id = user_map['student@college.edu']
    teacher_id = user_map['teacher@college.edu']
    staff_id = user_map['staff@college.edu']

    # 4. Recurring Incident INC-001 (Supported by multiple network complaints)
    cursor.execute('''
    INSERT INTO incidents (
        incident_id, title, category, location, department, severity,
        status, first_reported_at, last_reported_at, complaint_count,
        affected_users, pattern_detected, possible_root_cause,
        root_cause_confidence, assigned_team, resolution_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        "INC-001",
        "Block C Wi-Fi Signal Degradation & Core Switch Latency",
        "Internet/Wi-Fi",
        "Block C",
        "Network Administration",
        "High",
        "In Progress",
        "2026-09-24 09:30:00",
        now_str,
        3,
        140,
        "Repeated SSID disconnections concentrated during morning class intervals on 2nd and 3rd floors",
        "Core PoE switch port buffer saturation and outdated AP firmware version v2.1.0",
        0.92,
        "Network Administration",
        "Under Investigation"
    ))

    # Resolution attempt for INC-001
    cursor.execute('''
    INSERT INTO resolutions (
        resolution_id, incident_id, attempt_number, action_taken, performed_by,
        performed_at, action_type, outcome, success, resolution_time_hours,
        verification_status, user_feedback_summary, follow_up_required, incident_final_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        "RES-DEMO-001",
        "INC-001",
        1,
        "Restarted Core Switch C-2 and updated channel bandwidth to 40MHz on AP-201 and AP-202",
        "Network Admin",
        "2026-09-24 16:00:00",
        "Firmware & Channel Tuning",
        "Reduced packet drop from 18% to 4%; monitoring peak hour load",
        1,
        2.5,
        "Partially Verified",
        "Classroom 204 restored; Lab 3 still reports occasional timeout",
        1,
        "In Progress"
    ))

    # Seed Knowledge Base previous solutions (Used internally by AI engine)
    kb_data = [
        ("KB-001", "INC-001", "Internet/Wi-Fi", "Wi-Fi disconnection and captive portal timeout in Block C", "Block C",
         "Captive portal authentication session timeout due to DHCP lease exhaustion", 0.94,
         "Restarted AP; flushed DHCP scope and expanded subnet lease to 8 hours",
         "Renew DHCP lease on client device; clear browser captive cache; connect via official 5GHz SSID",
         "Simply rebooting individual client device without clearing portal cookies",
         "Resolved connectivity for 95% of users within 10 minutes", 1.5, "95%",
         "Captive portal leases must match academic session hours", "Automate weekly DHCP lease table garbage collection",
         "INC-001", "2026-09-24 18:00:00"),

        ("KB-002", None, "Water Supply", "Water purifier dispensing cloudy or discolored water", "Hostel Block B",
         "Sediment filter saturation after municipal line maintenance", 0.90,
         "Replaced pre-filter sediment candle and activated carbon block",
         "Flush purifier for 60 seconds; check if secondary inlet valve is open; replace sediment filter candle",
         "Over-tightening carbon housing causing seal leakage",
         "Water clarity and TDS returned to drinking standard (<120 ppm)", 2.0, "100%",
         "Filter replacement schedule should be tied to municipal maintenance alerts", "Install inline turbidity sensor",
         None, "2026-09-22 14:00:00"),

        ("KB-003", None, "Electricity", "Laboratory socket board tripped and no power to test equipment", "Central Laboratory",
         "Earth leakage circuit breaker (ELCB) tripped due to simultaneous high inrush current", 0.88,
         "Isolated inductive load from bench supply; reset 32A distribution breaker",
         "Check MCB sub-board toggle; turn off high-load devices before re-engaging main circuit breaker",
         "Attempting to reset breaker while inductive equipment is powered on",
         "Power restored safely to lab benches 1 through 8", 0.5, "100%",
         "Stagger inductive lab start-up sequence", "Upgrade to delayed-trip industrial breaker",
         None, "2026-09-23 10:30:00"),

        ("KB-004", None, "Lift/Elevator", "Elevator floor misalignment and door reopening delay", "Main Academic Block",
         "Optical landing sensor obscured by dust and worn levelling switch", 0.92,
         "Cleaned optical sensors, calibrated deceleration curve, lubricated guide rails",
         "Do not force doors; dispatch licensed elevator contractor for levelling recalibration",
         "Manual door lever adjustment without sensor alignment",
         "Levelling accuracy within 3mm restored across all 5 floors", 3.0, "100%",
         "Bi-weekly sensor dusting required during monsoon season", "Schedule monthly elevator OEM safety audit",
         None, "2026-09-21 16:00:00")
    ]
    for item in kb_data:
        cursor.execute('''
        INSERT INTO knowledge_base (
            knowledge_id, incident_id, problem_type, problem_description, location,
            root_cause, root_cause_confidence, solution_attempted, successful_solution,
            failed_solution, outcome, resolution_time_hours, success_rate,
            lesson_learned, recommended_future_action, created_from_incident, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', item)

    # Prevention recommendations
    cursor.execute('''
    INSERT INTO prevention_recommendations (
        recommendation_id, incident_id, problem, recommendation, reason,
        evidence, risk_level, priority, expected_impact, suggested_timeline,
        responsible_department, recommended_action_type, status, created_at,
        based_on_previous_incident, supporting_complaint_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        "REC-DEMO-001",
        "INC-001",
        "Recurring Block C Wi-Fi Congestion",
        "Deploy dual-band Wi-Fi 6 access points in high-density 2nd floor corridors and upgrade backbone switch link to 10Gbps.",
        "3 separate complaints within 48 hours show consistent buffer saturation during peak class switchover periods.",
        "Buffer saturation logs on Switch C-2 and 140 affected students.",
        "High", "High",
        "Eliminate latency and support 300+ concurrent classroom connections.",
        "14 Days", "Network Administration", "Infrastructure Upgrade", "Approved", now_str, 1, 3
    ))

    cursor.execute('''
    INSERT INTO prevention_recommendations (
        recommendation_id, incident_id, problem, recommendation, reason,
        evidence, risk_level, priority, expected_impact, suggested_timeline,
        responsible_department, recommended_action_type, status, created_at,
        based_on_previous_incident, supporting_complaint_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        "REC-DEMO-002",
        None,
        "Lift Sensor Dust Accumulation",
        "Implement mandatory bi-weekly optical sensor cleaning schedule for Academic Block elevators.",
        "Sensor dust causes floor levelling errors and safety trip stops.",
        "OEM technician service report dated 21-Sep.",
        "High", "Critical",
        "Prevent passenger lift entrapments and safety halts.",
        "Immediate", "Lift Maintenance Dept", "Preventive Maintenance", "Approved", now_str, 0, 2
    ))

    # Self-service sample resolutions
    cursor.execute('''
    INSERT INTO self_service_resolutions (user_id, problem_type, location, solution_used, resolved_at)
    VALUES (?, ?, ?, ?, ?)
    ''', (student_id, "Internet/Wi-Fi", "Block C", "Flushed DNS cache and re-authenticated on campus portal", "2026-09-25 11:20:00"))

    # =========================================================================
    # THE 12 CONNECTED DEMONSTRATION COMPLAINTS
    # Cover: 3 Network, 2 Water, 2 Housekeeping, 2 Lift, 1 Mess, 1 Lab, 1 Security
    # Include: Pending, Acknowledged, In Progress, Resolved & Verified,
    #          Awaiting Confirmation, and 1 Unacknowledged Overdue Escalation!
    # =========================================================================
    demo_complaints = [
        # --- 3 Network Problems (Linked to Recurring Incident INC-001) ---
        {
            "id": "CMP-DEMO-001",
            "desc": "Frequent Wi-Fi disconnections and captive portal timeout in Block C 2nd floor classrooms during lectures",
            "cat": "Internet/Wi-Fi", "sub": "Wi-Fi Signal / Access Point",
            "dept": "Network Administration", "person": "Network Admin",
            "loc": "Block C", "prio": "High", "status": "In Progress",
            "user_id": student_id, "incident_id": "INC-001",
            "seen": 1, "ack": 1, "ver": 0, "esc": 0,
            "created": "2026-09-24 09:30:00", "sla_hours": 6,
            "timeline": [
                ("Submitted", "Reported by Student User via Web Portal", "Student User", "2026-09-24 09:30:00"),
                ("Assigned", "Auto-routed to Network Administration", "System Routing", "2026-09-24 09:30:05"),
                ("Seen", "Viewed by Head of IT Network", "Network Admin", "2026-09-24 09:42:00"),
                ("Acknowledged", "SLA acknowledged; technician dispatched to test AP-201 and AP-202", "Network Admin", "2026-09-24 10:15:00"),
                ("In Progress", "Buffer saturation diagnosed on Switch C-2; linked to active incident INC-001", "Network Admin", "2026-09-24 14:00:00")
            ]
        },
        {
            "id": "CMP-DEMO-002",
            "desc": "Unable to connect to campus Wi-Fi SSID in Block C Computer Lab 3; DHCP IP assignment fails",
            "cat": "Internet/Wi-Fi", "sub": "IP / DHCP Failure",
            "dept": "Network Administration", "person": "Network Admin",
            "loc": "Block C", "prio": "Medium", "status": "Acknowledged",
            "user_id": teacher_id, "incident_id": "INC-001",
            "seen": 1, "ack": 1, "ver": 0, "esc": 0,
            "created": "2026-09-24 11:15:00", "sla_hours": 24,
            "timeline": [
                ("Submitted", "Reported by Prof. Ramesh Kumar", "Prof. Ramesh Kumar", "2026-09-24 11:15:00"),
                ("Assigned", "Auto-routed to Network Administration", "System Routing", "2026-09-24 11:15:02"),
                ("Seen", "Ticket reviewed by Network Admin", "Network Admin", "2026-09-24 11:30:00"),
                ("Acknowledged", "Acknowledged by Network Admin; linked to group incident INC-001", "Network Admin", "2026-09-24 12:00:00")
            ]
        },
        {
            "id": "CMP-DEMO-003",
            "desc": "Severe packet loss and DNS resolution failures during online programming lab in Block C Room 204",
            "cat": "Internet/Wi-Fi", "sub": "Packet Loss / Latency",
            "dept": "Network Administration", "person": "Network Admin",
            "loc": "Block C", "prio": "High", "status": "In Progress",
            "user_id": student_id, "incident_id": "INC-001",
            "seen": 1, "ack": 1, "ver": 0, "esc": 0,
            "created": "2026-09-24 14:00:00", "sla_hours": 6,
            "timeline": [
                ("Submitted", "Reported by Student User", "Student User", "2026-09-24 14:00:00"),
                ("Assigned", "Auto-routed to Network Administration", "System Routing", "2026-09-24 14:00:05"),
                ("Seen", "Inspected by IT Network Team", "Network Admin", "2026-09-24 14:20:00"),
                ("Acknowledged", "SLA confirmed; testing port aggregation on distribution frame", "Network Admin", "2026-09-24 14:45:00")
            ]
        },

        # --- 2 Water Supply Problems ---
        {
            "id": "CMP-DEMO-004",
            "desc": "Water cooler in Main Library ground floor dispenser leaking continuously and pooling water",
            "cat": "Water Supply", "sub": "Dispenser / Leakage",
            "dept": "Water & Maintenance Dept", "person": "Maintenance Admin",
            "loc": "Library", "prio": "Medium", "status": "Resolved",
            "user_id": staff_id, "incident_id": None,
            "seen": 1, "ack": 1, "ver": 1, "esc": 0,
            "created": "2026-09-23 10:00:00", "sla_hours": 24,
            "res_note": "Replaced faulty copper float valve and sealed internal drainage coupling. Tested leak-free under 4 bar pressure.",
            "timeline": [
                ("Submitted", "Reported by Anita Sharma", "Anita Sharma", "2026-09-23 10:00:00"),
                ("Assigned", "Assigned to Water & Maintenance Dept", "System Routing", "2026-09-23 10:00:05"),
                ("Seen", "Viewed by Maintenance Admin", "Maintenance Admin", "2026-09-23 10:25:00"),
                ("Acknowledged", "Acknowledged; plumber Raju M. assigned to repair", "Maintenance Admin", "2026-09-23 11:00:00"),
                ("Resolved", "Replaced float valve and drainage coupling; verified leak-free", "Maintenance Admin", "2026-09-23 15:30:00"),
                ("Closed", "User verified: Water cooler working normally with zero leakage", "Anita Sharma", "2026-09-24 09:00:00")
            ]
        },
        {
            "id": "CMP-DEMO-005",
            "desc": "Drinking water purifier on Hostel Block B 3rd floor dispensing turbid water after line maintenance",
            "cat": "Water Supply", "sub": "Filtration / Quality",
            "dept": "Water & Maintenance Dept", "person": "Maintenance Admin",
            "loc": "Hostel Block B", "prio": "High", "status": "Resolved",
            "user_id": student_id, "incident_id": None,
            "seen": 1, "ack": 1, "ver": 0, "esc": 0,  # Awaiting Verification!
            "created": "2026-09-25 08:30:00", "sla_hours": 6,
            "res_note": "Flushed secondary sediment filter and installed new activated carbon cartridge. Awaiting student test verification.",
            "timeline": [
                ("Submitted", "Reported by Student User", "Student User", "2026-09-25 08:30:00"),
                ("Assigned", "Assigned to Water & Maintenance Dept", "System Routing", "2026-09-25 08:30:05"),
                ("Seen", "Viewed by Maintenance Admin", "Maintenance Admin", "2026-09-25 08:50:00"),
                ("Acknowledged", "Acknowledged; filter maintenance scheduled", "Maintenance Admin", "2026-09-25 09:15:00"),
                ("Resolved", "New sediment candle & carbon block fitted; please confirm water clarity", "Maintenance Admin", "2026-09-25 14:00:00")
            ]
        },

        # --- 2 Housekeeping Problems ---
        {
            "id": "CMP-DEMO-006",
            "desc": "Overflowing recycling dustbins and food wrappers near Central Cafeteria entrance walkway",
            "cat": "Sanitization/Cleanliness", "sub": "Waste Disposal",
            "dept": "Housekeeping Dept", "person": "Housekeeping Supervisor",
            "loc": "Cafeteria / Mess", "prio": "Low", "status": "Submitted",
            "user_id": student_id, "incident_id": None,
            "seen": 0, "ack": 0, "ver": 0, "esc": 0,  # Pending initial review
            "created": "2026-09-25 15:45:00", "sla_hours": 48,
            "timeline": [
                ("Submitted", "Reported by Student User via Web Portal", "Student User", "2026-09-25 15:45:00"),
                ("Assigned", "Auto-routed to Housekeeping Dept", "System Routing", "2026-09-25 15:45:02")
            ]
        },
        {
            "id": "CMP-DEMO-007",
            "desc": "Restroom corridor in Block A 2nd floor requires sanitization, deodorizing and floor buffing",
            "cat": "Sanitization/Cleanliness", "sub": "Corridor Cleaning",
            "dept": "Housekeeping Dept", "person": "Housekeeping Supervisor",
            "loc": "Block A", "prio": "Medium", "status": "In Progress",
            "user_id": staff_id, "incident_id": None,
            "seen": 1, "ack": 1, "ver": 0, "esc": 0,
            "created": "2026-09-25 10:15:00", "sla_hours": 24,
            "timeline": [
                ("Submitted", "Reported by Anita Sharma", "Anita Sharma", "2026-09-25 10:15:00"),
                ("Assigned", "Assigned to Housekeeping Dept", "System Routing", "2026-09-25 10:15:05"),
                ("Seen", "Viewed by Housekeeping Supervisor", "Housekeeping Supervisor", "2026-09-25 10:30:00"),
                ("Acknowledged", "Afternoon sanitation shift assigned to clean Block A corridor", "Housekeeping Supervisor", "2026-09-25 11:00:00")
            ]
        },

        # --- 2 Lift Maintenance Problems ---
        {
            # CRITICAL UNACKNOWLEDGED OVERDUE COMPLAINT FOR AUTOMATIC ESCALATION DEMONSTRATION!
            "id": "CMP-DEMO-008",
            "desc": "Passenger Lift 2 in Main Academic Block exhibits jerky deceleration, audible scraping and floor misalignment",
            "cat": "Lift/Elevator", "sub": "Cabin Levelling & Motor",
            "dept": "Lift Maintenance Dept", "person": "Lift Maintenance Officer",
            "loc": "Main Academic Block", "prio": "Critical", "status": "Submitted",
            "user_id": teacher_id, "incident_id": None,
            "seen": 0, "ack": 0, "ver": 0, "esc": 1,  # Escalated!
            "esc_level": 1,
            "created": "2026-09-25 08:00:00", "sla_hours": 1,  # 1h deadline breached hours ago!
            "esc_reason": "Critical SLA Breach: Department failed to acknowledge passenger elevator safety ticket within 1 hour deadline",
            "timeline": [
                ("Submitted", "Reported by Prof. Ramesh Kumar", "Prof. Ramesh Kumar", "2026-09-25 08:00:00"),
                ("Assigned", "Auto-routed to Lift Maintenance Dept", "System Routing", "2026-09-25 08:00:05"),
                ("Escalated", "Automatic SLA Daemon: Ticket unacknowledged after 1h deadline. Escalated to College Administrator.", "System Daemon", "2026-09-25 09:00:00")
            ]
        },
        {
            "id": "CMP-DEMO-009",
            "desc": "Lift cabin indicator display flickering and emergency intercom crackling with static in Hostel Block A",
            "cat": "Lift/Elevator", "sub": "Intercom & Display",
            "dept": "Lift Maintenance Dept", "person": "Lift Maintenance Officer",
            "loc": "Hostel Block A", "prio": "Medium", "status": "Acknowledged",
            "user_id": student_id, "incident_id": None,
            "seen": 1, "ack": 1, "ver": 0, "esc": 0,
            "created": "2026-09-25 11:00:00", "sla_hours": 24,
            "timeline": [
                ("Submitted", "Reported by Student User", "Student User", "2026-09-25 11:00:00"),
                ("Assigned", "Assigned to Lift Maintenance Dept", "System Routing", "2026-09-25 11:00:05"),
                ("Seen", "Viewed by Lift Maintenance Officer", "Lift Maintenance Officer", "2026-09-25 11:20:00"),
                ("Acknowledged", "SLA confirmed; electronic display replacement scheduled with OEM vendor", "Lift Maintenance Officer", "2026-09-25 11:50:00")
            ]
        },

        # --- 1 Mess / Food Problem ---
        {
            "id": "CMP-DEMO-010",
            "desc": "Steam Bain-Marie counter food warming thermostat broken in North Dining Hall; food serving cold",
            "cat": "Hostel Food/Mess", "sub": "Dining Equipment",
            "dept": "Mess / Food Administration", "person": "Mess Manager",
            "loc": "Cafeteria / Mess", "prio": "Medium", "status": "In Progress",
            "user_id": student_id, "incident_id": None,
            "seen": 1, "ack": 1, "ver": 0, "esc": 0,
            "created": "2026-09-25 12:30:00", "sla_hours": 24,
            "timeline": [
                ("Submitted", "Reported by Student User", "Student User", "2026-09-25 12:30:00"),
                ("Assigned", "Assigned to Mess / Food Administration", "System Routing", "2026-09-25 12:30:05"),
                ("Seen", "Inspected by Mess Manager", "Mess Manager", "2026-09-25 12:45:00"),
                ("Acknowledged", "Acknowledged; heating element replacement requested from kitchen equipment contractor", "Mess Manager", "2026-09-25 13:10:00")
            ]
        },

        # --- 1 Laboratory Equipment Problem ---
        {
            "id": "CMP-DEMO-011",
            "desc": "Digital Storage Oscilloscope Channel 2 grounding fault at Workstation 6 in Central Electronics Lab",
            "cat": "Laboratory", "sub": "Electronics Equipment",
            "dept": "Electrical Maintenance", "person": "Chief Electrician",
            "loc": "Central Laboratory", "prio": "Medium", "status": "Acknowledged",
            "user_id": teacher_id, "incident_id": None,
            "seen": 1, "ack": 1, "ver": 0, "esc": 0,
            "created": "2026-09-25 14:10:00", "sla_hours": 24,
            "timeline": [
                ("Submitted", "Reported by Prof. Ramesh Kumar", "Prof. Ramesh Kumar", "2026-09-25 14:10:00"),
                ("Assigned", "Assigned to Electrical Maintenance", "System Routing", "2026-09-25 14:10:05"),
                ("Seen", "Reviewed by Chief Electrician", "Chief Electrician", "2026-09-25 14:35:00"),
                ("Acknowledged", "SLA confirmed; testing earth grounding impedance on Bench 6", "Chief Electrician", "2026-09-25 15:00:00")
            ]
        },

        # --- 1 Security Problem ---
        {
            "id": "CMP-DEMO-012",
            "desc": "North Gate automated boom barrier RFID scanner failing intermittently on student vehicle entry",
            "cat": "Security", "sub": "Access Control",
            "dept": "Security & Parking", "person": "Security Officer",
            "loc": "Campus Gate", "prio": "Low", "status": "Submitted",
            "user_id": student_id, "incident_id": None,
            "seen": 0, "ack": 0, "ver": 0, "esc": 0,  # Pending
            "created": "2026-09-25 16:30:00", "sla_hours": 48,
            "timeline": [
                ("Submitted", "Reported by Student User via Web Portal", "Student User", "2026-09-25 16:30:00"),
                ("Assigned", "Auto-routed to Security & Parking", "System Routing", "2026-09-25 16:30:05")
            ]
        }
    ]

    for c in demo_complaints:
        dt_c = datetime.datetime.strptime(c["created"], "%Y-%m-%d %H:%M:%S")
        deadline_dt = dt_c + datetime.timedelta(hours=c["sla_hours"])
        deadline_str = deadline_dt.strftime("%Y-%m-%d %H:%M:%S")

        ack_at = c["created"] if c["ack"] else None
        ack_by = c["person"] if c["ack"] else None
        first_view = c["created"] if c["seen"] else None
        seen_at = c["created"] if c["seen"] else None
        seen_by = c["person"] if c["seen"] else None

        esc_at = deadline_str if c.get("esc") else None
        esc_reason = c.get("esc_reason")

        cursor.execute('''
        INSERT INTO complaints (
            id, original_complaint_id, user_id, description, category, subcategory,
            department, assigned_person, location, priority, status, seen,
            seen_at, seen_by, first_viewed_at, assigned_at, acknowledged_at,
            acknowledged_by, acknowledgement_deadline, resolution_note, escalated, escalation_level,
            escalated_at, escalation_reason, incident_id, source, has_evidence,
            evidence_provenance, user_verified, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Web Portal', 1, 'Demo Verified Record', ?, ?, ?)
        ''', (
            c["id"], c["id"], c["user_id"], c["desc"], c["cat"], c["sub"],
            c["dept"], c["person"], c["loc"], c["prio"], c["status"],
            c["seen"], seen_at, seen_by, first_view, c["created"],
            ack_at, ack_by, deadline_str, c.get("res_note"), c.get("esc", 0), c.get("esc_level", 0),
            esc_at, esc_reason, c.get("incident_id"), c["ver"],
            c["created"], now_str
        ))

        # Insert timeline events
        for status_step, desc, updated_by, t_time in c["timeline"]:
            cursor.execute('''
            INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
            VALUES (?, ?, ?, ?, ?)
            ''', (c["id"], status_step, desc, updated_by, t_time))

    conn.commit()
    conn.close()
    print("Demo database database_demo.db successfully created with 12 connected demonstration records!")

if __name__ == "__main__":
    build_demo_db()
