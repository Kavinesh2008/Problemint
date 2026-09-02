import app as flask_app
import json

client = flask_app.app.test_client()

print("--- TESTING FLASK API ENDPOINTS ---")

# 1. Test GET /
res = client.get('/')
assert res.status_code == 200, f"Expected 200, got {res.status_code}"
print("GET / -> 200 OK (Served Frontend/index.html)")

# 2. Test GET /api/dashboard/stats
res = client.get('/api/dashboard/stats')
assert res.status_code == 200
data = res.get_json()
print("GET /api/dashboard/stats ->", data['totalReports'], "total reports")

# 3. Test POST /api/complaints/analyze
res = client.post('/api/complaints/analyze', json={'text': 'The hostel food quality is poor, the water cooler near Block B is not working, Wi-Fi is slow, the washroom is dirty and the lift is not working.'})
assert res.status_code == 200
data = res.get_json()
assert data['num_issues'] == 5
print(f"POST /api/complaints/analyze -> {data['num_issues']} issues detected")

# 4. Test POST /api/complaints
res = client.post('/api/complaints', json={'complaintText': 'The hostel food quality is poor, the water cooler near Block B is not working, Wi-Fi is slow, the washroom is dirty and the lift is not working.'})
assert res.status_code == 200
data = res.get_json()
print("POST /api/complaints -> Response:", data['message'])

# 5. Test GET /api/complaints
res = client.get('/api/complaints')
assert res.status_code == 200
complaints = res.get_json()
print(f"GET /api/complaints -> Fetched {len(complaints)} complaints from SQLite")

# 6. Test GET /api/complaints/<id>
ticket_id = complaints[0]['complaintId']
res = client.get(f'/api/complaints/{ticket_id}')
assert res.status_code == 200
detail = res.get_json()
print(f"GET /api/complaints/{ticket_id} -> Status: {detail['status']}, Seen: {detail['seen']}")

# 7. Test POST /api/copilot
res = client.post('/api/copilot', json={'query': 'how many water complaints?'})
assert res.status_code == 200
copilot_data = res.get_json()
print("POST /api/copilot ->", copilot_data['response'])

print("\n[SUCCESS] All Flask API endpoints verified with 100% clean test passes!")
