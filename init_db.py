import sqlite3
import datetime
from database import init_db, get_db

def seed_data():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DROP TABLE IF EXISTS complaint_timeline")
    cursor.execute("DROP TABLE IF EXISTS complaints")
    cursor.execute("DROP TABLE IF EXISTS users")
    cursor.execute("DROP TABLE IF EXISTS departments")
    cursor.execute("DROP TABLE IF EXISTS organizations")
    conn.commit()

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

    # 3. Users (Name, Email, Password, Role, Org ID, Department)
    users = [
        # Regular Users
        ("Student User", "student@college.edu", "student123", "User", 1, "Computer Science"),
        ("Teaching Staff", "teacher@college.edu", "teacher123", "User", 1, "Electrical Engineering"),
        ("Non-Teaching Staff", "staff@college.edu", "staff123", "User", 1, "Administration"),
        ("Research Staff", "researcher@college.edu", "research123", "User", 1, "Biotech Research"),

        # Department Admins
        ("Network Admin", "network.admin@college.edu", "networkpass", "Department Admin", 1, "Network Administration"),
        ("Mess Manager", "mess.manager@college.edu", "messpass", "Department Admin", 1, "Mess / Food Administration"),
        ("Maintenance Admin", "maintenance.admin@college.edu", "maintpass", "Department Admin", 1, "Water & Maintenance Dept"),
        ("Housekeeping Supervisor", "housekeeping@college.edu", "cleanpass", "Department Admin", 1, "Housekeeping Dept"),
        ("Security Officer", "security@college.edu", "secpass", "Department Admin", 1, "Security & Parking"),
        ("Lift Maintenance Officer", "lift.officer@college.edu", "liftpass", "Department Admin", 1, "Lift Maintenance Dept"),

        # Organization Admin
        ("College Admin", "admin@college.edu", "admin123", "Organization Admin", 1, "Central Administration")
    ]

    for name, email, password, role, org_id, dept in users:
        cursor.execute("INSERT INTO users (name, email, password, role, organization_id, department) VALUES (?, ?, ?, ?, ?, ?)",
                       (name, email, password, role, org_id, dept))

    # Get student user ID for sample complaints
    cursor.execute("SELECT id FROM users WHERE email='student@college.edu'")
    student_id = cursor.fetchone()['id']

    # 4. Sample pre-existing Complaints for demonstration
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    sample_complaints = [
        {
            "id": "CMP-DEMO-1",
            "original_id": "CMP-DEMO-1",
            "desc": "Projector lens is damaged in Classroom 302",
            "cat": "Classroom Facilities",
            "dept": "Academic Administration",
            "person": "Academic Admin",
            "loc": "Main Academic Block",
            "prio": "Medium",
            "status": "In Progress",
            "seen": 1,
            "seen_at": "2026-09-01 10:15:00",
            "seen_by": "Academic Admin"
        },
        {
            "id": "CMP-DEMO-2",
            "original_id": "CMP-DEMO-2",
            "desc": "Street light flickering near Campus Parking",
            "cat": "Electricity",
            "dept": "Electrical Maintenance",
            "person": "Chief Electrician",
            "loc": "Campus Parking",
            "prio": "Low",
            "status": "Resolved",
            "seen": 1,
            "seen_at": "2026-09-01 11:00:00",
            "seen_by": "Chief Electrician",
            "note": "Replaced bulb and repaired fixture connection."
        }
    ]

    for sc in sample_complaints:
        cursor.execute('''
        INSERT INTO complaints (
            id, original_complaint_id, user_id, description, category, department, assigned_person,
            location, priority, status, seen, seen_at, seen_by, resolution_note, escalated, escalation_reason, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', ?, ?)
        ''', (
            sc['id'], sc['original_id'], student_id, sc['desc'], sc['cat'], sc['dept'], sc['person'],
            sc['loc'], sc['prio'], sc['status'], sc['seen'], sc['seen_at'], sc['seen_by'], sc.get('note', ''), now, now
        ))

        # Timeline entries
        cursor.execute("INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp) VALUES (?, 'Submitted', 'Complaint registered', 'Student User', ?)", (sc['id'], now))
        cursor.execute("INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp) VALUES (?, 'Forwarded', 'Routed to department', 'AI Engine', ?)", (sc['id'], now))
        if sc['seen']:
            cursor.execute("INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp) VALUES (?, 'Seen', 'Opened by admin', ?, ?)", (sc['id'], sc['seen_by'], sc['seen_at']))

    conn.commit()
    conn.close()
    print("Database initialized and seeded successfully!")

if __name__ == '__main__':
    seed_data()
