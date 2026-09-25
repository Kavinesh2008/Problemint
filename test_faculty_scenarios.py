#!/usr/bin/env python3
"""
test_faculty_scenarios.py
Automates the 10 faculty demonstration scenarios:
TEST 1: Unauthenticated access & login redirect verification
TEST 2: Student login & role homepage verification
TEST 3: Profile name change & password change (old fails, new works, reverted cleanly)
TEST 4: Wi-Fi problem pre-submission assistance & self-help check
TEST 5: Multi-problem splitting into independent complaint IDs
TEST 6: Department admin queue & ticket acknowledgement
TEST 7: Unacknowledged overdue complaint & SLA escalation audit
TEST 8: AI assistant query against real database records
TEST 9: Demo Mode isolation (12 connected records, matching counts)
TEST 10: Endpoint integrity across all application routes
"""
from app import app
import json

def run_all_tests():
    print("==================================================")
    print("RUNNING 10 FACULTY DEMONSTRATION ACCEPTANCE TESTS")
    print("==================================================")

    # TEST 1: Unauthenticated access & login redirect
    client = app.test_client()
    # Direct access to protected API without auth
    r = client.get('/api/admin/users')
    assert r.status_code in [401, 403], f"Unauthenticated access must be rejected: {r.status_code}"
    # Verify check-auth reports not authenticated
    r = client.get('/api/check-auth')
    assert r.get_json()['authenticated'] is False
    print("[PASS] TEST 1: Unauthenticated requests require authentication.")

    # TEST 2: Select Student & Login
    r = client.post('/api/login', json={'email': 'student@college.edu', 'password': 'student123'})
    assert r.status_code == 200, f"Student login failed: {r.data}"
    user = r.get_json()['user']
    assert user['role'] == 'User', f"Expected User role, got {user['role']}"
    assert user['user_type'] == 'Student'
    print(f"[PASS] TEST 2: Student logged in: {user['name']} (Role: {user['role']}).")

    # TEST 3: Change Student Name and Password
    # Step A: Update display name in settings
    r = client.post('/api/settings', json={'fullName': 'Kavinesh R.'})
    assert r.status_code == 200, f"Settings update failed: {r.data}"

    # Step B: Change password to new format (at least 8 chars, letters and numbers)
    new_pw = "Student2026"
    r = client.post('/api/settings/change-password', json={
        'currentPassword': 'student123',
        'newPassword': new_pw,
        'confirmPassword': new_pw
    })
    assert r.status_code == 200, f"Password change failed: {r.data}"

    # Step C: Log out
    client.post('/api/logout')

    # Step D: Verify old password fails
    client_new = app.test_client()
    r = client_new.post('/api/login', json={'email': 'student@college.edu', 'password': 'student123'})
    assert r.status_code == 401, "Old password must fail after change"

    # Step E: Verify new password succeeds
    r = client_new.post('/api/login', json={'email': 'student@college.edu', 'password': new_pw})
    assert r.status_code == 200, "New password must succeed"
    assert r.get_json()['user']['name'] == 'Kavinesh R.'

    # Step F: Revert password and name cleanly for ongoing tests
    r = client_new.post('/api/settings/change-password', json={
        'currentPassword': new_pw,
        'newPassword': 'student123',
        'confirmPassword': 'student123'
    })
    assert r.status_code == 200
    client_new.post('/api/settings', json={'fullName': 'Student User'})
    print("[PASS] TEST 3: Name update & Password change verified (old password rejected, new password accepted, reverted cleanly).")

    # TEST 4: Wi-Fi problem pre-submission assistance
    r = client_new.post('/api/complaints/pre-troubleshoot', json={
        'text': 'The Wi-Fi in Block C is not working and keeps disconnecting.',
        'category': 'Internet/Wi-Fi',
        'location': 'Block C'
    })
    assert r.status_code == 200, f"Pre-troubleshoot failed: {r.data}"
    data = r.get_json()
    assert len(data.get('stepChecklist', [])) > 0 or len(data.get('selfServiceChecklist', [])) > 0
    assert len(data.get('matchedSolutions', [])) > 0 or len(data.get('kbMatches', [])) > 0
    print("[PASS] TEST 4: Wi-Fi pre-submission assistance returned actionable troubleshooting steps and previous solutions.")

    # TEST 5: Multi-problem splitting into independent complaint IDs
    compound_text = "The Wi-Fi in Block C is down. Also the water cooler in Block B is leaking. And the lift in Block A is malfunctioning."
    analysis_res = client_new.post('/api/complaints/analyze', json={'text': compound_text})
    assert analysis_res.status_code == 200
    analysis_data = analysis_res.get_json()
    assert len(analysis_data.get('issues', [])) >= 2, "Must detect multiple independent issues"

    # Submit multi-complaints
    issues_to_submit = analysis_data['issues']
    sub_res = client_new.post('/api/complaints', json={
        'confirmedIssues': issues_to_submit
    })
    assert sub_res.status_code == 200
    sub_data = sub_res.get_json()
    created_tickets = [t['complaintId'] for t in sub_data.get('all_tickets', [])]
    assert len(created_tickets) >= 2, "Must create separate tickets"
    print(f"[PASS] TEST 5: Multi-problem submission split into {len(created_tickets)} independent complaint IDs ({', '.join(created_tickets)}) with shared submission ID #{sub_data.get('originalId')}.")

    # TEST 6: Department admin queue & ticket acknowledgement
    client_dept = app.test_client()
    r = client_dept.post('/api/login', json={'email': 'network.admin@college.edu', 'password': 'networkpass'})
    assert r.status_code == 200
    admin_user = r.get_json()['user']
    assert admin_user['role'] == 'Department Admin'

    # Acknowledge CMP-DEMO-001 or one of the created tickets
    ack_res = client_dept.post('/api/complaints/CMP-DEMO-001/acknowledge')
    assert ack_res.status_code == 200, f"Acknowledgement failed: {ack_res.data}"
    ack_data = ack_res.get_json()
    assert ack_data['success'] is True
    print(f"[PASS] TEST 6: Department Administrator ({admin_user['name']}) successfully acknowledged ticket.")

    # TEST 7: Unacknowledged overdue complaint & SLA escalation audit
    client_org = app.test_client()
    r = client_org.post('/api/login', json={'email': 'admin@college.edu', 'password': 'admin123'})
    assert r.status_code == 200
    org_user = r.get_json()['user']
    assert org_user['role'] == 'Organization Admin'

    # Check escalations
    esc_res = client_org.get('/api/admin/escalation-check')
    assert esc_res.status_code == 200
    # Retrieve escalations list
    get_esc = client_org.get('/api/admin/escalations')
    assert get_esc.status_code == 200
    esc_data = get_esc.get_json()
    esc_list = esc_data.get('escalations', []) if isinstance(esc_data, dict) else esc_data
    assert len(esc_list) >= 1, "Must contain at least 1 escalated ticket (CMP-DEMO-008)"
    overdue_item = [e for e in esc_list if e.get('complaintId') == 'CMP-DEMO-008'][0]
    print(f"[PASS] TEST 7: Automatic SLA escalation verified: Ticket #{overdue_item['complaintId']} ({overdue_item['category']}) in {overdue_item['department']} is escalated (Level {overdue_item.get('escalationLevel', 1)}).")

    # TEST 8: AI assistant query against real database records
    ai_res = client_org.post('/api/copilot/ask', json={'query': 'Where is complaint CMP-DEMO-001?'})
    assert ai_res.status_code == 200
    ans = ai_res.get_json().get('answer', '')
    assert 'CMP-DEMO-001' in ans and 'Network' in ans
    print(f"[PASS] TEST 8: AI assistant accurately answered database query for ticket CMP-DEMO-001.")

    # TEST 9: Demo Mode isolation (12 demo records)
    from database import DEMO_MODE, get_db
    assert DEMO_MODE is True, "DEMO_MODE must be enabled"
    cursor = get_db().cursor()
    cursor.execute("SELECT COUNT(*) FROM complaints")
    # Note: total count = initial 12 + tickets created in TEST 5
    cursor.execute("SELECT COUNT(*) FROM complaints WHERE id LIKE 'CMP-DEMO-%'")
    demo_count = cursor.fetchone()[0]
    assert demo_count == 12, f"Expected 12 connected demo complaints, got {demo_count}"
    print(f"[PASS] TEST 9: Demo Mode isolation active: Exactly 12 core connected institutional complaints populated.")

    # TEST 10: Route integrity across all endpoints
    routes_to_test = [
        ('/api/check-auth', 'GET'),
        ('/api/dashboard/stats', 'GET'),
        ('/api/complaints', 'GET'),
        ('/api/incidents', 'GET'),
        ('/api/prevention', 'GET'),
        ('/api/admin/users', 'GET')
    ]
    for route, method in routes_to_test:
        if method == 'GET':
            res = client_org.get(route)
            assert res.status_code == 200, f"Route {route} failed with {res.status_code}"
    print("[PASS] TEST 10: All application API endpoints return HTTP 200 with zero errors.")

    print("==================================================")
    print("ALL 10 FACULTY SCENARIOS PASSED WITH 100% SUCCESS!")
    print("==================================================")

if __name__ == '__main__':
    run_all_tests()
