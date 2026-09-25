import app as flask_app
import json
from database import get_db

client = flask_app.app.test_client()

print("==================================================")
print("TESTING PROBLEMINT COMPREHENSIVE PLATFORM SUITE")
print("==================================================")

# --- TEST 1: AUTHENTICATION & LOGIN ---
print("\n[TEST 1] Testing Unified Authentication...")
login_res = client.post('/api/login', json={'email': 'student@college.edu', 'password': 'student123'})
assert login_res.status_code == 200, f"Login failed: {login_res.data}"
user_data = login_res.get_json()['user']
assert user_data['email'] == 'student@college.edu'
assert user_data['role'] == 'User'
print("[PASS] Unified login succeeded for Student User (Role: User)")

# Check auth check
auth_res = client.get('/api/check-auth')
assert auth_res.status_code == 200
assert auth_res.get_json()['authenticated'] is True
print("[PASS] /api/check-auth verified active session")

# Verify passwords never exposed on /api/users
users_res = client.get('/api/users')
assert users_res.status_code == 200
for u in users_res.get_json():
    assert 'password' not in u, f"Security vulnerability: password exposed for {u['email']}"
print("[PASS] /api/users confirmed safe: 0 passwords exposed in response")

# --- TEST 2: MULTI-PROBLEM SUBMISSION (PHASE 1) ---
print("\n[TEST 2] Testing Multi-Problem Detection & Creation (Phase 1)...")
multi_text = "The Wi-Fi is not working in Block C. The drinking water supply is unavailable in Block B. The lift in Block A is malfunctioning."

# Step A: Analyze multi-issue text
analyze_res = client.post('/api/complaints/analyze', json={'text': multi_text})
assert analyze_res.status_code == 200
analysis = analyze_res.get_json()
assert analysis['num_issues'] == 3, f"Expected 3 issues, got {analysis['num_issues']}"
assert analysis['is_multi_issue'] is True
print(f"[PASS] Detected {analysis['num_issues']} distinct actionable problems across different departments")

# Step B: Submit confirmed multi-issues
confirmed_issues = [
    {
        'description': 'The Wi-Fi is not working in Block C',
        'category': 'Internet/Wi-Fi',
        'location': 'Block C',
        'severity': 'Medium',
        'department': 'Network Administration',
        'assignedPerson': 'Network Admin'
    },
    {
        'description': 'The drinking water supply is unavailable in Block B',
        'category': 'Water Supply',
        'location': 'Block B',
        'severity': 'High',
        'department': 'Water & Maintenance Dept',
        'assignedPerson': 'Maintenance Admin'
    },
    {
        'description': 'The lift in Block A is malfunctioning',
        'category': 'Lift/Elevator',
        'location': 'Block A',
        'severity': 'Critical',
        'department': 'Lift Maintenance Dept',
        'assignedPerson': 'Lift Maintenance Officer'
    }
]

create_res = client.post('/api/complaints', json={'confirmedIssues': confirmed_issues})
assert create_res.status_code == 200
create_data = create_res.get_json()
all_tickets = create_data['all_tickets']
assert len(all_tickets) == 3, f"Expected 3 tickets created, got {len(all_tickets)}"
shared_orig_id = create_data['originalId']
print(f"[PASS] Created 3 independent complaints with shared submission ID #{shared_orig_id}")
for t in all_tickets:
    assert t['complaintId'].startswith(shared_orig_id), f"Ticket {t['complaintId']} does not share original ID"
    print(f"  - Ticket {t['complaintId']}: Category: {t['category']} -> {t['department']} ({t['location']})")

# Step C: Verify symptom clauses of 1 problem are NOT mistakenly split
symptom_text = "The water tap in Block B is leaking, causing water to pool on the floor and making the hallway slippery."
symptom_analysis = client.post('/api/complaints/analyze', json={'text': symptom_text}).get_json()
assert symptom_analysis['num_issues'] == 1, f"Expected 1 issue for symptom clauses, got {symptom_analysis['num_issues']}"
print("[PASS] Verified symptom and participial clauses are accurately kept together as 1 problem")

# --- TEST 3: SETTINGS PERSISTENCE (PHASE 2) ---
print("\n[TEST 3] Testing Settings & Preferences Persistence (Phase 2)...")
update_settings_payload = {
    'fullName': 'Student User (Honors)',
    'notifyForwarding': True,
    'notifySeen': True,
    'notifyResolution': True,
    'notifyEscalation': False,
    'aiThreshold': 82,
    'slaWindow': '12 Hours (High Priority)'
}
save_set_res = client.post('/api/settings', json=update_settings_payload)
assert save_set_res.status_code == 200
assert save_set_res.get_json()['success'] is True
print("[PASS] Settings updated via POST /api/settings")

# Retrieve settings and verify persistence
get_set_res = client.get('/api/settings')
assert get_set_res.status_code == 200
saved_settings = get_set_res.get_json()
assert saved_settings['fullName'] == 'Student User (Honors)'
assert saved_settings['notifyEscalation'] is False
assert saved_settings['aiThreshold'] == 82
assert saved_settings['slaWindow'] == '12 Hours (High Priority)'
print("[PASS] Settings persisted and retrieved accurately across SQLite session")

# Reset name back
client.post('/api/settings', json={'fullName': 'Student User', 'notifyForwarding': True, 'notifySeen': True, 'notifyResolution': True, 'notifyEscalation': True, 'aiThreshold': 75, 'slaWindow': '24 Hours (Standard)'})

# --- TEST 4: CONTEXT-AWARE AI CO-PILOT (PHASE 4) ---
print("\n[TEST 4] Testing AI Co-pilot Real Data Integration (Phase 4)...")
# Query A: pending complaints
copilot_q1 = client.post('/api/copilot', json={'query': 'How many complaints are currently pending?'}).get_json()
assert len(copilot_q1['response']) > 15
print("[PASS] Co-pilot Q1 (Pending Complaints):", copilot_q1['response'][:100], "...")

# Query B: department workload
copilot_q2 = client.post('/api/copilot', json={'query': 'Which department has the most unresolved complaints?'}).get_json()
assert "workload" in copilot_q2['response'].lower() or "unresolved" in copilot_q2['response'].lower()
print("[PASS] Co-pilot Q2 (Department Workload):", copilot_q2['response'])

# Query C: recurring network problems
copilot_q3 = client.post('/api/copilot', json={'query': 'Show recurring network problems'}).get_json()
assert "network" in copilot_q3['response'].lower()
print("[PASS] Co-pilot Q3 (Recurring Network):", copilot_q3['response'][:120], "...")

# Query D: specific complaint lookup
first_ticket_id = all_tickets[0]['complaintId']
copilot_q4 = client.post('/api/copilot', json={'query': f'What happened to complaint {first_ticket_id}?'}).get_json()
assert first_ticket_id in copilot_q4['response']
print(f"[PASS] Co-pilot Q4 (Specific Complaint {first_ticket_id}):", copilot_q4['response'][:120], "...")

# --- TEST 5: DATA PROVENANCE, RESOLUTIONS & VERIFICATION (PHASE 5, 6, 7) ---
print("\n[TEST 5] Testing Incident Detail, Provenance, Resolutions & Verification...")
inc_res = client.get('/api/incidents/INC-001')
assert inc_res.status_code == 200
inc_detail = inc_res.get_json()
assert 'rootCauseHypothesis' in inc_detail
assert 'disclaimer' in inc_detail['rootCauseHypothesis']
assert 'dataProvenance' in inc_detail
print("[PASS] Incident INC-001 retrieved with AI Root Cause Hypothesis & Data Provenance")

# Record Resolution
res_action_res = client.post('/api/resolutions', json={
    'incidentId': 'INC-001',
    'actionTaken': 'Replaced booster pump secondary valve and tested flow rate',
    'performedBy': 'Maintenance Admin',
    'success': True
})
assert res_action_res.status_code == 200
print("[PASS] Resolution attempt recorded successfully in SQLite database")

# Test User Verification: Confirm Solved (Yes -> Closed)
verif_ticket_id = first_ticket_id
verif_res = client.post('/api/verification', json={
    'complaintId': verif_ticket_id,
    'verificationStatus': 'Yes',
    'feedbackText': 'Verified by user, working smoothly now.'
})
assert verif_res.status_code == 200
assert verif_res.get_json()['newStatus'] == 'Closed'
print(f"[PASS] Verification confirmed: Ticket {verif_ticket_id} status transitioned to 'Closed'")

# Test User Verification: Disputed (No -> Reopened)
reopen_ticket_id = all_tickets[1]['complaintId']
reopen_res = client.post('/api/verification', json={
    'complaintId': reopen_ticket_id,
    'verificationStatus': 'No',
    'feedbackText': 'Still no water flowing.'
})
assert reopen_res.status_code == 200
assert reopen_res.get_json()['newStatus'] == 'Reopened'
print(f"[PASS] Verification rejection: Ticket {reopen_ticket_id} status transitioned to 'Reopened'")

# --- TEST 6: KNOWLEDGE BASE & PREVENTION CENTER ---
print("\n[TEST 6] Testing Knowledge Base & Prevention Center APIs...")
kb_res = client.get('/api/knowledge')
assert kb_res.status_code == 200
kb_list = kb_res.get_json()
assert len(kb_list) > 0
print(f"[PASS] Knowledge Base returns {len(kb_list)} real documented records from dataset")

prev_res = client.get('/api/prevention')
assert prev_res.status_code == 200
prev_list = prev_res.get_json()
assert len(prev_list) > 0
print(f"[PASS] Prevention Center returns {len(prev_list)} recommendations from dataset")

# Test Prevention Recommendation Status Action
rec_id = prev_list[0]['recommendationId']
rec_action_res = client.post(f'/api/prevention/{rec_id}/action', json={
    'status': 'Approved',
    'decisionNote': 'Reviewed and approved for quarterly budget dispatch'
})
assert rec_action_res.status_code == 200
print(f"[PASS] Recommendation {rec_id} status action verified successfully")

print("\n==================================================")
print("ALL COMPREHENSIVE PLATFORM TESTS PASSED WITH 100% SUCCESS!")
print("==================================================")
