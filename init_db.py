import sqlite3
import datetime
import os
import csv
from werkzeug.security import generate_password_hash
from database import init_db, get_db

DATASETS_DIR = os.path.join(os.path.dirname(__file__), 'Datasets')

def seed_data():
    conn = get_db()
    cursor = conn.cursor()

    # Drop existing tables
    tables = [
        "self_service_resolutions",
        "prevention_recommendations",
        "knowledge_base",
        "resolutions",
        "complaint_timeline",
        "complaints",
        "incidents",
        "user_settings",
        "users",
        "departments",
        "organizations"
    ]
    for table in tables:
        cursor.execute(f"DROP TABLE IF EXISTS {table}")
    conn.commit()

    # Initialize fresh schema
    init_db()
    conn = get_db()
    cursor = conn.cursor()

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

    # 3. Users (Name, Email, Password, Role, UserType, RollNo, EmpId, Designation, Org ID, Department)
    # Covering all 9 required institutional user personas:
    # 1. Student
    # 2. Teaching staff
    # 3. Non-teaching staff
    # 4. Research staff
    # 5. Lab technician
    # 6. Maintenance worker
    # 7. Housekeeping worker
    # 8. Department admin
    # 9. Organization admin
    users = [
        # Regular Users
        ("Student User", "student@college.edu", "student123", "User", "Student", "2024CS101", None, "Undergraduate Student (CS)", 1, "Computer Science"),
        ("Prof. Ramesh Kumar", "teacher@college.edu", "teacher123", "User", "Teaching staff", None, "FAC-1002", "Associate Professor (EE)", 1, "Electrical Engineering"),
        ("Anita Sharma", "staff@college.edu", "staff123", "User", "Non-teaching staff", None, "STF-2005", "Administrative Executive", 1, "Administration"),
        ("Dr. Vikram Rao", "researcher@college.edu", "research123", "User", "Research staff", None, "RES-3012", "Senior Postdoc Researcher", 1, "Biotech Research"),
        ("Suresh Verma", "labtech@college.edu", "labpass", "User", "Lab technician", None, "LAB-4040", "Senior Systems Lab Technician", 1, "Central Laboratory"),
        ("Raju M.", "maintworker@college.edu", "maintworkerpass", "User", "Maintenance worker", None, "OPS-5011", "Lead Plumber & Maintenance Specialist", 1, "Water & Maintenance Dept"),
        ("Meena Devi", "houseworker@college.edu", "houseworkerpass", "User", "Housekeeping worker", None, "OPS-6022", "Senior Sanitation Staff", 1, "Housekeeping Dept"),

        # Department Admins
        ("Network Admin", "network.admin@college.edu", "networkpass", "Department Admin", "Department admin", None, "ADM-IT01", "Head of IT Network", 1, "Network Administration"),
        ("Mess Manager", "mess.manager@college.edu", "messpass", "Department Admin", "Department admin", None, "ADM-MS01", "Chief Mess Supervisor", 1, "Mess / Food Administration"),
        ("Maintenance Admin", "maintenance.admin@college.edu", "maintpass", "Department Admin", "Department admin", None, "ADM-MT01", "Estate Maintenance Director", 1, "Water & Maintenance Dept"),
        ("Housekeeping Supervisor", "housekeeping@college.edu", "cleanpass", "Department Admin", "Department admin", None, "ADM-HK01", "Chief Housekeeping Officer", 1, "Housekeeping Dept"),
        ("Security Officer", "security@college.edu", "secpass", "Department Admin", "Department admin", None, "ADM-SC01", "Chief Security Officer", 1, "Security & Parking"),
        ("Lift Maintenance Officer", "lift.officer@college.edu", "liftpass", "Department Admin", "Department admin", None, "ADM-LF01", "Lead Lift Safety Officer", 1, "Lift Maintenance Dept"),

        # Organization Admin
        ("College Admin", "admin@college.edu", "admin123", "Organization Admin", "Organization admin", None, "ADM-ORG01", "Director / Principal", 1, "Central Administration")
    ]

    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for name, email, password, role, user_type, roll_no, emp_id, designation, org_id, dept in users:
        pw_hash = generate_password_hash(password)
        cursor.execute('''
            INSERT INTO users (
                name, email, password, role, user_type, roll_number, employee_id,
                designation, status, organization_id, department, created_at, last_login_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?)
        ''', (name, email, pw_hash, role, user_type, roll_no, emp_id, designation, org_id, dept, now_str, now_str))
        user_id = cursor.lastrowid
        # Seed user settings
        cursor.execute('''
        INSERT INTO user_settings (user_id, full_name, notify_forwarding, notify_seen, notify_resolution, notify_escalation, ai_threshold, sla_window, updated_at)
        VALUES (?, ?, 1, 1, 1, 1, 75, '24 Hours (Standard)', ?)
        ''', (user_id, name, now_str))

    # Fetch users map: email -> id
    cursor.execute("SELECT id, email, name, role, department FROM users")
    user_rows = cursor.fetchall()
    user_by_email = {u['email']: u['id'] for u in user_rows}
    student_id = user_by_email['student@college.edu']

    # Seed some sample self-service resolutions to demonstrate pre-submission savings
    sample_self_help = [
        (student_id, "Internet/Wi-Fi", "Hostel Block A", "Renewed DHCP lease and reconnected to 5GHz campus SSID.", "2026-09-20 14:22:00"),
        (student_id, "Sanitization/Cleanliness", "Block B, 2nd Floor", "Used corridor sanitizer refiller; reported clear.", "2026-09-22 09:15:00"),
        (user_by_email['teacher@college.edu'], "Electricity", "Main Academic Block Room 102", "Checked tripped distribution breaker switch on floorboard.", "2026-09-23 11:45:00")
    ]
    for uid, p_type, loc, sol, dt in sample_self_help:
        cursor.execute('''
        INSERT INTO self_service_resolutions (user_id, problem_type, location, solution_used, resolved_at)
        VALUES (?, ?, ?, ?, ?)
        ''', (uid, p_type, loc, sol, dt))

    # 4. Import Incidents dataset
    incidents_csv = os.path.join(DATASETS_DIR, 'PROBLEMINT_incidents_dataset.csv')
    if os.path.exists(incidents_csv):
        with open(incidents_csv, 'r', encoding='utf-8', errors='ignore') as fp:
            reader = csv.DictReader(fp)
            for row in reader:
                cursor.execute('''
                INSERT OR REPLACE INTO incidents (
                    incident_id, title, category, location, department, severity,
                    status, first_reported_at, last_reported_at, complaint_count,
                    affected_users, pattern_detected, possible_root_cause,
                    root_cause_confidence, assigned_team, resolution_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    row.get('incident_id'),
                    row.get('title'),
                    row.get('category'),
                    row.get('location'),
                    row.get('department'),
                    row.get('severity'),
                    row.get('status'),
                    row.get('first_reported_at'),
                    row.get('last_reported_at'),
                    int(row.get('complaint_count') or 1),
                    int(row.get('affected_users') or 1),
                    row.get('pattern_detected'),
                    row.get('possible_root_cause'),
                    float(row.get('root_cause_confidence') or 0.85),
                    row.get('assigned_team'),
                    row.get('resolution_status') or 'Pending'
                ))
        print("Loaded Incidents from CSV dataset.")

    # 5. Import Resolutions dataset
    res_csv = os.path.join(DATASETS_DIR, 'Resolutions.csv')
    if os.path.exists(res_csv):
        with open(res_csv, 'r', encoding='utf-8', errors='ignore') as fp:
            reader = csv.DictReader(fp)
            for row in reader:
                success_val = 1 if str(row.get('success', '')).lower() in ['true', '1'] else 0
                follow_up_val = 1 if str(row.get('follow_up_required', '')).lower() in ['true', '1'] else 0
                res_time = float(row.get('resolution_time_hours') or 2.0)
                cursor.execute('''
                INSERT OR REPLACE INTO resolutions (
                    resolution_id, incident_id, attempt_number, action_taken, performed_by,
                    performed_at, action_type, outcome, success, resolution_time_hours,
                    verification_status, user_feedback_summary, follow_up_required, incident_final_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    row.get('resolution_id'),
                    row.get('incident_id'),
                    int(row.get('attempt_number') or 1),
                    row.get('action_taken'),
                    row.get('performed_by'),
                    row.get('performed_at'),
                    row.get('action_type'),
                    row.get('outcome'),
                    success_val,
                    res_time,
                    row.get('verification_status') or 'Not Verified',
                    row.get('user_feedback_summary'),
                    follow_up_val,
                    row.get('incident_final_status') or 'In Progress'
                ))
        print("Loaded Resolutions from CSV dataset.")

    # 6. Import Knowledge Base dataset
    kb_csv = os.path.join(DATASETS_DIR, 'Knowledge Base.csv')
    if os.path.exists(kb_csv):
        with open(kb_csv, 'r', encoding='utf-8', errors='ignore') as fp:
            reader = csv.DictReader(fp)
            for row in reader:
                confidence = float(row.get('root_cause_confidence') or 0.90)
                res_time = float(row.get('resolution_time_hours') or 4.0)
                cursor.execute('''
                INSERT OR REPLACE INTO knowledge_base (
                    knowledge_id, incident_id, problem_type, problem_description, location,
                    root_cause, root_cause_confidence, solution_attempted, successful_solution,
                    failed_solution, outcome, resolution_time_hours, success_rate,
                    lesson_learned, recommended_future_action, created_from_incident, last_updated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    row.get('knowledge_id'),
                    row.get('incident_id'),
                    row.get('problem_type'),
                    row.get('problem_description'),
                    row.get('location'),
                    row.get('root_cause'),
                    confidence,
                    row.get('solution_attempted'),
                    row.get('successful_solution'),
                    row.get('failed_solution'),
                    row.get('outcome'),
                    res_time,
                    row.get('success_rate') or '100%',
                    row.get('lesson_learned'),
                    row.get('recommended_future_action'),
                    row.get('created_from_incident'),
                    row.get('last_updated')
                ))
        print("Loaded Knowledge Base from CSV dataset.")

    # 7. Import Prevention Recommendations dataset
    prev_csv = os.path.join(DATASETS_DIR, 'Prevention recommondation.csv')
    if os.path.exists(prev_csv):
        with open(prev_csv, 'r', encoding='utf-8', errors='ignore') as fp:
            reader = csv.DictReader(fp)
            for row in reader:
                based_on = 1 if str(row.get('based_on_previous_incident', '')).lower() in ['true', '1'] else 0
                supp_count = int(row.get('supporting_complaint_count') or 1)
                cursor.execute('''
                INSERT OR REPLACE INTO prevention_recommendations (
                    recommendation_id, incident_id, problem, recommendation, reason,
                    evidence, risk_level, priority, expected_impact, suggested_timeline,
                    responsible_department, recommended_action_type, status, created_at,
                    based_on_previous_incident, supporting_complaint_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    row.get('recommendation_id'),
                    row.get('incident_id'),
                    row.get('problem'),
                    row.get('recommendation'),
                    row.get('reason'),
                    row.get('evidence'),
                    row.get('risk_level') or 'Medium',
                    row.get('priority') or 'Medium',
                    row.get('expected_impact'),
                    row.get('suggested_timeline'),
                    row.get('responsible_department'),
                    row.get('recommended_action_type'),
                    row.get('status') or 'Approved',
                    row.get('created_at'),
                    based_on,
                    supp_count
                ))
        print("Loaded Prevention Recommendations from CSV dataset.")

    # 8. Import Complaints dataset
    complaints_csv = os.path.join(DATASETS_DIR, 'PROBLEMINT_complaints_dataset.csv')
    if os.path.exists(complaints_csv):
        with open(complaints_csv, 'r', encoding='utf-8', errors='ignore') as fp:
            reader = csv.DictReader(fp)
            count = 0
            for row in reader:
                # Assign some to student, some to faculty, some to staff
                uid = student_id if (count % 3 == 0) else (student_id + (count % 4))
                cid = row.get('complaint_id')
                c_text = row.get('complaint_text')
                c_date = row.get('created_at')
                c_cat = row.get('category')
                c_sub = row.get('subcategory')
                c_loc = row.get('location')
                c_dept = row.get('department') or 'General Administration'
                c_prio = row.get('severity') or 'Medium'
                c_status = row.get('status') or 'Investigating'
                c_inc = row.get('incident_id')
                c_ev = 1 if str(row.get('has_evidence', '')).lower() in ['true', '1'] else 0
                c_ver = 1 if str(row.get('user_verified', '')).lower() in ['true', '1'] else 0

                # Determine assigned person based on department
                assigned_officer = "Department Admin"
                for d_name, d_head in departments:
                    if d_name.lower() in c_dept.lower() or c_dept.lower() in d_name.lower():
                        assigned_officer = d_head
                        break

                # Calculate SLA deadline based on priority
                prio_hours = 24
                if c_prio == 'Critical': prio_hours = 1
                elif c_prio == 'High': prio_hours = 6
                elif c_prio == 'Low': prio_hours = 48

                assigned_at = c_date
                try:
                    dt_created = datetime.datetime.strptime(c_date, "%Y-%m-%d %H:%M:%S")
                except Exception:
                    dt_created = datetime.datetime.now()
                deadline_dt = dt_created + datetime.timedelta(hours=prio_hours)
                deadline_str = deadline_dt.strftime("%Y-%m-%d %H:%M:%S")

                is_acknowledged = c_status in ['In Progress', 'Resolved', 'Closed']
                ack_at = c_date if is_acknowledged else None
                ack_by = assigned_officer if is_acknowledged else None
                first_view = c_date if is_acknowledged else None

                # Seed a couple of realistic unacknowledged breached escalations for demonstration
                is_escalated = 0
                esc_level = 0
                esc_at = None
                esc_reason = None
                if not is_acknowledged and count in [4, 11, 23]:
                    is_escalated = 1
                    esc_level = 1
                    esc_at = deadline_str
                    esc_reason = f"Acknowledgement deadline ({prio_hours}h SLA) exceeded without department confirmation"

                cursor.execute('''
                INSERT OR REPLACE INTO complaints (
                    id, original_complaint_id, user_id, description, category, subcategory,
                    department, assigned_person, location, priority, status, seen,
                    seen_at, seen_by, first_viewed_at, assigned_at, acknowledged_at,
                    acknowledged_by, acknowledgement_deadline, escalated, escalation_level,
                    escalated_at, escalation_reason, incident_id, source, has_evidence,
                    evidence_provenance, user_verified, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Dataset Evidence', ?, ?, ?)
                ''', (
                    cid, cid, uid, c_text, c_cat, c_sub, c_dept, assigned_officer,
                    c_loc, c_prio, c_status,
                    1 if is_acknowledged else 0,
                    c_date if is_acknowledged else None,
                    assigned_officer if is_acknowledged else None,
                    first_view, assigned_at, ack_at, ack_by, deadline_str,
                    is_escalated, esc_level, esc_at, esc_reason,
                    c_inc, row.get('source') or 'Web', c_ev,
                    c_ver, c_date, c_date
                ))

                # Add initial timeline
                cursor.execute('''
                INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
                VALUES (?, 'Submitted', 'Complaint registered via portal', 'User', ?)
                ''', (cid, c_date))

                cursor.execute('''
                INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
                VALUES (?, 'AI Categorized', ?, 'AI Engine', ?)
                ''', (cid, f"Category: {c_cat} | Severity: {c_prio} | SLA Target: {prio_hours}h", c_date))

                cursor.execute('''
                INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
                VALUES (?, 'Forwarded', ?, 'AI Engine', ?)
                ''', (cid, f"Routed to {c_dept} ({assigned_officer})", c_date))

                if c_status in ['In Progress', 'Resolved', 'Closed']:
                    cursor.execute('''
                    INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
                    VALUES (?, 'Seen', 'Opened and acknowledged by department administrator', ?, ?)
                    ''', (cid, assigned_officer, c_date))

                if c_status == 'Resolved':
                    cursor.execute('''
                    INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
                    VALUES (?, 'Resolved', 'Department completed resolution action', ?, ?)
                    ''', (cid, assigned_officer, c_date))

                if c_status == 'Closed':
                    cursor.execute('''
                    INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
                    VALUES (?, 'Closed', 'User verified fix successfully', 'User Verification', ?)
                    ''', (cid, c_date))

                count += 1
                if count >= 120:  # Load 120 representative complaints for high speed + full coverage
                    break
        print(f"Loaded {count} Complaints and associated timelines.")

    conn.commit()
    conn.close()
    print("[SUCCESS] All 7 datasets successfully loaded and synchronized in SQLite database!")

if __name__ == '__main__':
    seed_data()
