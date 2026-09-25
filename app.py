import os
import json
import random
import datetime
from flask import Flask, jsonify, request, send_from_directory, session
from database import get_db, init_db
from werkzeug.security import generate_password_hash, check_password_hash
from services.categorization import categorizeComplaint
from services.complaint_splitter import splitComplaint, analyzeMultiIssues
from services.priority import detectPriority, detectLocation
from services.routing import routeComplaint
from services.escalation import checkEscalation

app = Flask(__name__, static_folder='.', static_url_path='')
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
    return send_from_directory('.', 'index.html')

# --- AUTHENTICATION & USERS ---

@app.route('/api/users', methods=['GET'])
def api_get_users():
    # Never expose passwords in API responses
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, email, role, user_type, roll_number, employee_id, designation, status, department
        FROM users ORDER BY role, name
    """)
    users = cursor.fetchall()
    conn.close()

    result = []
    for u in users:
        result.append({
            'id': u['id'],
            'name': u['name'],
            'email': u['email'],
            'role': u['role'],
            'user_type': u['user_type'],
            'roll_number': u['roll_number'],
            'employee_id': u['employee_id'],
            'designation': u['designation'],
            'status': u['status'],
            'department': u['department']
        })
    return jsonify(result)

@app.route('/api/check-auth', methods=['GET'])
def api_check_auth():
    user_id = session.get('user_id')
    if user_id:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, email, role, user_type, roll_number, employee_id, designation, status, department
            FROM users WHERE id = ?
        """, (user_id,))
        u = cursor.fetchone()
        conn.close()
        if u and u['status'] != 'Inactive':
            return jsonify({
                'authenticated': True,
                'user': {
                    'id': u['id'],
                    'name': u['name'],
                    'email': u['email'],
                    'role': u['role'],
                    'user_type': u['user_type'],
                    'roll_number': u['roll_number'],
                    'employee_id': u['employee_id'],
                    'designation': u['designation'],
                    'status': u['status'],
                    'department': u['department']
                }
            })
    return jsonify({'authenticated': False}), 401

@app.route('/api/me', methods=['GET'])
def api_get_me():
    user_id = session.get('user_id')
    conn = get_db()
    cursor = conn.cursor()
    if user_id:
        cursor.execute("""
            SELECT id, name, email, role, user_type, roll_number, employee_id, designation, status, department
            FROM users WHERE id = ?
        """, (user_id,))
        u = cursor.fetchone()
    else:
        cursor.execute("""
            SELECT id, name, email, role, user_type, roll_number, employee_id, designation, status, department
            FROM users WHERE email = 'student@college.edu'
        """)
        u = cursor.fetchone()
    conn.close()

    if u:
        return jsonify({
            'id': u['id'],
            'name': u['name'],
            'email': u['email'],
            'role': u['role'],
            'user_type': u['user_type'],
            'roll_number': u['roll_number'],
            'employee_id': u['employee_id'],
            'designation': u['designation'],
            'status': u['status'],
            'department': u['department']
        })
    return jsonify({
        'id': 1, 'name': 'Student User', 'role': 'User', 'user_type': 'Student',
        'email': 'student@college.edu', 'department': 'Computer Science', 'status': 'Active'
    })

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json or {}
    user_id = data.get('userId') or data.get('user_id')
    email = data.get('email')
    password = data.get('password')

    conn = get_db()
    cursor = conn.cursor()

    u = None
    if user_id:
        cursor.execute("""
            SELECT id, name, email, password, role, user_type, roll_number, employee_id, designation, status, department
            FROM users WHERE id = ?
        """, (user_id,))
        u = cursor.fetchone()
    elif email and password:
        cursor.execute("""
            SELECT id, name, email, password, role, user_type, roll_number, employee_id, designation, status, department
            FROM users WHERE email = ?
        """, (email,))
        candidate = cursor.fetchone()
        if candidate:
            stored_pw = candidate['password']
            if stored_pw == password or check_password_hash(stored_pw, password):
                u = candidate
    elif email:
        cursor.execute("""
            SELECT id, name, email, password, role, user_type, roll_number, employee_id, designation, status, department
            FROM users WHERE email = ?
        """, (email,))
        u = cursor.fetchone()
    else:
        cursor.execute("""
            SELECT id, name, email, password, role, user_type, roll_number, employee_id, designation, status, department
            FROM users WHERE role = 'User' LIMIT 1
        """)
        u = cursor.fetchone()

    if u:
        if u['status'] == 'Inactive':
            conn.close()
            return jsonify({'error': 'This account has been deactivated. Please contact the administrator.'}), 403

        now = format_timestamp()
        cursor.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (now, u['id']))
        conn.commit()
        conn.close()

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
                'user_type': u['user_type'],
                'roll_number': u['roll_number'],
                'employee_id': u['employee_id'],
                'designation': u['designation'],
                'status': u['status'],
                'department': u['department']
            }
        })
    conn.close()
    return jsonify({'error': 'Invalid email or password'}), 401

@app.route('/api/logout', methods=['POST', 'GET'])
def api_logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})

# --- SETTINGS & PREFERENCES PERSISTENCE ---

@app.route('/api/settings', methods=['GET', 'POST'])
def api_settings():
    session_user_id = session.get('user_id') or 1
    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'POST':
        data = request.json or {}
        full_name = data.get('fullName', '').strip()
        notify_forwarding = 1 if data.get('notifyForwarding', True) else 0
        notify_seen = 1 if data.get('notifySeen', True) else 0
        notify_resolution = 1 if data.get('notifyResolution', True) else 0
        notify_escalation = 1 if data.get('notifyEscalation', True) else 0
        ai_threshold = int(data.get('aiThreshold', 75))
        sla_window = data.get('slaWindow', '24 Hours (Standard)')

        if not full_name:
            conn.close()
            return jsonify({'error': 'Full name cannot be empty.'}), 400

        now = format_timestamp()

        # Update users table
        cursor.execute("UPDATE users SET name = ? WHERE id = ?", (full_name, session_user_id))
        session['user_name'] = full_name

        # Update user_settings table
        cursor.execute('''
        INSERT INTO user_settings (user_id, full_name, notify_forwarding, notify_seen, notify_resolution, notify_escalation, ai_threshold, sla_window, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            full_name = excluded.full_name,
            notify_forwarding = excluded.notify_forwarding,
            notify_seen = excluded.notify_seen,
            notify_resolution = excluded.notify_resolution,
            notify_escalation = excluded.notify_escalation,
            ai_threshold = excluded.ai_threshold,
            sla_window = excluded.sla_window,
            updated_at = excluded.updated_at
        ''', (session_user_id, full_name, notify_forwarding, notify_seen, notify_resolution, notify_escalation, ai_threshold, sla_window, now))

        conn.commit()
        conn.close()
        return jsonify({
            'success': True,
            'message': 'Preferences saved successfully!',
            'settings': {
                'fullName': full_name,
                'notifyForwarding': bool(notify_forwarding),
                'notifySeen': bool(notify_seen),
                'notifyResolution': bool(notify_resolution),
                'notifyEscalation': bool(notify_escalation),
                'aiThreshold': ai_threshold,
                'slaWindow': sla_window
            }
        })

    # GET request
    cursor.execute("""
        SELECT u.name, u.email, u.role, u.user_type, u.roll_number, u.employee_id, u.designation, u.status, u.department, s.*
        FROM users u LEFT JOIN user_settings s ON u.id = s.user_id WHERE u.id = ?
    """, (session_user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({
        'fullName': row['name'],
        'email': row['email'],
        'role': row['role'],
        'user_type': row['user_type'],
        'roll_number': row['roll_number'],
        'employee_id': row['employee_id'],
        'designation': row['designation'],
        'status': row['status'],
        'department': row['department'],
        'notifyForwarding': bool(row['notify_forwarding'] if row['notify_forwarding'] is not None else 1),
        'notifySeen': bool(row['notify_seen'] if row['notify_seen'] is not None else 1),
        'notifyResolution': bool(row['notify_resolution'] if row['notify_resolution'] is not None else 1),
        'notifyEscalation': bool(row['notify_escalation'] if row['notify_escalation'] is not None else 1),
        'aiThreshold': row['ai_threshold'] if row['ai_threshold'] is not None else 75,
        'slaWindow': row['sla_window'] or '24 Hours (Standard)'
    })

@app.route('/api/settings/change-password', methods=['POST'])
def api_change_password():
    session_user_id = session.get('user_id')
    if not session_user_id:
        return jsonify({'error': 'Authentication required'}), 401

    data = request.json or {}
    current_pw = data.get('currentPassword', '').strip()
    new_pw = data.get('newPassword', '').strip()
    confirm_pw = data.get('confirmPassword', '').strip()

    if not current_pw or not new_pw or not confirm_pw:
        return jsonify({'error': 'Please fill out all password fields: Current Password, New Password, and Confirm Password.'}), 400
    if new_pw != confirm_pw:
        return jsonify({'error': 'New password and confirmation do not match.'}), 400
    if len(new_pw) < 8 or not any(c.isalpha() for c in new_pw) or not any(c.isdigit() for c in new_pw):
        return jsonify({'error': 'Password requirement not met: Use at least 8 characters, including letters and numbers (e.g., College2026, Student12345).'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT password FROM users WHERE id = ?", (session_user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    stored_hash = user['password']
    # Check current password
    if stored_hash != current_pw and not check_password_hash(stored_hash, current_pw):
        conn.close()
        return jsonify({'error': 'Current password is incorrect.'}), 400

    # Prevent reuse of current password
    if stored_hash == new_pw or check_password_hash(stored_hash, new_pw):
        conn.close()
        return jsonify({'error': 'New password cannot be the same as your current password.'}), 400

    new_hash = generate_password_hash(new_pw)
    cursor.execute("UPDATE users SET password = ? WHERE id = ?", (new_hash, session_user_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Password changed successfully!'})

# --- ORGANIZATION ADMIN USER MANAGEMENT ---

@app.route('/api/admin/users', methods=['GET', 'POST'])
def api_admin_users():
    session_user_id = session.get('user_id')
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT role FROM users WHERE id = ?", (session_user_id,))
    curr = cursor.fetchone()
    if not curr or curr['role'] != 'Organization Admin':
        conn.close()
        return jsonify({'error': 'Access denied: Only Organization Admins can view or manage user accounts.'}), 403

    if request.method == 'POST':

        data = request.json or {}
        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', 'password123').strip()
        role = data.get('role', 'User')
        user_type = data.get('user_type', 'Student')
        roll_number = data.get('roll_number')
        employee_id = data.get('employee_id')
        designation = data.get('designation', user_type)
        department = data.get('department', 'General Administration')
        status = data.get('status', 'Active')

        if not name or not email:
            conn.close()
            return jsonify({'error': 'Name and Email are required'}), 400

        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': f'A user with email {email} already exists.'}), 409

        now = format_timestamp()
        pw_hash = generate_password_hash(password)
        cursor.execute('''
        INSERT INTO users (
            name, email, password, role, user_type, roll_number, employee_id,
            designation, status, organization_id, department, created_at, last_login_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL)
        ''', (name, email, pw_hash, role, user_type, roll_number, employee_id, designation, status, department, now))
        new_id = cursor.lastrowid
        cursor.execute('''
        INSERT INTO user_settings (user_id, full_name, updated_at) VALUES (?, ?, ?)
        ''', (new_id, name, now))
        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'message': f'User {name} created successfully!',
            'user': {
                'id': new_id, 'name': name, 'email': email, 'role': role,
                'user_type': user_type, 'roll_number': roll_number,
                'employee_id': employee_id, 'designation': designation,
                'department': department, 'status': status
            }
        })

    # GET: return list of users with optional filtering
    search_q = request.args.get('q', '').strip()
    role_filter = request.args.get('role', '').strip()
    status_filter = request.args.get('status', '').strip()
    dept_filter = request.args.get('department', '').strip()

    query_parts = []
    params = []
    if search_q:
        query_parts.append("(name LIKE ? OR email LIKE ? OR roll_number LIKE ? OR employee_id LIKE ? OR designation LIKE ?)")
        wild = f"%{search_q}%"
        params.extend([wild, wild, wild, wild, wild])
    if role_filter:
        query_parts.append("role = ?")
        params.append(role_filter)
    if status_filter:
        query_parts.append("status = ?")
        params.append(status_filter)
    if dept_filter:
        query_parts.append("department = ?")
        params.append(dept_filter)

    where = ("WHERE " + " AND ".join(query_parts)) if query_parts else ""
    cursor.execute(f'''
        SELECT id, name, email, role, user_type, roll_number, employee_id,
               designation, status, department, created_at, last_login_at
        FROM users {where} ORDER BY role DESC, name ASC
    ''', params)
    rows = cursor.fetchall()
    conn.close()

    user_list = []
    for r in rows:
        user_list.append({
            'id': r['id'],
            'name': r['name'],
            'email': r['email'],
            'role': r['role'],
            'user_type': r['user_type'],
            'roll_number': r['roll_number'],
            'employee_id': r['employee_id'],
            'designation': r['designation'],
            'status': r['status'],
            'department': r['department'],
            'created_at': r['created_at'],
            'last_login_at': r['last_login_at']
        })
    return jsonify(user_list)

@app.route('/api/admin/users/<int:user_id>', methods=['PUT', 'DELETE'])
def api_admin_user_detail(user_id):
    session_user_id = session.get('user_id')
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT role FROM users WHERE id = ?", (session_user_id,))
    u = cursor.fetchone()
    if not u or u['role'] != 'Organization Admin':
        conn.close()
        return jsonify({'error': 'Only Organization Admins can update account statuses.'}), 403

    if request.method == 'PUT':
        data = request.json or {}
        name = data.get('name')
        role = data.get('role')
        user_type = data.get('user_type')
        roll_number = data.get('roll_number')
        employee_id = data.get('employee_id')
        designation = data.get('designation')
        department = data.get('department')
        status = data.get('status')

        cursor.execute('''
        UPDATE users SET
            name = COALESCE(?, name),
            role = COALESCE(?, role),
            user_type = COALESCE(?, user_type),
            roll_number = COALESCE(?, roll_number),
            employee_id = COALESCE(?, employee_id),
            designation = COALESCE(?, designation),
            department = COALESCE(?, department),
            status = COALESCE(?, status)
        WHERE id = ?
        ''', (name, role, user_type, roll_number, employee_id, designation, department, status, user_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': f'User #{user_id} updated successfully.'})

    elif request.method == 'DELETE':
        cursor.execute("UPDATE users SET status = 'Inactive' WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': f'User #{user_id} deactivated.'})

@app.route('/api/admin/users/<int:user_id>/reset-password', methods=['POST'])
def api_admin_reset_password(user_id):
    session_user_id = session.get('user_id')
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT role FROM users WHERE id = ?", (session_user_id,))
    u = cursor.fetchone()
    if not u or u['role'] != 'Organization Admin':
        conn.close()
        return jsonify({'error': 'Only Organization Admins can reset credentials.'}), 403

    data = request.json or {}
    new_pw = data.get('newPassword') or 'password123'
    pw_hash = generate_password_hash(new_pw)
    cursor.execute("UPDATE users SET password = ? WHERE id = ?", (pw_hash, user_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': f'Password for user #{user_id} reset to default.'})

@app.route('/api/admin/users/bulk-import', methods=['POST'])
def api_admin_bulk_import():
    session_user_id = session.get('user_id')
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT role FROM users WHERE id = ?", (session_user_id,))
    u = cursor.fetchone()
    if not u or u['role'] != 'Organization Admin':
        conn.close()
        return jsonify({'error': 'Only Organization Admins can bulk import accounts.'}), 403

    data = request.json or {}
    users_data = data.get('users', [])
    imported = 0
    now = format_timestamp()

    for item in users_data:
        name = item.get('name', '').strip()
        email = item.get('email', '').strip()
        if not name or not email:
            continue
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            continue
        role = item.get('role', 'User')
        user_type = item.get('user_type', 'Student')
        roll_no = item.get('roll_number')
        emp_id = item.get('employee_id')
        desig = item.get('designation', user_type)
        dept = item.get('department', 'General Administration')
        pw = item.get('password', 'password123')
        pw_hash = generate_password_hash(pw)

        cursor.execute('''
        INSERT INTO users (
            name, email, password, role, user_type, roll_number, employee_id,
            designation, status, organization_id, department, created_at, last_login_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', 1, ?, ?, NULL)
        ''', (name, email, pw_hash, role, user_type, roll_no, emp_id, desig, dept, now))
        uid = cursor.lastrowid
        cursor.execute('''
        INSERT INTO user_settings (user_id, full_name, updated_at) VALUES (?, ?, ?)
        ''', (uid, name, now))
        imported += 1

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'importedCount': imported, 'message': f'Successfully imported {imported} users.'})

# --- DASHBOARD & ANALYTICS ---

@app.route('/api/dashboard/stats', methods=['GET'])
def api_dashboard_stats():
    conn = get_db()
    cursor = conn.cursor()

    session_user_id = session.get('user_id') or 1
    cursor.execute("""
        SELECT id, role, user_type, department, name, roll_number, employee_id, designation
        FROM users WHERE id = ?
    """, (session_user_id,))
    u = cursor.fetchone()
    role = u['role'] if u else 'User'
    user_type = u['user_type'] if u else 'Student'
    user_dept = u['department'] if u else ''
    user_name = u['name'] if u else ''
    now_dt = datetime.datetime.now()

    unack_count = 0
    unack_tickets = []
    escalated_items = []
    verification_pending = []
    self_service_count = 0

    if role == 'Department Admin':
        # Department Admin: Operational Workspace
        cursor.execute("SELECT COUNT(*) as total FROM complaints WHERE department = ? OR assigned_person = ?", (user_dept, user_name))
        total_reports = cursor.fetchone()['total']

        cursor.execute("SELECT COUNT(*) as active FROM complaints WHERE (department = ? OR assigned_person = ?) AND status NOT IN ('Resolved', 'Closed')", (user_dept, user_name))
        active_problems = cursor.fetchone()['active']

        cursor.execute("SELECT COUNT(*) as emerging FROM complaints WHERE (department = ? OR assigned_person = ?) AND priority IN ('High', 'Critical') AND status NOT IN ('Closed')", (user_dept, user_name))
        emerging_issues = cursor.fetchone()['emerging']

        cursor.execute("SELECT COUNT(*) as escalated_cnt FROM complaints WHERE (department = ? OR assigned_person = ?) AND escalated = 1 AND status NOT IN ('Resolved', 'Closed')", (user_dept, user_name))
        recurring_problems = cursor.fetchone()['escalated_cnt']

        # Unacknowledged complaints for this department
        cursor.execute('''
            SELECT id, description, category, location, priority, status, created_at, acknowledgement_deadline, assigned_at
            FROM complaints
            WHERE (department = ? OR assigned_person = ?)
              AND acknowledged_at IS NULL
              AND status NOT IN ('Resolved', 'Closed')
            ORDER BY priority DESC, created_at ASC
        ''', (user_dept, user_name))
        unack_rows = cursor.fetchall()
        unack_count = len(unack_rows)
        for row in unack_rows[:5]:
            is_breached = False
            overdue_text = "Within SLA"
            if row['acknowledgement_deadline']:
                try:
                    d_dt = datetime.datetime.strptime(row['acknowledgement_deadline'], "%Y-%m-%d %H:%M:%S")
                    if now_dt > d_dt:
                        is_breached = True
                        diff = now_dt - d_dt
                        h = int(diff.total_seconds() // 3600)
                        m = int((diff.total_seconds() % 3600) // 60)
                        overdue_text = f"Breached ({h}h {m}m overdue)"
                    else:
                        diff = d_dt - now_dt
                        h = int(diff.total_seconds() // 3600)
                        m = int((diff.total_seconds() % 3600) // 60)
                        overdue_text = f"{h}h {m}m remaining"
                except Exception:
                    pass
            unack_tickets.append({
                'complaintId': row['id'],
                'description': row['description'],
                'category': row['category'],
                'location': row['location'],
                'priority': row['priority'],
                'status': row['status'],
                'deadline': row['acknowledgement_deadline'],
                'isBreached': is_breached,
                'slaText': overdue_text
            })

        cursor.execute("SELECT c.*, u.name as user_name FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.department = ? OR c.assigned_person = ? ORDER BY c.created_at DESC LIMIT 5", (user_dept, user_name))
        recent = cursor.fetchall()

    elif role == 'Organization Admin':
        # Organization Admin: Problem Intelligence Command Center
        cursor.execute("SELECT COUNT(*) as total FROM complaints")
        total_reports = cursor.fetchone()['total']

        cursor.execute("SELECT COUNT(*) as active FROM complaints WHERE status NOT IN ('Resolved', 'Closed')")
        active_problems = cursor.fetchone()['active']

        cursor.execute("SELECT COUNT(*) as emerging FROM complaints WHERE priority IN ('High', 'Critical') AND status NOT IN ('Closed')")
        emerging_issues = cursor.fetchone()['emerging']

        cursor.execute("SELECT COUNT(*) as escalated_cnt FROM complaints WHERE escalated = 1 AND status NOT IN ('Resolved', 'Closed')")
        recurring_problems = cursor.fetchone()['escalated_cnt']

        # Campus-wide unacknowledged count
        cursor.execute("SELECT COUNT(*) as cnt FROM complaints WHERE acknowledged_at IS NULL AND status NOT IN ('Resolved', 'Closed')")
        unack_count = cursor.fetchone()['cnt']

        # Self-service total
        cursor.execute("SELECT COUNT(*) as cnt FROM self_service_resolutions")
        self_service_count = cursor.fetchone()['cnt']

        # Campus-wide escalated complaints
        cursor.execute('''
            SELECT c.*, u.name as submitter_name
            FROM complaints c JOIN users u ON c.user_id = u.id
            WHERE c.escalated = 1 AND c.status NOT IN ('Resolved', 'Closed')
            ORDER BY c.priority DESC, c.acknowledgement_deadline ASC LIMIT 5
        ''')
        esc_rows = cursor.fetchall()
        for r in esc_rows:
            overdue_text = "Overdue"
            if r['acknowledgement_deadline']:
                try:
                    d_dt = datetime.datetime.strptime(r['acknowledgement_deadline'], "%Y-%m-%d %H:%M:%S")
                    diff = now_dt - d_dt
                    h = int(diff.total_seconds() // 3600)
                    m = int((diff.total_seconds() % 3600) // 60)
                    overdue_text = f"Breached by {h}h {m}m"
                except Exception:
                    pass
            escalated_items.append({
                'complaintId': r['id'],
                'description': r['description'],
                'category': r['category'],
                'department': r['department'],
                'location': r['location'],
                'priority': r['priority'],
                'assignedPerson': r['assigned_person'],
                'submitterName': r['submitter_name'],
                'overdueDuration': overdue_text,
                'escalationReason': r['escalation_reason'] or 'SLA breached'
            })

        cursor.execute("SELECT c.*, u.name as user_name FROM complaints c JOIN users u ON c.user_id = u.id ORDER BY c.created_at DESC LIMIT 5")
        recent = cursor.fetchall()

    else:
        # Regular User: Student, Faculty, Staff ("My Problem Journey")
        cursor.execute("SELECT COUNT(*) as total FROM complaints WHERE user_id = ?", (session_user_id,))
        total_reports = cursor.fetchone()['total']

        cursor.execute("SELECT COUNT(*) as active FROM complaints WHERE user_id = ? AND status NOT IN ('Resolved', 'Closed')", (session_user_id,))
        active_problems = cursor.fetchone()['active']

        cursor.execute("SELECT COUNT(*) as emerging FROM complaints WHERE user_id = ? AND priority IN ('High', 'Critical') AND status NOT IN ('Closed')", (session_user_id,))
        emerging_issues = cursor.fetchone()['emerging']

        cursor.execute("SELECT COUNT(*) as escalated_cnt FROM complaints WHERE user_id = ? AND escalated = 1", (session_user_id,))
        recurring_problems = cursor.fetchone()['escalated_cnt']

        # Complaints resolved awaiting user verification
        cursor.execute("SELECT * FROM complaints WHERE user_id = ? AND status = 'Resolved' ORDER BY updated_at DESC", (session_user_id,))
        verif_rows = cursor.fetchall()
        for v in verif_rows:
            verification_pending.append({
                'complaintId': v['id'],
                'description': v['description'],
                'category': v['category'],
                'location': v['location'],
                'resolvedAt': v['updated_at'],
                'assignedPerson': v['assigned_person'],
                'department': v['department'],
                'resolutionNote': v['resolution_note'] or 'Department reported issue fixed.'
            })

        # Self-service resolutions by this user
        cursor.execute("SELECT COUNT(*) as cnt FROM self_service_resolutions WHERE user_id = ?", (session_user_id,))
        self_service_count = cursor.fetchone()['cnt']

        cursor.execute("SELECT c.*, u.name as user_name FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT 5", (session_user_id,))
        recent = cursor.fetchall()

    needs_attention = []
    for r in recent:
        needs_attention.append({
            'type': r['category'],
            'title': r['description'][:65] + ('...' if len(r['description']) > 65 else ''),
            'location': r['location'],
            'tags': [r['priority'], r['status'], f"Dept: {r['department']}"],
            'incidentId': r['incident_id'] or r['original_complaint_id'],
            'status': r['status'],
            'seen': bool(r['seen']),
            'acknowledged': bool(r['acknowledged_at'])
        })

    conn.close()

    return jsonify({
        'role': role,
        'userType': user_type,
        'userName': user_name,
        'department': user_dept,
        'totalReports': total_reports,
        'activeProblems': active_problems,
        'emergingIssues': emerging_issues,
        'recurringProblems': recurring_problems,
        'unacknowledgedCount': unack_count,
        'unacknowledgedTickets': unack_tickets,
        'escalatedList': escalated_items,
        'verificationPending': verification_pending,
        'verificationPendingCount': len(verification_pending),
        'selfServiceCount': self_service_count,
        'aiConfidence': '96.4%',
        'needsAttention': needs_attention
    })

# --- COMPLAINTS & PRE-SUBMISSION INTELLIGENCE ---

@app.route('/api/complaints/analyze', methods=['POST'])
def api_complaint_analyze():
    data = request.json or {}
    text = data.get('text') or data.get('description', '')
    if not text:
        return jsonify({'error': 'No text provided'}), 400

    analysis = analyzeMultiIssues(text)
    primary = analysis['issues'][0] if analysis['issues'] else {
        'category': 'General Maintenance',
        'department': 'General Administration',
        'location': 'Main Academic Block',
        'severity': 'Medium'
    }

    return jsonify({
        'confidence': 0.95,
        'num_issues': analysis['num_issues'],
        'is_multi_issue': analysis['is_multi_issue'],
        'shared_location': analysis['shared_location'],
        'issues': analysis['issues'],
        'category': primary['category'],
        'subcategory': 'Equipment Fault' if 'working' in text.lower() else 'Service Quality',
        'location': primary['location'],
        'severity': primary['severity'],
        'impact': 'Multiple Users / Campus Zone' if analysis['num_issues'] > 1 else 'Single User',
        'timePattern': 'Intermittent / Active',
        'department': primary['department'],
        'assigned_person': primary['assigned_person']
    })

@app.route('/api/complaints/pre-troubleshoot', methods=['POST'])
def api_pre_troubleshoot():
    data = request.json or {}
    text = (data.get('text') or data.get('description', '')).strip()
    category = data.get('category', '')
    location = data.get('location', '')

    conn = get_db()
    cursor = conn.cursor()

    # Safety Hazard Detection
    hazard_warning = None
    t_lower = text.lower()
    if any(h in t_lower for h in ['electric shock', 'spark', 'exposed wire', 'loose wire', 'exposed', 'short circuit', 'burning smell', 'fire', 'wire', 'shock']):
        hazard_warning = "⚠️ SAFETY HAZARD ALERT: Electrical sparks or exposed wiring detected! Do NOT attempt self-repair. Stay at least 3 meters away from exposed wiring."
    elif any(h in t_lower for h in ['stuck lift', 'trapped in elevator', 'lift drop']):
        hazard_warning = "⚠️ SAFETY HAZARD ALERT: Do not force elevator doors. Use the emergency cabin telephone or emergency bell immediately."
    elif any(h in t_lower for h in ['gas leak', 'chemical spill', 'toxic odor']):
        hazard_warning = "⚠️ CHEMICAL/HAZARD ALERT: Evacuate the room immediately. Alert campus safety and do not activate electrical switches."

    # Look up Knowledge Base
    kb_matches = []
    words = [w for w in text.split() if len(w) > 3]
    if words:
        like_parts = ["problem_description LIKE ? OR problem_type LIKE ?" for _ in words[:4]]
        like_clause = " OR ".join(like_parts)
        params = []
        for w in words[:4]:
            params.extend([f"%{w}%", f"%{w}%"])
        cursor.execute(f"SELECT * FROM knowledge_base WHERE {like_clause} LIMIT 3", params)
        kb_matches = cursor.fetchall()

    if not kb_matches:
        cursor.execute("SELECT * FROM knowledge_base WHERE problem_type LIKE ? OR location LIKE ? LIMIT 3", (f"%{category}%", f"%{location}%"))
        kb_matches = cursor.fetchall()

    solutions = []
    for k in kb_matches:
        solutions.append({
            'knowledgeId': k['knowledge_id'],
            'problemType': k['problem_type'],
            'rootCause': k['root_cause'],
            'successfulSolution': k['successful_solution'],
            'failedSolution': k['failed_solution'],
            'lessonLearned': k['lesson_learned'],
            'recommendedAction': k['recommended_future_action']
        })

    # Actionable troubleshooting step checklist
    checklist = []
    if any(w in t_lower for w in ['wifi', 'internet', 'network', 'connection', 'slow']) or category == 'Internet/Wi-Fi':
        checklist = [
            "Disconnect and reconnect to the official campus Wi-Fi network SSID.",
            "Verify your institutional portal login credentials at the captive gateway page.",
            "Test whether other devices in your room or corridor experience the same latency.",
            "Toggle Airplane mode on your device for 10 seconds to renew your DHCP IP lease."
        ]
    elif any(w in t_lower for w in ['water', 'tap', 'leak', 'pipe', 'flush']) or category in ['Water Supply', 'Plumbing']:
        checklist = [
            "Check if an overhead maintenance or tank cleaning notice is active on the noticeboard.",
            "Inspect if the local stopcock valve underneath the sink/tap is in the OPEN position.",
            "Check adjacent restrooms on the same floor to determine if the stoppage is localized or floor-wide."
        ]
    elif any(w in t_lower for w in ['light', 'fan', 'power', 'switch', 'socket', 'bulb']) or category == 'Electricity':
        checklist = [
            "Check if the floor distribution switchboard MCB breaker has tripped for this circuit.",
            "Ensure the master toggle switch on the room switchboard is activated.",
            "Verify if generator backup switchover is actively transitioning."
        ]
    elif any(w in t_lower for w in ['clean', 'garbage', 'dustbin', 'trash', 'dirty']) or category == 'Sanitization/Cleanliness':
        checklist = [
            "Verify if the housekeeping shift cleaning (scheduled at 10:00 AM & 3:00 PM) is currently underway.",
            "Check nearest segregated recycling/waste bin in the corridor."
        ]
    else:
        checklist = [
            "Review campus maintenance schedule to see if routine servicing is underway.",
            "Check with floor representative if a group ticket is already active."
        ]

    conn.close()

    safety_warnings = [hazard_warning] if hazard_warning else []
    return jsonify({
        'matchedSolutions': solutions,
        'kbMatches': solutions,
        'stepChecklist': checklist,
        'selfServiceChecklist': checklist,
        'safetyWarning': hazard_warning,
        'safetyWarnings': safety_warnings,
        'hasSelfHelp': len(solutions) > 0 or len(checklist) > 0
    })

@app.route('/api/complaints/self-service-resolved', methods=['POST'])
def api_self_service_resolved():
    session_user_id = session.get('user_id') or 1
    data = request.json or {}
    problem_type = data.get('problemType', 'General Self-Help')
    location = data.get('location', 'Campus')
    solution_used = data.get('solutionUsed', 'Followed pre-submission troubleshooting steps')
    now = format_timestamp()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO self_service_resolutions (user_id, problem_type, location, solution_used, resolved_at)
    VALUES (?, ?, ?, ?, ?)
    ''', (session_user_id, problem_type, location, solution_used, now))
    conn.commit()

    cursor.execute("SELECT COUNT(*) as total FROM self_service_resolutions")
    total_saved = cursor.fetchone()['total']
    cursor.execute("SELECT COUNT(*) as user_total FROM self_service_resolutions WHERE user_id = ?", (session_user_id,))
    user_saved = cursor.fetchone()['user_total']
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Outstanding! You successfully resolved the issue using institutional self-service.',
        'userSelfServiceResolved': user_saved,
        'totalSelfServiceResolved': total_saved,
        'hoursSavedEstimate': round(total_saved * 2.5, 1)
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
        ],
        "Lift/Elevator": [
            "Check if scheduled lift safety maintenance is ongoing.",
            "Do not force open doors; use the emergency intercom if trapped.",
            "Report the exact floor where elevator stalled."
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
        confirmed_issues = data.get('confirmedIssues')
        text = data.get('complaintText') or data.get('description', '')

        # Session user
        session_user_id = session.get('user_id') or 1
        cursor.execute("SELECT id, name FROM users WHERE id = ?", (session_user_id,))
        u = cursor.fetchone()
        user_id = u['id'] if u else 1
        user_name = u['name'] if u else 'Student User'

        now = format_timestamp()
        base_num = random.randint(100, 999)
        original_id = f"CMP{base_num}"
        letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

        created_tickets = []

        if confirmed_issues and isinstance(confirmed_issues, list) and len(confirmed_issues) > 0:
            num_issues = len(confirmed_issues)
            for i, issue in enumerate(confirmed_issues):
                ticket_id = f"{original_id}-{letters[i]}" if num_issues > 1 else f"{original_id}"
                desc = issue.get('description', '').strip()
                if not desc:
                    continue

                cat = issue.get('category') or categorizeComplaint(desc)
                loc = issue.get('location') or detectLocation(desc)
                prio = issue.get('severity') or detectPriority(desc)
                route = routeComplaint(cat)
                dept = issue.get('department') or route['department']
                person = issue.get('assignedPerson') or route['assigned_person']
                status = "Forwarded"

                # Calculate SLA deadline based on priority
                prio_hours = 24
                if prio == 'Critical': prio_hours = 1
                elif prio == 'High': prio_hours = 6
                elif prio == 'Low': prio_hours = 48

                deadline_dt = datetime.datetime.now() + datetime.timedelta(hours=prio_hours)
                deadline_str = deadline_dt.strftime("%Y-%m-%d %H:%M:%S")

                # Link to existing incident if category & location match
                cursor.execute("SELECT incident_id FROM incidents WHERE category = ? AND location = ? LIMIT 1", (cat, loc))
                inc_match = cursor.fetchone()
                linked_inc_id = inc_match['incident_id'] if inc_match else None

                cursor.execute('''
                INSERT INTO complaints (
                    id, original_complaint_id, user_id, description, category, subcategory,
                    department, assigned_person, location, priority, status, seen,
                    assigned_at, acknowledgement_deadline, escalated, incident_id,
                    source, has_evidence, evidence_provenance, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'Multi-Issue Ticket', ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, 'Web', 0, 'User Submission', ?, ?)
                ''', (
                    ticket_id, original_id, user_id, desc, cat, dept, person,
                    loc, prio, status, now, deadline_str, linked_inc_id, now, now
                ))

                # Timeline entries
                cursor.execute('''
                INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
                VALUES (?, 'Submitted', 'Complaint registered via multi-issue portal', ?, ?)
                ''', (ticket_id, user_name, now))

                cursor.execute('''
                INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
                VALUES (?, 'AI Categorized', ?, 'AI Multi-Issue Engine', ?)
                ''', (ticket_id, f"Split Issue #{i+1} | Category: {cat} | Priority: {prio} | SLA Target: {prio_hours}h", now))

                cursor.execute('''
                INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
                VALUES (?, 'Forwarded', ?, 'AI Engine', ?)
                ''', (ticket_id, f"Routed to {dept} ({person})", now))

                created_tickets.append({
                    'complaintId': ticket_id,
                    'originalId': original_id,
                    'complaintText': desc,
                    'category': cat,
                    'location': loc,
                    'severity': prio,
                    'department': dept,
                    'assignedPerson': person,
                    'status': status,
                    'acknowledgementDeadline': deadline_str,
                    'incidentId': linked_inc_id
                })
        else:
            if not text:
                conn.close()
                return jsonify({'error': 'Description is required'}), 400

            analysis = analyzeMultiIssues(text)
            num_issues = analysis['num_issues']

            for i, issue in enumerate(analysis['issues']):
                ticket_id = f"{original_id}-{letters[i]}" if num_issues > 1 else f"{original_id}"
                desc = issue['description']
                cat = issue['category']
                loc = issue['location']
                prio = issue['severity']
                dept = issue['department']
                person = issue['assigned_person']
                status = "Forwarded"

                prio_hours = 24
                if prio == 'Critical': prio_hours = 1
                elif prio == 'High': prio_hours = 6
                elif prio == 'Low': prio_hours = 48

                deadline_dt = datetime.datetime.now() + datetime.timedelta(hours=prio_hours)
                deadline_str = deadline_dt.strftime("%Y-%m-%d %H:%M:%S")

                cursor.execute("SELECT incident_id FROM incidents WHERE category = ? AND location = ? LIMIT 1", (cat, loc))
                inc_match = cursor.fetchone()
                linked_inc_id = inc_match['incident_id'] if inc_match else None

                cursor.execute('''
                INSERT INTO complaints (
                    id, original_complaint_id, user_id, description, category, subcategory,
                    department, assigned_person, location, priority, status, seen,
                    assigned_at, acknowledgement_deadline, escalated, incident_id,
                    source, has_evidence, evidence_provenance, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'Multi-Issue Ticket', ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, 'Web', 0, 'User Submission', ?, ?)
                ''', (
                    ticket_id, original_id, user_id, desc, cat, dept, person,
                    loc, prio, status, now, deadline_str, linked_inc_id, now, now
                ))

                cursor.execute('''
                INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
                VALUES (?, 'Submitted', 'Complaint submitted', ?, ?)
                ''', (ticket_id, user_name, now))

                cursor.execute('''
                INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
                VALUES (?, 'AI Categorized', ?, 'AI Engine', ?)
                ''', (ticket_id, f"Category: {cat} | Priority: {prio} | SLA Target: {prio_hours}h", now))

                cursor.execute('''
                INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
                VALUES (?, 'Forwarded', ?, 'AI Engine', ?)
                ''', (ticket_id, f"Routed to {dept} ({person})", now))

                created_tickets.append({
                    'complaintId': ticket_id,
                    'originalId': original_id,
                    'complaintText': desc,
                    'category': cat,
                    'location': loc,
                    'severity': prio,
                    'department': dept,
                    'assignedPerson': person,
                    'status': status,
                    'acknowledgementDeadline': deadline_str,
                    'incidentId': linked_inc_id
                })

        conn.commit()
        conn.close()

        first_created = created_tickets[0] if created_tickets else {}
        return jsonify({
            'message': f"Created {len(created_tickets)} distinct ticket(s) successfully!",
            'complaint': first_created,
            'all_tickets': created_tickets,
            'originalId': original_id
        })

    # GET complaints: filter by role and query params
    session_user_id = session.get('user_id') or 1
    cursor.execute("SELECT role, department, name FROM users WHERE id = ?", (session_user_id,))
    u = cursor.fetchone()
    role = u['role'] if u else 'User'
    user_dept = u['department'] if u else ''
    user_name = u['name'] if u else ''

    status_filter = request.args.get('status')
    category_filter = request.args.get('category')
    search_query = request.args.get('q')

    query_parts = []
    params = []

    if role == 'Department Admin':
        query_parts.append("(c.department = ? OR c.assigned_person = ?)")
        params.extend([user_dept, user_name])
    elif role == 'User':
        query_parts.append("c.user_id = ?")
        params.append(session_user_id)

    if status_filter:
        query_parts.append("c.status = ?")
        params.append(status_filter)
    if category_filter:
        query_parts.append("c.category = ?")
        params.append(category_filter)
    if search_query:
        query_parts.append("(c.description LIKE ? OR c.id LIKE ? OR c.location LIKE ?)")
        wildcard = f"%{search_query}%"
        params.extend([wildcard, wildcard, wildcard])

    where_clause = ("WHERE " + " AND ".join(query_parts)) if query_parts else ""
    sql = f"SELECT c.*, u.name as user_name FROM complaints c JOIN users u ON c.user_id = u.id {where_clause} ORDER BY c.created_at DESC"
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    conn.close()

    complaints_list = []
    for r in rows:
        complaints_list.append({
            'complaintId': r['id'],
            'originalId': r['original_complaint_id'],
            'complaintText': r['description'],
            'category': r['category'],
            'subcategory': r['subcategory'],
            'location': r['location'],
            'severity': r['priority'],
            'status': r['status'],
            'seen': bool(r['seen']),
            'seenAt': r['seen_at'],
            'seenBy': r['seen_by'],
            'firstViewedAt': r['first_viewed_at'],
            'assignedAt': r['assigned_at'] or r['created_at'],
            'acknowledgedAt': r['acknowledged_at'],
            'acknowledgedBy': r['acknowledged_by'],
            'acknowledgementDeadline': r['acknowledgement_deadline'],
            'escalated': bool(r['escalated']),
            'escalationLevel': r['escalation_level'],
            'escalationReason': r['escalation_reason'],
            'department': r['department'],
            'assignedPerson': r['assigned_person'],
            'userVerified': r['status'] == 'Closed',
            'createdAt': r['created_at'],
            'incidentId': r['incident_id'] or r['original_complaint_id'],
            'evidenceProvenance': r['evidence_provenance'] or 'User Submission'
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

    now = format_timestamp()
    session_user_id = session.get('user_id')
    cursor.execute("SELECT role, name FROM users WHERE id = ?", (session_user_id,))
    curr_user = cursor.fetchone()
    curr_role = curr_user['role'] if curr_user else 'User'

    # If viewed by a department or org admin for the first time, record seen telemetry
    if not r['seen'] and curr_role in ['Department Admin', 'Organization Admin']:
        admin_name = curr_user['name'] if curr_user else 'Department Admin'
        cursor.execute('''
            UPDATE complaints
            SET seen = 1, seen_at = COALESCE(seen_at, ?), seen_by = COALESCE(seen_by, ?),
                first_viewed_at = COALESCE(first_viewed_at, ?)
            WHERE id = ?
        ''', (now, admin_name, now, complaint_id))
        cursor.execute('''
            INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
            VALUES (?, 'Seen', 'Opened and viewed by admin', ?, ?)
        ''', (complaint_id, admin_name, now))
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
        'subcategory': r['subcategory'],
        'location': r['location'],
        'severity': r['priority'],
        'status': r['status'],
        'seen': bool(r['seen']),
        'seenAt': r['seen_at'],
        'seenBy': r['seen_by'],
        'firstViewedAt': r['first_viewed_at'],
        'assignedAt': r['assigned_at'] or r['created_at'],
        'acknowledgedAt': r['acknowledged_at'],
        'acknowledgedBy': r['acknowledged_by'],
        'acknowledgementDeadline': r['acknowledgement_deadline'],
        'department': r['department'],
        'assignedPerson': r['assigned_person'],
        'resolutionNote': r['resolution_note'],
        'escalated': bool(r['escalated']),
        'escalationLevel': r['escalation_level'],
        'escalationReason': r['escalation_reason'],
        'incidentId': r['incident_id'] or r['original_complaint_id'],
        'evidenceProvenance': r['evidence_provenance'] or 'User Submission',
        'timeline': timeline
    })

# --- COMPLAINT ACKNOWLEDGEMENT & ESCALATION DAEMON ---

@app.route('/api/complaints/<complaint_id>/acknowledge', methods=['POST'])
def api_acknowledge_complaint(complaint_id):
    session_user_id = session.get('user_id')
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT role, name, department FROM users WHERE id = ?", (session_user_id,))
    u = cursor.fetchone()
    if not u or u['role'] not in ['Department Admin', 'Organization Admin']:
        conn.close()
        return jsonify({'error': 'Only Department or Organization Admins can formally acknowledge complaints.'}), 403

    now = format_timestamp()
    admin_name = u['name']

    cursor.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,))
    c = cursor.fetchone()
    if not c:
        conn.close()
        return jsonify({'error': 'Complaint not found'}), 404

    cursor.execute('''
    UPDATE complaints
    SET acknowledged_at = ?, acknowledged_by = ?, status = 'In Progress', seen = 1,
        seen_at = COALESCE(seen_at, ?), seen_by = COALESCE(seen_by, ?),
        first_viewed_at = COALESCE(first_viewed_at, ?), updated_at = ?
    WHERE id = ?
    ''', (now, admin_name, now, admin_name, now, now, complaint_id))

    cursor.execute('''
    INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
    VALUES (?, 'In Progress', ?, ?, ?)
    ''', (complaint_id, f"Officially acknowledged by {admin_name} ({u['role']}) — SLA timer halted", admin_name, now))

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Ticket {complaint_id} acknowledged by {admin_name}. Status changed to 'In Progress'.",
        'acknowledgedAt': now,
        'acknowledgedBy': admin_name
    })

@app.route('/api/admin/escalation-check', methods=['GET', 'POST'])
def api_check_escalations():
    now_dt = datetime.datetime.now()
    now_str = format_timestamp()

    conn = get_db()
    cursor = conn.cursor()

    # Find unacknowledged tickets where now > acknowledgement_deadline
    cursor.execute('''
    SELECT c.*, u.name as submitter_name
    FROM complaints c
    JOIN users u ON c.user_id = u.id
    WHERE c.status NOT IN ('Resolved', 'Closed')
      AND c.acknowledged_at IS NULL
      AND c.acknowledgement_deadline IS NOT NULL
      AND datetime('now') > datetime(c.acknowledgement_deadline)
    ''')
    breached_tickets = cursor.fetchall()

    newly_escalated = 0
    for t in breached_tickets:
        if not t['escalated']:
            cursor.execute('''
            UPDATE complaints
            SET escalated = 1, escalation_level = 1, escalated_at = ?,
                escalation_reason = 'SLA acknowledgement deadline exceeded without department confirmation',
                updated_at = ?
            WHERE id = ?
            ''', (now_str, now_str, t['id']))

            cursor.execute('''
            INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
            VALUES (?, 'Escalated', 'AUTOMATIC SLA BREACH: Acknowledged deadline passed without response. Escalated to Organization Admin.', 'System Daemon', ?)
            ''', (t['id'], now_str))
            newly_escalated += 1

    conn.commit()

    # Fetch all currently escalated complaints
    cursor.execute('''
    SELECT c.*, u.name as submitter_name
    FROM complaints c
    JOIN users u ON c.user_id = u.id
    WHERE c.escalated = 1 AND c.status NOT IN ('Resolved', 'Closed')
    ORDER BY c.priority DESC, c.acknowledgement_deadline ASC
    ''')
    all_escalated = cursor.fetchall()
    conn.close()

    escalated_items = []
    for row in all_escalated:
        overdue_text = "Overdue"
        if row['acknowledgement_deadline']:
            try:
                deadline_dt = datetime.datetime.strptime(row['acknowledgement_deadline'], "%Y-%m-%d %H:%M:%S")
                diff = now_dt - deadline_dt
                hours = int(diff.total_seconds() // 3600)
                mins = int((diff.total_seconds() % 3600) // 60)
                overdue_text = f"Overdue by {hours}h {mins}m"
            except Exception:
                overdue_text = "Overdue"

        escalated_items.append({
            'complaintId': row['id'],
            'originalId': row['original_complaint_id'],
            'description': row['description'],
            'category': row['category'],
            'location': row['location'],
            'priority': row['priority'],
            'department': row['department'],
            'assignedPerson': row['assigned_person'],
            'submitterName': row['submitter_name'],
            'assignedAt': row['assigned_at'] or row['created_at'],
            'acknowledgementDeadline': row['acknowledgement_deadline'],
            'overdueDuration': overdue_text,
            'escalationReason': row['escalation_reason'] or 'SLA breached'
        })

    return jsonify({
        'success': True,
        'newlyEscalatedCount': newly_escalated,
        'totalActiveEscalations': len(escalated_items),
        'escalations': escalated_items
    })

@app.route('/api/admin/escalations', methods=['GET'])
def api_get_escalations():
    return api_check_escalations()

# --- INCIDENTS & ROOT CAUSE INTELLIGENCE ---

@app.route('/api/incidents', methods=['GET'])
def api_incidents():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incidents ORDER BY incident_id ASC")
    rows = cursor.fetchall()
    conn.close()

    incidents_list = []
    for r in rows:
        incidents_list.append({
            'incidentId': r['incident_id'],
            'title': r['title'],
            'category': r['category'],
            'location': r['location'],
            'department': r['department'],
            'severity': r['severity'],
            'status': r['status'],
            'complaintCount': r['complaint_count'],
            'affectedUsers': r['affected_users'],
            'rootCauseConfidence': r['root_cause_confidence'],
            'possibleRootCause': r['possible_root_cause'],
            'patternDetected': r['pattern_detected'],
            'assignedTeam': r['assigned_team'],
            'resolutionStatus': r['resolution_status']
        })

    return jsonify(incidents_list)

@app.route('/api/incidents/<incident_id>', methods=['GET'])
def api_incident_detail(incident_id):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM incidents WHERE incident_id = ?", (incident_id,))
    inc = cursor.fetchone()

    # Fetch grouped complaints
    cursor.execute("SELECT c.*, u.name as user_name FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.incident_id = ? OR c.original_complaint_id = ?", (incident_id, incident_id))
    complaint_rows = cursor.fetchall()

    # Fetch resolutions for this incident
    cursor.execute("SELECT * FROM resolutions WHERE incident_id = ? ORDER BY attempt_number ASC", (incident_id,))
    res_rows = cursor.fetchall()
    conn.close()

    if not inc and not complaint_rows:
        return jsonify({'error': 'Incident not found'}), 404

    grouped = []
    for r in complaint_rows:
        grouped.append({
            'complaintId': r['id'],
            'complaintText': r['description'],
            'location': r['location'],
            'category': r['category'],
            'createdAt': r['created_at'],
            'status': r['status'],
            'evidenceProvenance': r['evidence_provenance'] or 'User Submission'
        })

    resolutions_list = []
    for res in res_rows:
        resolutions_list.append({
            'resolutionId': res['resolution_id'],
            'attemptNumber': res['attempt_number'],
            'actionTaken': res['action_taken'],
            'performedBy': res['performed_by'],
            'performedAt': res['performed_at'],
            'success': bool(res['success']),
            'outcome': res['outcome'],
            'verificationStatus': res['verification_status'],
            'feedbackSummary': res['user_feedback_summary']
        })

    confidence_pct = int((inc['root_cause_confidence'] if inc else 0.85) * 100)
    title = inc['title'] if inc else f"Incident {incident_id}"
    cat = inc['category'] if inc else (complaint_rows[0]['category'] if complaint_rows else 'General')
    loc = inc['location'] if inc else (complaint_rows[0]['location'] if complaint_rows else 'Campus')
    prio = inc['severity'] if inc else 'High'
    status = inc['status'] if inc else 'Investigating'
    cause = inc['possible_root_cause'] if inc else 'Infrastructure load degradation'
    pattern = inc['pattern_detected'] if inc else f"Multiple reports clustered in {loc}"

    return jsonify({
        'incident': {
            'incidentId': incident_id,
            'title': title,
            'category': cat,
            'location': loc,
            'severity': prio,
            'status': status,
            'affectedUsers': inc['affected_users'] if inc else len(grouped) * 2 + 1,
            'complaintCount': inc['complaint_count'] if inc else len(grouped),
            'patternDetected': pattern,
            'assignedTeam': inc['assigned_team'] if inc else 'Facilities & IT'
        },
        'rootCauseHypothesis': {
            'disclaimer': 'AI-Generated Hypothesis — Requires Human Verification',
            'probableCause': cause,
            'confidencePercentage': confidence_pct,
            'historicalEvidence': f"Symptom clustering in {loc} correlates with historical pattern. Pattern: {pattern}.",
            'recommendedAction': f"Dispatch {inc['assigned_team'] if inc else 'Department Team'} for localized component inspection."
        },
        'dataProvenance': {
            'userComplaintsCount': len(grouped),
            'datasetBaseline': 'Historical Campus Infrastructure Model',
            'inferenceConfidence': f"{confidence_pct}% model estimate"
        },
        'groupedComplaints': grouped,
        'resolutions': resolutions_list
    })

# --- RESOLUTIONS MANAGEMENT ---

@app.route('/api/resolutions', methods=['GET', 'POST'])
def api_resolutions():
    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'POST':
        data = request.json or {}
        incident_id = data.get('incidentId', 'INC-001')
        action = data.get('actionTaken', 'Action completed')
        performed_by = data.get('performedBy', session.get('user_name', 'Department Admin'))
        success = 1 if data.get('success', True) else 0
        now = format_timestamp()

        # Find attempt count
        cursor.execute("SELECT COUNT(*) as cnt FROM resolutions WHERE incident_id = ?", (incident_id,))
        attempt_num = cursor.fetchone()['cnt'] + 1
        res_id = f"RES-{random.randint(1000, 9999)}"

        cursor.execute('''
        INSERT INTO resolutions (
            resolution_id, incident_id, attempt_number, action_taken, performed_by,
            performed_at, action_type, outcome, success, resolution_time_hours,
            verification_status, user_feedback_summary, follow_up_required, incident_final_status
        ) VALUES (?, ?, ?, ?, ?, ?, 'Repair & Maintenance', ?, ?, 3.0, 'Pending Verification', 'Awaiting user verification', 0, 'Resolved')
        ''', (
            res_id, incident_id, attempt_num, action, performed_by, now,
            'Action executed successfully' if success else 'Action unsuccessful', success
        ))

        # Update complaints status
        cursor.execute('''
        UPDATE complaints SET status = 'Resolved', resolution_note = ?, updated_at = ?
        WHERE incident_id = ? OR original_complaint_id = ?
        ''', (action, now, incident_id, incident_id))

        # Add timeline entry
        cursor.execute("SELECT id FROM complaints WHERE incident_id = ? OR original_complaint_id = ?", (incident_id, incident_id))
        for c_row in cursor.fetchall():
            cursor.execute('''
            INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
            VALUES (?, 'Resolved', ?, ?, ?)
            ''', (c_row['id'], f"Resolution Attempt #{attempt_num}: {action}", performed_by, now))

        conn.commit()
        conn.close()
        return jsonify({
            'success': True,
            'message': 'Resolution recorded successfully!',
            'resolutionId': res_id,
            'attemptNumber': attempt_num
        })

    # GET resolutions
    cursor.execute("SELECT * FROM resolutions ORDER BY performed_at DESC")
    rows = cursor.fetchall()
    conn.close()

    res_list = []
    for r in rows:
        res_list.append({
            'resolutionId': r['resolution_id'],
            'incidentId': r['incident_id'],
            'attemptNumber': r['attempt_number'],
            'actionTaken': r['action_taken'],
            'performedBy': r['performed_by'],
            'performedAt': r['performed_at'],
            'actionType': r['action_type'],
            'outcome': r['outcome'],
            'success': bool(r['success']),
            'verificationStatus': r['verification_status'],
            'userFeedbackSummary': r['user_feedback_summary']
        })
    return jsonify(res_list)

# --- USER VERIFICATION WORKFLOW ---

@app.route('/api/verification', methods=['POST'])
def api_verification():
    data = request.json or {}
    complaint_id = data.get('complaintId')
    status = data.get('verificationStatus', 'Yes') # 'Yes', 'No', 'Partial'
    feedback = data.get('feedbackText', '')

    conn = get_db()
    cursor = conn.cursor()
    now = format_timestamp()

    if status in ['Yes', 'Confirmed', 'Solved']:
        new_status = 'Closed'
        msg_text = 'User confirmed problem is fully solved. Ticket closed.'
    elif status in ['No', 'Still Not Solved', 'Disputed']:
        new_status = 'Reopened'
        msg_text = f'User reported problem is NOT fixed. Ticket reopened. Reason: {feedback}'
    else:
        new_status = 'In Progress'
        msg_text = f'User reported partial resolution. Continued monitoring required. Note: {feedback}'

    cursor.execute("UPDATE complaints SET status = ?, user_verified = ?, updated_at = ? WHERE id = ?", (new_status, 1 if new_status == 'Closed' else 0, now, complaint_id))
    cursor.execute("INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp) VALUES (?, ?, ?, 'User Verification', ?)", (complaint_id, new_status, msg_text, now))

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Verification recorded. Ticket status set to {new_status}.",
        'newStatus': new_status
    })

# --- KNOWLEDGE BASE ---

@app.route('/api/knowledge', methods=['GET'])
def api_knowledge():
    conn = get_db()
    cursor = conn.cursor()

    category_filter = request.args.get('category')
    search_query = request.args.get('q')

    query_parts = []
    params = []

    if category_filter:
        query_parts.append("(problem_type LIKE ? OR location LIKE ?)")
        params.extend([f"%{category_filter}%", f"%{category_filter}%"])
    if search_query:
        query_parts.append("(problem_type LIKE ? OR problem_description LIKE ? OR root_cause LIKE ? OR lesson_learned LIKE ?)")
        wildcard = f"%{search_query}%"
        params.extend([wildcard, wildcard, wildcard, wildcard])

    where_clause = ("WHERE " + " AND ".join(query_parts)) if query_parts else ""
    cursor.execute(f"SELECT * FROM knowledge_base {where_clause} ORDER BY knowledge_id ASC", params)
    rows = cursor.fetchall()
    conn.close()

    items = []
    for r in rows:
        items.append({
            'knowledgeId': r['knowledge_id'],
            'incidentId': r['incident_id'],
            'problemType': r['problem_type'],
            'problemDescription': r['problem_description'],
            'location': r['location'],
            'rootCause': r['root_cause'],
            'rootCauseConfidence': r['root_cause_confidence'],
            'solutionAttempted': r['solution_attempted'],
            'successfulSolution': r['successful_solution'],
            'failedSolution': r['failed_solution'],
            'outcome': r['outcome'],
            'resolutionTimeHours': r['resolution_time_hours'],
            'successRate': r['success_rate'],
            'lessonLearned': r['lesson_learned'],
            'recommendedFutureAction': r['recommended_future_action'],
            'lastUpdated': r['last_updated']
        })
    return jsonify(items)

# --- PREVENTION CENTER ---

@app.route('/api/prevention', methods=['GET'])
def api_prevention():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM prevention_recommendations ORDER BY recommendation_id ASC")
    rows = cursor.fetchall()
    conn.close()

    recs = []
    for r in rows:
        recs.append({
            'recommendationId': r['recommendation_id'],
            'incidentId': r['incident_id'],
            'problem': r['problem'],
            'recommendation': r['recommendation'],
            'reason': r['reason'],
            'evidence': r['evidence'],
            'riskLevel': r['risk_level'],
            'priority': r['priority'],
            'expectedImpact': r['expected_impact'],
            'suggestedTimeline': r['suggested_timeline'],
            'responsibleDepartment': r['responsible_department'],
            'recommendedActionType': r['recommended_action_type'],
            'status': r['status'],
            'createdAt': r['created_at'],
            'supportingComplaintCount': r['supporting_complaint_count'],
            'decisionNote': r['decision_note']
        })
    return jsonify(recs)

@app.route('/api/prevention/<rec_id>/action', methods=['POST'])
def api_prevention_action(rec_id):
    data = request.json or {}
    new_status = data.get('status', 'Approved') # 'Approved', 'Under Review', 'Rejected', 'Completed'
    decision_note = data.get('decisionNote', '')
    reviewer = session.get('user_name', 'Department Admin')
    now = format_timestamp()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
    UPDATE prevention_recommendations
    SET status = ?, decision_note = ?, reviewed_by = ?, reviewed_at = ?
    WHERE recommendation_id = ?
    ''', (new_status, decision_note, reviewer, now, rec_id))
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Recommendation {rec_id} status updated to {new_status}.",
        'status': new_status
    })

# --- ADVANCED CONTEXT-AWARE AI CO-PILOT ---

@app.route('/api/copilot', methods=['POST'])
@app.route('/api/copilot/ask', methods=['POST'])
def api_copilot():
    data = request.json or {}
    query = data.get('query', '').strip().lower()

    session_user_id = session.get('user_id') or 1
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT role, department, name FROM users WHERE id = ?", (session_user_id,))
    u = cursor.fetchone()
    role = u['role'] if u else 'User'
    user_dept = u['department'] if u else ''
    user_name = u['name'] if u else ''

    resp = ""
    suggested_actions = []

    # 1. Department workload
    if any(k in query for k in ['most unresolved', 'department workload', 'which department', 'department has the most', 'most complaints']):
        cursor.execute("SELECT department, COUNT(*) as total, SUM(CASE WHEN status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) as active FROM complaints GROUP BY department ORDER BY active DESC")
        depts = cursor.fetchall()
        top = depts[0] if depts else None
        if top:
            resp = f"**{top['department']}** currently carries the highest workload with **{top['active']} unresolved complaints** out of {top['total']} total reported."
            suggested_actions.append({'label': 'View Incidents', 'link': '#incidents'})
        else:
            resp = "No department complaints are currently logged."

    # 2. Pending / Unresolved complaints
    elif any(k in query for k in ['pending', 'unresolved', 'active complaints', 'how many complaints']):
        if role == 'Department Admin':
            cursor.execute("SELECT COUNT(*) as cnt FROM complaints WHERE (department = ? OR assigned_person = ?) AND status NOT IN ('Resolved', 'Closed')", (user_dept, user_name))
            cnt = cursor.fetchone()['cnt']
            resp = f"There are currently **{cnt} unresolved complaints** in the **{user_dept}** queue awaiting departmental action."
            suggested_actions.append({'label': 'View Department Queue', 'link': '#my-complaints'})
        elif role == 'Organization Admin':
            cursor.execute("SELECT COUNT(*) as cnt FROM complaints WHERE status NOT IN ('Resolved', 'Closed')")
            cnt = cursor.fetchone()['cnt']
            cursor.execute("SELECT department, COUNT(*) as cnt FROM complaints WHERE status NOT IN ('Resolved', 'Closed') GROUP BY department ORDER BY cnt DESC LIMIT 3")
            breakdown = cursor.fetchall()
            b_str = ", ".join([f"**{b['department']}** ({b['cnt']})" for b in breakdown])
            resp = f"Across the institution, there are **{cnt} active complaints**. Top department queues: {b_str}."
            suggested_actions.append({'label': 'View All Complaints', 'link': '#my-complaints'})
            suggested_actions.append({'label': 'Inspect Incidents', 'link': '#incidents'})
        else:
            cursor.execute("SELECT COUNT(*) as cnt FROM complaints WHERE user_id = ? AND status NOT IN ('Resolved', 'Closed')", (session_user_id,))
            cnt = cursor.fetchone()['cnt']
            resp = f"You have **{cnt} active complaint(s)** currently in progress with the assigned campus departments."
            suggested_actions.append({'label': 'Track My Complaints', 'link': '#my-complaints'})

    # 3. Specific complaint query (CMP...)
    elif 'cmp' in query:
        words = query.replace('?', '').replace('.', '').split()
        target_cmp = next((w.upper() for w in words if 'CMP' in w.upper()), None)
        if target_cmp:
            cursor.execute("SELECT c.*, u.name as user_name FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.id LIKE ? OR c.original_complaint_id LIKE ?", (f"%{target_cmp}%", f"%{target_cmp}%"))
            c_row = cursor.fetchone()
            if c_row:
                # Permission check
                if role == 'User' and c_row['user_id'] != session_user_id:
                    resp = f"Complaint **{target_cmp}** exists, but detailed ticket descriptions are private to the submitting user and assigned department."
                else:
                    seen_status = f"Seen by {c_row['seen_by']} at {c_row['seen_at']}" if c_row['seen'] else "Not yet opened by admin"
                    resp = (f"**Ticket {c_row['id']}** ({c_row['category']})\n"
                            f"- **Status**: `{c_row['status']}`\n"
                            f"- **Department**: {c_row['department']} ({c_row['assigned_person']})\n"
                            f"- **Location**: {c_row['location']} | **Severity**: {c_row['priority']}\n"
                            f"- **Telemetry**: {seen_status}\n"
                            f"- **Description**: \"{c_row['description']}\"")
                    suggested_actions.append({'label': f"Open {c_row['id']}", 'link': '#my-complaints'})
            else:
                resp = f"No complaint matching identifier **{target_cmp}** was found in the system."
        else:
            resp = "Please specify a complaint ID (for example, `CMP296-A` or `CMP-00218`)."

    # 4. Recurring network/water/electrical/lift problems
    elif any(k in query for k in ['network', 'wifi', 'wi-fi', 'water', 'electricity', 'lift', 'elevator', 'recurring']):
        topic = "Network" if any(w in query for w in ['network', 'wifi', 'wi-fi']) else ("Water" if 'water' in query else ("Lift" if 'lift' in query else "Electricity"))
        cursor.execute("SELECT COUNT(*) as cnt FROM complaints WHERE category LIKE ?", (f"%{topic}%",))
        c_cnt = cursor.fetchone()['cnt']
        cursor.execute("SELECT incident_id, title, location, severity, root_cause_confidence, possible_root_cause FROM incidents WHERE category LIKE ? LIMIT 1", (f"%{topic}%",))
        inc = cursor.fetchone()

        if inc:
            conf_pct = int(inc['root_cause_confidence'] * 100)
            resp = (f"Found **{c_cnt} complaints** related to **{topic}**.\n\n"
                    f"**Active Incident {inc['incident_id']}**: {inc['title']}\n"
                    f"- **Hotspot**: {inc['location']}\n"
                    f"- **AI Root Cause Hypothesis** ({conf_pct}% confidence): {inc['possible_root_cause']}")
            suggested_actions.append({'label': f"Inspect Incident {inc['incident_id']}", 'link': f"#incidents/{inc['incident_id']}"})
        else:
            resp = f"There are currently **{c_cnt} {topic}-related reports** logged across campus facilities."
            suggested_actions.append({'label': 'View Complaints', 'link': '#my-complaints'})

    # 5. Longest unresolved incidents
    elif any(k in query for k in ['longest', 'oldest', 'unresolved the longest']):
        cursor.execute("SELECT incident_id, title, location, first_reported_at, complaint_count FROM incidents WHERE status != 'Resolved' ORDER BY first_reported_at ASC LIMIT 2")
        oldest = cursor.fetchall()
        if oldest:
            lines = [f"- **{o['incident_id']}** ({o['title']}): Reported on {o['first_reported_at']} ({o['complaint_count']} linked reports)" for o in oldest]
            resp = "The longest standing unresolved incidents are:\n" + "\n".join(lines)
            suggested_actions.append({'label': 'Open Incidents Board', 'link': '#incidents'})
        else:
            resp = "All campus incidents have been resolved."

    # 6. Prevention & recommendations
    elif any(k in query for k in ['recommendation', 'prevent', 'prevention', 'suggested action']):
        cursor.execute("SELECT recommendation_id, problem, recommendation, responsible_department, priority FROM prevention_recommendations WHERE status = 'Approved' LIMIT 2")
        recs = cursor.fetchall()
        if recs:
            lines = [f"- **{r['recommendation_id']}** ({r['responsible_department']}): {r['recommendation']} *(Problem: {r['problem']})*" for r in recs]
            resp = "Key active prevention recommendations:\n" + "\n".join(lines)
            suggested_actions.append({'label': 'View Prevention Center', 'link': '#prevention-center'})
            suggested_actions.append({'label': 'AI Assistant', 'link': '#ai-assistant'})
        else:
            resp = "No active prevention recommendations require review at this moment."

    # 7. My submitted complaints
    elif any(k in query for k in ['my complaint', 'my tickets', 'what have i submitted', 'what complaints have i']):
        cursor.execute("SELECT id, category, location, priority, status FROM complaints WHERE user_id = ? ORDER BY created_at DESC LIMIT 3", (session_user_id,))
        mine = cursor.fetchall()
        if mine:
            lines = [f"- **{m['id']}** ({m['category']}): `{m['status']}` at {m['location']} [Priority: {m['priority']}]" for m in mine]
            resp = f"You have submitted the following recent complaint(s):\n" + "\n".join(lines)
            suggested_actions.append({'label': 'View All My Complaints', 'link': '#my-complaints'})
        else:
            resp = "You have not submitted any complaints yet. Use the 'Submit Problem' feature to report any campus issue."
            suggested_actions.append({'label': 'Submit Problem', 'link': '#submit-problem'})

    # 8. Immediate attention / Escalated / SLA Breaches
    elif any(k in query for k in ['immediate attention', 'critical', 'escalat', 'sla', 'breach', 'overdue', 'unacknowledged']):
        cursor.execute('''
            SELECT id, category, location, priority, department, assigned_person, acknowledgement_deadline
            FROM complaints
            WHERE priority = 'Critical' OR escalated = 1 OR (acknowledged_at IS NULL AND status NOT IN ('Resolved', 'Closed'))
            ORDER BY priority DESC, created_at ASC LIMIT 4
        ''')
        urgent = cursor.fetchall()
        if urgent:
            lines = [f"- **{u_item['id']}** ({u_item['category']}): {u_item['location']} [Dept: {u_item['department']} | Priority: {u_item['priority']}]" for u_item in urgent]
            resp = "⚠️ **Urgent Operational Attention / SLA Telemetry**:\n" + "\n".join(lines)
            suggested_actions.append({'label': 'Inspect Overdue & Escalations', 'link': '#my-complaints'})
        else:
            resp = "Good news: No tickets are currently escalated or flagged as Critical priority."

    # 9. Self-Service & Prevention Impact
    elif any(k in query for k in ['self-service', 'self service', 'saved', 'prevented', 'self help']):
        cursor.execute("SELECT COUNT(*) as total FROM self_service_resolutions")
        total_ss = cursor.fetchone()['total']
        cursor.execute("SELECT problem_type, COUNT(*) as cnt FROM self_service_resolutions GROUP BY problem_type ORDER BY cnt DESC LIMIT 3")
        top_ss = cursor.fetchall()
        top_str = ", ".join([f"**{t['problem_type']}** ({t['cnt']})" for t in top_ss]) if top_ss else "general infrastructure"
        resp = (f"🌱 **Institutional Self-Service Telemetry**:\n"
                f"- **{total_ss} total issues** successfully resolved through pre-submission troubleshooting.\n"
                f"- **Estimated ~{round(total_ss * 2.5, 1)} technician hours** saved from unnecessary campus dispatches.\n"
                f"- Top resolved categories: {top_str}.")
        suggested_actions.append({'label': 'AI Assistant', 'link': '#ai-assistant'})
        suggested_actions.append({'label': 'Prevention Center', 'link': '#prevention-center'})

    # Default overview
    else:
        cursor.execute("SELECT COUNT(*) as total FROM complaints")
        total = cursor.fetchone()['total']
        cursor.execute("SELECT COUNT(*) as active FROM complaints WHERE status NOT IN ('Resolved', 'Closed')")
        active = cursor.fetchone()['active']
        cursor.execute("SELECT COUNT(*) as inc_cnt FROM incidents")
        inc_cnt = cursor.fetchone()['inc_cnt']
        resp = (f"**PROBLEMINT Intelligence Core**: Tracking **{total} total complaints** across **{inc_cnt} incidents**.\n"
                f"Currently, **{active} complaints** are actively undergoing department resolution.\n\n"
                f"You can ask me about:\n"
                f"- Specific tickets (e.g., *'Status of CMP-DEMO-1'*)\n"
                f"- Problem categories (*'Show water complaints'* or *'Wi-Fi issues'*)\n"
                f"- Department workload (*'Which department has the most unresolved tickets?'*)\n"
                f"- Prevention protocols (*'Show prevention recommendations'*)\n"
                f"- Your personal submissions (*'What complaints have I submitted?'*)")
        suggested_actions.append({'label': 'Dashboard Telemetry', 'link': '#dashboard'})
        suggested_actions.append({'label': 'Submit Problem', 'link': '#submit-problem'})

    conn.close()

    return jsonify({
        'response': resp,
        'answer': resp,
        'suggestedActions': suggested_actions
    })

# --- NOTIFICATIONS ---

@app.route('/api/notifications', methods=['GET'])
def api_notifications():
    session_user_id = session.get('user_id') or 1
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
    SELECT ct.*, c.category, c.location
    FROM complaint_timeline ct
    JOIN complaints c ON ct.complaint_id = c.id
    ORDER BY ct.id DESC LIMIT 8
    ''')
    rows = cursor.fetchall()
    conn.close()

    notifs = []
    for r in rows:
        notifs.append({
            'title': f"{r['complaint_id']} — {r['status']}",
            'message': f"{r['description']} ({r['location']})",
            'timestamp': r['timestamp'],
            'link': '#my-complaints'
        })

    return jsonify(notifs)

if __name__ == '__main__':
    init_db()
    print("Starting PROBLEMINT Platform Server on http://127.0.0.1:5000 ...")
    app.run(debug=True, port=5000)
