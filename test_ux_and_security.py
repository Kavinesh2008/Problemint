#!/usr/bin/env python3
"""
test_ux_and_security.py
Validates the new UX workflows and security requirements using Flask test client:
- Multi-user authentication across distinct roles
- Role mismatch security (role selection UI cannot grant unearned privilege)
- Pre-troubleshoot AI & Self-Service Resolution
- SLA Acknowledgement and Escalation Audit
- Password Change and Admin User Management
"""
from app import app
from database import get_db
import json

def run_tests():
    print("==================================================")
    print("RUNNING UX & SECURITY VALIDATION SUITE (Test Client)")
    print("==================================================")

    # 1. Test student login
    client = app.test_client()
    r = client.post("/api/login", json={"email": "student@college.edu", "password": "student123"})
    assert r.status_code == 200, f"Student login failed: {r.data}"
    user = r.get_json()["user"]
    print(f"[PASS] Student logged in: {user['name']} (Role: {user['role']}, Type: {user['user_type']})")
    assert user["role"] == "User", "Role must be User"

    # Regression: role selection cannot bypass password validation
    client_role_bypass = app.test_client()
    r = client_role_bypass.post("/api/login", json={"email": "student@college.edu", "password": "wrongpass", "roleKey": "dept-admin"})
    assert r.status_code == 401, f"Wrong password must not succeed even when a role is selected: {r.data}"
    print("[PASS] Security: role selection no longer bypasses password checks")

    # Check student attempting admin actions
    r = client.get("/api/admin/users")
    assert r.status_code == 403, "Student must be forbidden from accessing admin users"
    print("[PASS] Security: Student blocked from accessing /api/admin/users (HTTP 403)")

    # Regression: unauthenticated requests must not default to a fake user account
    anon = app.test_client()
    r = anon.get("/api/notifications")
    assert r.status_code == 401, f"Unauthenticated notifications call should be rejected: {r.data}"
    print("[PASS] Security: unauthenticated notifications call is rejected")

    # Notifications must contain only this student's complaint history and persist read state.
    r = client.get("/api/notifications")
    assert r.status_code == 200, f"Student notifications failed: {r.data}"
    student_notifications = r.get_json()
    assert all(item.get("complaintId") != "CMP-2026-1149" for item in student_notifications), "A hard-coded complaint leaked into the student feed"
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM complaints WHERE user_id = (SELECT id FROM users WHERE email = ?)", ("student@college.edu",))
    student_complaint_ids = {row["id"] for row in cursor.fetchall()}
    conn.close()
    assert all(item["complaintId"] in student_complaint_ids for item in student_notifications), "Student feed contains another user's complaint"
    r = client.post("/api/notifications/read", json={})
    assert r.status_code == 200, f"Marking notifications read failed: {r.data}"
    assert all(not item["unread"] for item in client.get("/api/notifications").get_json()), "Read state did not persist"
    print("[PASS] Student notification scope and persistent read state")

    # Verify all nine account types can authenticate and reach their scoped data APIs.
    role_accounts = [
        ("Teaching Staff", "teacher@college.edu", "teacher123"),
        ("Non-Teaching Staff", "staff@college.edu", "staff123"),
        ("Research Staff", "researcher@college.edu", "research123"),
        ("Lab Technician", "labtech@college.edu", "labpass"),
        ("Maintenance Worker", "maintworker@college.edu", "maintworkerpass"),
        ("Housekeeping Staff", "houseworker@college.edu", "houseworkerpass"),
    ]
    for label, email, password in role_accounts:
        role_client = app.test_client()
        login_res = role_client.post("/api/login", json={"email": email, "password": password})
        assert login_res.status_code == 200, f"{label} login failed: {login_res.data}"
        assert role_client.get("/api/complaints").status_code == 200, f"{label} complaint scope failed"
        assert role_client.get("/api/notifications").status_code == 200, f"{label} notification scope failed"
    print("[PASS] Teaching, non-teaching, research, lab, maintenance, and housekeeping account access")

    worker_client = app.test_client()
    assert worker_client.post("/api/login", json={"email": "labtech@college.edu", "password": "labpass"}).status_code == 200
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM complaints WHERE assigned_person != (SELECT name FROM users WHERE email = ?) LIMIT 1", ("labtech@college.edu",))
    unassigned_task = cursor.fetchone()
    conn.close()
    if unassigned_task:
        task_id = unassigned_task["id"]
        assert worker_client.get(f"/api/complaints/{task_id}").status_code == 403, "Worker viewed an unassigned complaint"
        assert worker_client.post(f"/api/complaints/{task_id}/update-status", json={"status": "In Progress", "note": "unauthorized"}).status_code == 403, "Worker updated an unassigned complaint"
        print("[PASS] Operational staff cannot view or update another worker's complaint")

    # 2. Test Dept Admin login (Network Admin)
    client_admin = app.test_client()
    r = client_admin.post("/api/login", json={"email": "network.admin@college.edu", "password": "networkpass"})
    assert r.status_code == 200, f"Dept admin login failed: {r.data}"
    admin_user = r.get_json()["user"]
    print(f"[PASS] Dept Admin logged in: {admin_user['name']} (Role: {admin_user['role']}, Dept: {admin_user['department']})")
    assert admin_user["role"] == "Department Admin", "Role must be Department Admin"

    # 3. Test Org Admin login
    client_org = app.test_client()
    r = client_org.post("/api/login", json={"email": "admin@college.edu", "password": "admin123"})
    assert r.status_code == 200, f"Org admin login failed: {r.data}"
    org_user = r.get_json()["user"]
    print(f"[PASS] Org Admin logged in: {org_user['name']} (Role: {org_user['role']})")
    assert org_user["role"] == "Organization Admin", "Role must be Organization Admin"

    # Org admin can access /api/admin/users
    r = client_org.get("/api/admin/users")
    assert r.status_code == 200, f"Org admin failed to get users: {r.data}"
    users_list = r.get_json()
    print(f"[PASS] Org Admin successfully accessed /api/admin/users: {len(users_list)} registered institutional accounts")

    # 4. Pre-troubleshoot AI test
    r = client.post("/api/complaints/pre-troubleshoot", json={
        "text": "Wi-Fi is not connecting in Block C and there are loose exposed electrical wires",
        "category": "Internet/Wi-Fi",
        "location": "Block C"
    })
    assert r.status_code == 200, f"Pre-troubleshoot failed: {r.data}"
    pre = r.get_json()
    print(f"[PASS] Pre-troubleshoot executed successfully:")
    print(f"       - Safety warnings detected: {len(pre.get('safetyWarnings', []))}")
    print(f"       - Knowledge base matches: {len(pre.get('kbMatches', []))}")
    print(f"       - Self-service checklist items: {len(pre.get('selfServiceChecklist', []))}")
    assert len(pre.get('safetyWarnings', [])) > 0, "Exposed wires must trigger safety warning"

    # 5. Self-service resolved logging
    r = client.post("/api/complaints/self-service-resolved", json={
        "problemType": "Internet/Wi-Fi",
        "location": "Block C",
        "solutionUsed": "DNS flush and reconnect to campus portal"
    })
    assert r.status_code == 200, f"Self-service log failed: {r.data}"
    print("[PASS] Self-service resolution logged successfully without filing unnecessary ticket")

    # 6. SLA Escalation check
    r = client_org.get("/api/admin/escalation-check")
    assert r.status_code == 200, f"Escalation check failed: {r.data}"
    esc_data = r.get_json()
    print(f"[PASS] SLA Escalation Audit: {esc_data.get('escalatedCount', 0)} tickets escalated / checked")

    # 7. Password change test (for student)
    r = client.post("/api/settings/change-password", json={
        "currentPassword": "student123",
        "newPassword": "newpassword456",
        "confirmPassword": "newpassword456"
    })
    assert r.status_code == 200, f"Password change failed: {r.data}"
    print("[PASS] Password change succeeded")

    # Revert password back
    r = client.post("/api/settings/change-password", json={
        "currentPassword": "newpassword456",
        "newPassword": "student123",
        "confirmPassword": "student123"
    })
    assert r.status_code == 200, f"Password revert failed: {r.data}"
    print("[PASS] Password reverted back to student123 successfully")

    print("==================================================")
    print("ALL UX & SECURITY VALIDATION TESTS PASSED (100%)!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
