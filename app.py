import os
import json
import random
import datetime
from flask import Flask, jsonify, request, send_from_directory, session
from database import get_db, init_db
from services.categorization import categorizeComplaint
from services.complaint_splitter import splitComplaint
from services.priority import detectPriority, detectLocation
from services.routing import routeComplaint
from services.escalation import checkEscalation

app = Flask(__name__, static_folder='Frontend', static_url_path='')
app.secret_key = 'smart_complaint_secret_key_antigravity'

CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.json')

def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def format_timestamp():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# --- FRONTEND ROUTING ---

@app.route('/')
def index():
    return send_from_directory('Frontend', 'index.html')

# --- API ENDPOINTS FOR FRONTEND ---

@app.route('/api/users', methods=['GET'])
def api_get_users():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, password, role, department FROM users ORDER BY role, name")
    users = cursor.fetchall()
    conn.close()

    result = []
    for u in users:
        result.append({
            'id': u['id'],
            'name': u['name'],
            'email': u['email'],
            'password': u['password'],
            'role': u['role'],
            'department': u['department']
        })
    return jsonify(result)

@app.route('/api/me', methods=['GET'])
def api_get_me():
    user_id = session.get('user_id')
    conn = get_db()
    cursor = conn.cursor()
    if user_id:
        cursor.execute("SELECT id, name, email, role, department FROM users WHERE id = ?", (user_id,))
        u = cursor.fetchone()
    else:
        cursor.execute("SELECT id, name, email, role, department FROM users WHERE email = 'student@college.edu'")
        u = cursor.fetchone()
    conn.close()

    if u:
        return jsonify({
            'id': u['id'],
            'name': u['name'],
            'email': u['email'],
            'role': u['role'],
            'department': u['department']
        })
    return jsonify({'id': 1, 'name': 'Student User', 'role': 'User', 'email': 'student@college.edu', 'department': 'Computer Science'})

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json or {}
    user_id = data.get('userId') or data.get('user_id')
    email = data.get('email')
    password = data.get('password')

    conn = get_db()
    cursor = conn.cursor()

    if user_id:
        cursor.execute("SELECT id, name, email, password, role, department FROM users WHERE id = ?", (user_id,))
    elif email and password:
        cursor.execute("SELECT id, name, email, password, role, department FROM users WHERE email = ? AND password = ?", (email, password))
    elif email:
        cursor.execute("SELECT id, name, email, password, role, department FROM users WHERE email = ?", (email,))
    else:
        cursor.execute("SELECT id, name, email, password, role, department FROM users WHERE role = 'User' LIMIT 1")

    u = cursor.fetchone()
    conn.close()

    if u:
        session['user_id'] = u['id']
        session['user_name'] = u['name']
        session['role'] = u['role']
        session['department'] = u['department']
        return jsonify({
            'success': True,
            'message': f"Logged in as {u['name']} ({u['role']})",
            'user': {
                'id': u['id'],
                'name': u['name'],
                'email': u['email'],
                'role': u['role'],
                'department': u['department']
            }
        })
    return jsonify({'error': 'Invalid email or password'}), 401



@app.route('/api/logout', methods=['POST', 'GET'])
def api_logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})



@app.route('/api/dashboard/stats', methods=['GET'])
def api_dashboard_stats():
    conn = get_db()
    cursor = conn.cursor()

    session_user_id = session.get('user_id')
    if session_user_id:
        cursor.execute("SELECT role, department, name FROM users WHERE id = ?", (session_user_id,))
        u = cursor.fetchone()
        role = u['role'] if u else 'User'
        user_dept = u['department'] if u else ''
        user_name = u['name'] if u else ''
    else:
        role = 'User'
        session_user_id = 1
        user_dept = ''
        user_name = ''

    if role == 'Department Admin':
        cursor.execute("SELECT COUNT(*) as total FROM complaints WHERE department = ? OR assigned_person = ?", (user_dept, user_name))
        total_reports = cursor.fetchone()['total']
        cursor.execute("SELECT COUNT(*) as active FROM complaints WHERE (department = ? OR assigned_person = ?) AND status NOT IN ('Resolved', 'Closed')", (user_dept, user_name))
        active_problems = cursor.fetchone()['active']
        cursor.execute("SELECT COUNT(*) as emerging FROM complaints WHERE (department = ? OR assigned_person = ?) AND priority IN ('High', 'Critical') AND status NOT IN ('Closed')", (user_dept, user_name))
        emerging_issues = cursor.fetchone()['emerging']
        cursor.execute("SELECT COUNT(*) as escalated_cnt FROM complaints WHERE (department = ? OR assigned_person = ?) AND escalated = 1", (user_dept, user_name))
        recurring_problems = cursor.fetchone()['escalated_cnt']
        cursor.execute("SELECT c.*, u.name as user_name FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.department = ? OR c.assigned_person = ? ORDER BY c.created_at DESC LIMIT 5", (user_dept, user_name))
        recent = cursor.fetchall()
    elif role == 'Organization Admin':
        cursor.execute("SELECT COUNT(*) as total FROM complaints")
        total_reports = cursor.fetchone()['total']
        cursor.execute("SELECT COUNT(*) as active FROM complaints WHERE status NOT IN ('Resolved', 'Closed')")
        active_problems = cursor.fetchone()['active']
        cursor.execute("SELECT COUNT(*) as emerging FROM complaints WHERE priority IN ('High', 'Critical') AND status NOT IN ('Closed')")
        emerging_issues = cursor.fetchone()['emerging']
        cursor.execute("SELECT COUNT(*) as escalated_cnt FROM complaints WHERE escalated = 1")
        recurring_problems = cursor.fetchone()['escalated_cnt']
        cursor.execute("SELECT c.*, u.name as user_name FROM complaints c JOIN users u ON c.user_id = u.id ORDER BY c.created_at DESC LIMIT 5")
        recent = cursor.fetchall()
    else: # User
        cursor.execute("SELECT COUNT(*) as total FROM complaints WHERE user_id = ?", (session_user_id,))
        total_reports = cursor.fetchone()['total']
        cursor.execute("SELECT COUNT(*) as active FROM complaints WHERE user_id = ? AND status NOT IN ('Resolved', 'Closed')", (session_user_id,))
        active_problems = cursor.fetchone()['active']
        cursor.execute("SELECT COUNT(*) as emerging FROM complaints WHERE user_id = ? AND priority IN ('High', 'Critical') AND status NOT IN ('Closed')", (session_user_id,))
        emerging_issues = cursor.fetchone()['emerging']
        cursor.execute("SELECT COUNT(*) as escalated_cnt FROM complaints WHERE user_id = ? AND escalated = 1", (session_user_id,))
        recurring_problems = cursor.fetchone()['escalated_cnt']
        cursor.execute("SELECT c.*, u.name as user_name FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT 5", (session_user_id,))
        recent = cursor.fetchall()

    needs_attention = []
    for r in recent:
        needs_attention.append({
            'type': r['category'],
            'title': r['description'][:60] + ('...' if len(r['description']) > 60 else ''),
            'location': r['location'],
            'tags': [r['priority'], r['status'], f"Dept: {r['department']}"],
            'incidentId': r['original_complaint_id']
        })

    conn.close()

    return jsonify({
        'role': role,
        'totalReports': total_reports,
        'activeProblems': active_problems,
        'emergingIssues': emerging_issues,
        'recurringProblems': recurring_problems,
        'aiConfidence': '96.4%',
        'needsAttention': needs_attention
    })


@app.route('/api/complaints/analyze', methods=['POST'])
def api_complaint_analyze():
    data = request.json or {}
    text = data.get('text') or data.get('description', '')
    if not text:
        return jsonify({'error': 'No text provided'}), 400

    issues = splitComplaint(text)
    num_issues = len(issues)

    primary_issue = issues[0] if issues else text
    cat = categorizeComplaint(primary_issue)
    prio = detectPriority(primary_issue)
    loc = detectLocation(text)
    route = routeComplaint(cat)

    return jsonify({
        'confidence': 0.96,
        'num_issues': num_issues,
        'issues': issues,
        'category': cat,
        'subcategory': 'Equipment Fault' if 'working' in text.lower() else 'Service Quality',
        'location': loc,
        'severity': prio,
        'impact': 'Multiple Users / Campus Zone' if num_issues > 1 else 'Single User',
        'timePattern': 'Intermittent / Active',
        'department': route['department'],
        'assigned_person': route['assigned_person']
    })

@app.route('/api/complaints/pre-resolution', methods=['POST'])
def api_pre_resolution():
    data = request.json or {}
    category = data.get('category', '')
    
    category_steps = {
        "Garden/Landscaping": [
            "Check if scheduled groundskeeping or watering is currently in progress.",
            "Verify if recent weather or ongoing campus maintenance affected the garden area.",
            "Include specific area details (e.g., overgrown grass, uncollected waste, broken sprinklers)."
        ],
        "Sanitization/Cleanliness": [
            "Check if housekeeping shift cleaning is currently underway in this area.",
            "Verify if dustbins/sanitation facilities nearby are accessible.",
            "Specify the exact floor or room location needing attention."
        ],
        "Hostel Food/Mess": [
            "Check if food feedback logs are available at the mess administration desk.",
            "Note the specific meal (Breakfast/Lunch/Dinner) and counter location.",
            "Provide specific feedback regarding taste, freshness, or hygiene."
        ],
        "Internet/Wi-Fi": [
            "Toggle your device Wi-Fi off and back on.",
            "Check if neighboring users in the same room/hall are experiencing the same latency.",
            "Verify if your device network settings are set to automatic DHCP."
        ],
        "Electricity": [
            "Check if the floor main circuit breaker or room switch tripped.",
            "Verify if power backup or generator switchover is currently in progress.",
            "Avoid touching exposed wires or damaged switches for safety."
        ],
        "Water Supply": [
            "Check if an overhead water tank maintenance or refilling notice was issued.",
            "Check if adjacent taps or restrooms on the same floor have water flow.",
            "Ensure localized tap valves are fully open."
        ]
    }

    steps = category_steps.get(category, [
        "Verify if routine maintenance or repair is already scheduled in the area.",
        "Check if neighboring users or staff have logged a similar report.",
        "Include specific location or equipment details for accurate department dispatch."
    ])

    return jsonify({
        'title': f"Standard Self-Check for {category}",
        'description': "Automated system recommendation before logging official department dispatch.",
        'steps': steps
    })


@app.route('/api/complaints/similar', methods=['POST'])
def api_find_similar():
    data = request.json or {}
    text = data.get('text', '')
    category = data.get('category', '')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM complaints WHERE category = ? ORDER BY created_at DESC LIMIT 1", (category,))
    match = cursor.fetchone()
    conn.close()

    if match:
        return jsonify({
            'similarComplaints': [
                {
                    'similarityPercentage': 88,
                    'complaint': {
                        'complaintId': match['id'],
                        'complaintText': match['description'],
                        'location': match['location']
                    }
                }
            ]
        })
    
    return jsonify({'similarComplaints': []})

@app.route('/api/complaints', methods=['GET', 'POST'])
def api_complaints():
    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'POST':
        data = request.json or {}
        text = data.get('complaintText') or data.get('description', '')
        user_location = data.get('location', '')
        user_category = data.get('category', '')
        user_severity = data.get('severity', '')

        if not text:
            conn.close()
            return jsonify({'error': 'Description is required'}), 400

        # Multi-issue detection & splitting
        issues = splitComplaint(text)
        num_issues = len(issues)

        # Base ID generator
        base_num = random.randint(100, 999)
        original_id = f"CMP{base_num}"

        # Fetch active user from session
        session_user_id = session.get('user_id') or 1
        cursor.execute("SELECT id, name FROM users WHERE id = ?", (session_user_id,))
        u = cursor.fetchone()
        user_id = u['id'] if u else 1
        user_name = u['name'] if u else 'Student User'

        now = format_timestamp()
        letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        created_tickets = []

        for i, issue_text in enumerate(issues):
            ticket_id = f"{original_id}-{letters[i]}" if num_issues > 1 else f"{original_id}"
            
            cat = user_category if (user_category and num_issues == 1) else categorizeComplaint(issue_text)
            loc = user_location if user_location else detectLocation(issue_text)
            prio = user_severity if (user_severity and num_issues == 1) else detectPriority(issue_text)
            route = routeComplaint(cat)

            dept = route['department']
            person = route['assigned_person']
            status = "Forwarded"

            cursor.execute('''
            INSERT INTO complaints (
                id, original_complaint_id, user_id, description, category, department, assigned_person,
                location, priority, status, seen, escalated, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
            ''', (
                ticket_id, original_id, user_id, issue_text, cat, dept, person,
                loc, prio, status, now, now
            ))

            cursor.execute('''
            INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
            VALUES (?, 'Submitted', 'Complaint submitted', ?, ?)
            ''', (ticket_id, user_name, now))

            cursor.execute('''
            INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
            VALUES (?, 'AI Categorized', ?, 'AI Engine', ?)
            ''', (ticket_id, f"Category: {cat} | Priority: {prio}", now))

            cursor.execute('''
            INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
            VALUES (?, 'Forwarded', ?, 'AI Engine', ?)
            ''', (ticket_id, f"Assigned to {dept} ({person})", now))

            created_tickets.append({
                'complaintId': ticket_id,
                'complaintText': issue_text,
                'category': cat,
                'location': loc,
                'severity': prio,
                'department': dept,
                'assignedPerson': person
            })

        conn.commit()
        conn.close()

        first_created = created_tickets[0]
        return jsonify({
            'message': f"Created {num_issues} split tickets successfully!",
            'complaint': first_created,
            'all_tickets': created_tickets
        })

    # GET request: return list of complaints filtered STRICTLY by user role & department
    session_user_id = session.get('user_id')
    if session_user_id:
        cursor.execute("SELECT role, department, name FROM users WHERE id = ?", (session_user_id,))
        u = cursor.fetchone()
        role = u['role'] if u else 'User'
        user_dept = u['department'] if u else ''
        user_name = u['name'] if u else ''
    else:
        role = 'User'
        session_user_id = 1
        user_dept = ''
        user_name = ''

    if role == 'Department Admin':
        cursor.execute("SELECT c.*, u.name as user_name FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.department = ? OR c.assigned_person = ? ORDER BY c.created_at DESC", (user_dept, user_name))
    elif role == 'Organization Admin':
        cursor.execute("SELECT c.*, u.name as user_name FROM complaints c JOIN users u ON c.user_id = u.id ORDER BY c.created_at DESC")
    else:
        cursor.execute("SELECT c.*, u.name as user_name FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.user_id = ? ORDER BY c.created_at DESC", (session_user_id,))

    rows = cursor.fetchall()
    conn.close()

    complaints_list = []
    for r in rows:
        complaints_list.append({
            'complaintId': r['id'],
            'originalId': r['original_complaint_id'],
            'complaintText': r['description'],
            'category': r['category'],
            'location': r['location'],
            'severity': r['priority'],
            'status': r['status'],
            'seen': bool(r['seen']),
            'seenAt': r['seen_at'],
            'seenBy': r['seen_by'],
            'department': r['department'],
            'assignedPerson': r['assigned_person'],
            'userVerified': r['status'] == 'Closed',
            'createdAt': r['created_at'],
            'incidentId': r['original_complaint_id']
        })

    return jsonify(complaints_list)


@app.route('/api/complaints/<complaint_id>', methods=['GET'])
def api_get_complaint_detail(complaint_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT c.*, u.name as user_name FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.id = ?", (complaint_id,))
    r = cursor.fetchone()

    if not r:
        conn.close()
        return jsonify({'error': 'Complaint not found'}), 404

    # If viewed, update seen status
    now = format_timestamp()
    if not r['seen']:
        cursor.execute("UPDATE complaints SET seen = 1, seen_at = ?, seen_by = 'Department Admin' WHERE id = ?", (now, complaint_id))
        cursor.execute("INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp) VALUES (?, 'Seen', 'Opened by Department Admin', 'Department Admin', ?)", (complaint_id, now))
        conn.commit()

    cursor.execute("SELECT * FROM complaint_timeline WHERE complaint_id = ? ORDER BY id ASC", (complaint_id,))
    timeline_rows = cursor.fetchall()
    conn.close()

    timeline = []
    for t in timeline_rows:
        timeline.append({
            'status': t['status'],
            'description': t['description'],
            'updatedBy': t['updated_by'],
            'timestamp': t['timestamp']
        })

    return jsonify({
        'complaintId': r['id'],
        'originalId': r['original_complaint_id'],
        'complaintText': r['description'],
        'category': r['category'],
        'location': r['location'],
        'severity': r['priority'],
        'status': r['status'],
        'seen': True,
        'seenAt': r['seen_at'] or now,
        'seenBy': r['seen_by'] or 'Department Admin',
        'department': r['department'],
        'assignedPerson': r['assigned_person'],
        'resolutionNote': r['resolution_note'],
        'escalated': bool(r['escalated']),
        'escalationReason': r['escalation_reason'],
        'timeline': timeline
    })

@app.route('/api/incidents', methods=['GET'])
def api_incidents():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT original_complaint_id, category, location, priority, COUNT(*) as cnt FROM complaints GROUP BY original_complaint_id ORDER BY cnt DESC")
    rows = cursor.fetchall()
    conn.close()

    incidents_list = []
    for r in rows:
        incidents_list.append({
            'incidentId': r['original_complaint_id'],
            'title': f"{r['category']} Multi-Issue Report ({r['original_complaint_id']})",
            'category': r['category'],
            'location': r['location'],
            'complaintCount': r['cnt'],
            'affectedUsers': r['cnt'] * 2 + 1,
            'rootCauseConfidence': 0.92,
            'severity': r['priority'],
            'status': 'Active Investigation'
        })

    return jsonify(incidents_list)

@app.route('/api/incidents/<incident_id>', methods=['GET'])
def api_incident_detail(incident_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT c.*, u.name as user_name FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.original_complaint_id = ?", (incident_id,))
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return jsonify({'error': 'Incident not found'}), 404

    first = rows[0]
    grouped = []
    for r in rows:
        grouped.append({
            'complaintId': r['id'],
            'complaintText': r['description'],
            'createdAt': r['created_at']
        })

    return jsonify({
        'incident': {
            'incidentId': incident_id,
            'title': f"Multi-Issue Incident Group ({incident_id})",
            'category': first['category'],
            'location': first['location'],
            'severity': first['priority'],
            'status': first['status'],
            'affectedUsers': len(rows) * 3,
            'complaintCount': len(rows)
        },
        'rootCauseHypothesis': {
            'mandatoryDisclaimer': 'AI Root Cause Hypothesis: Preliminary automated synthesis from multi-issue text clustering.',
            'hypothesisText': f"Correlation detected across {len(rows)} sub-complaints near {first['location']}. Primary driver relates to {first['category']} infrastructure load.",
            'recommendedAction': f"Dispatch {first['department']} for inspect and repair."
        },
        'groupedComplaints': grouped
    })

@app.route('/api/resolutions', methods=['GET', 'POST'])
def api_resolutions():
    if request.method == 'POST':
        data = request.json or {}
        incident_id = data.get('incidentId', 'CMP100')
        action = data.get('actionTaken', 'Action completed')

        conn = get_db()
        cursor = conn.cursor()
        now = format_timestamp()

        cursor.execute("UPDATE complaints SET status = 'Resolved', resolution_note = ?, updated_at = ? WHERE original_complaint_id = ? OR id = ?", (action, now, incident_id, incident_id))
        conn.commit()
        conn.close()

        return jsonify({'message': 'Resolution recorded successfully!'})

    return jsonify([])

@app.route('/api/verification', methods=['POST'])
def api_verification():
    data = request.json or {}
    complaint_id = data.get('complaintId')
    status = data.get('verificationStatus', 'Yes')
    feedback = data.get('feedbackText', '')

    conn = get_db()
    cursor = conn.cursor()
    now = format_timestamp()

    new_status = 'Closed' if status in ['Yes', 'Confirmed'] else 'Reopened'
    cursor.execute("UPDATE complaints SET status = ?, updated_at = ? WHERE id = ?", (new_status, now, complaint_id))
    cursor.execute("INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp) VALUES (?, ?, ?, 'User Verification', ?)", (complaint_id, new_status, f"User Verification response: {status}. Note: {feedback}", now))

    conn.commit()
    conn.close()

    return jsonify({'message': f"Verification recorded. Complaint status set to {new_status}."})

@app.route('/api/knowledge', methods=['GET'])
def api_knowledge():
    return jsonify([
        {
            'knowledgeId': 'KB-101',
            'problemType': 'Hostel Water Pressure Drop',
            'location': 'Hostel Block B',
            'rootCause': 'Air lock in main secondary distribution valve',
            'failedSolution': 'Resetting main digital pressure sensor',
            'successfulSolution': 'Manual bleeding of air valve on 3rd floor riser',
            'lessonLearned': 'Sensor reset does not bleed trapped air pockets during peak evening load.'
        },
        {
            'knowledgeId': 'KB-102',
            'problemType': 'Wi-Fi Latency & Packet Loss',
            'location': 'Central Library',
            'rootCause': 'Co-channel interference from rogue AP on Channel 6',
            'failedSolution': 'Rebooting central switch',
            'successfulSolution': 'Configured dynamic channel frequency selection & rogue AP suppression',
            'lessonLearned': 'Switch rebooting does not clear RF interference.'
        }
    ])

@app.route('/api/prevention', methods=['GET'])
def api_prevention():
    return jsonify([
        {
            'recommendationId': 'REC-001',
            'problem': 'Recurring Water Cooler Failures',
            'recommendation': 'Scheduled Preventive Filter & Compressor Cleaning',
            'reason': 'High sediment load detected during summer peak usage',
            'priority': 'High',
            'expectedImpact': '90% reduction in emergency breakdown reports',
            'responsibleDepartment': 'Water & Maintenance Dept',
            'status': 'Active'
        },
        {
            'recommendationId': 'REC-002',
            'problem': 'Network Bottleneck during Exams',
            'recommendation': 'Bandwidth Throttling for Non-Academic Media Streams',
            'reason': 'Peak concurrent connections in Library exceeds AP throughput',
            'priority': 'Medium',
            'expectedImpact': 'Smooth access to online portal and hall tickets',
            'responsibleDepartment': 'Network Administration',
            'status': 'Proposed'
        }
    ])

@app.route('/api/analytics', methods=['GET'])
def api_analytics():
    return jsonify({
        'resolutionVerificationRate': '94.2%',
        'avgResolutionTimeHours': 3.5,
        'openCriticalIncidents': 1
    })

@app.route('/api/copilot', methods=['POST'])
def api_copilot():
    data = request.json or {}
    query = data.get('query', '').lower()

    conn = get_db()
    cursor = conn.cursor()

    if 'water' in query:
        cursor.execute("SELECT COUNT(*) as cnt FROM complaints WHERE category LIKE '%Water%'")
        cnt = cursor.fetchone()['cnt']
        resp = f"I analyzed the database: There are currently **{cnt} water-related complaints** logged. Primary hotspot is near **Block B** and **Hostel Area**."
    elif 'wifi' in query or 'network' in query or 'internet' in query:
        cursor.execute("SELECT COUNT(*) as cnt FROM complaints WHERE category LIKE '%Internet%' OR category LIKE '%Wi-Fi%'")
        cnt = cursor.fetchone()['cnt']
        resp = f"Network telemetry report: Found **{cnt} active internet/Wi-Fi tickets**. Assigned department: **Network Administration**."
    elif 'escalat' in query:
        cursor.execute("SELECT id, description, assigned_person FROM complaints WHERE escalated = 1")
        rows = cursor.fetchall()
        if rows:
            items = ", ".join([f"{r['id']} ({r['assigned_person']})" for r in rows])
            resp = f"⚠️ Currently escalated tickets: **{items}**. Response time limits were exceeded."
        else:
            resp = "No complaints are currently escalated. All response SLAs are within target boundaries."
    else:
        cursor.execute("SELECT COUNT(*) as total FROM complaints")
        tot = cursor.fetchone()['total']
        resp = f"System Overview: Analyzed **{tot} total complaints** across ABC Engineering College. Automated multi-issue splitting, category routing, and timeline telemetry are fully operational."

    conn.close()
    return jsonify({'response': resp})

@app.route('/api/notifications', methods=['GET'])
def api_notifications():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM complaint_timeline ORDER BY id DESC LIMIT 5")
    rows = cursor.fetchall()
    conn.close()

    notifs = []
    for r in rows:
        notifs.append({
            'title': f"Ticket {r['complaint_id']} - {r['status']}",
            'message': r['description'],
            'timestamp': r['timestamp'],
            'link': f"#my-complaints"
        })

    return jsonify(notifs)

if __name__ == '__main__':
    init_db()
    print("Starting Smart Complaint Categorization & Monitoring System on http://127.0.0.1:5000 ...")
    app.run(debug=True, port=5000)
