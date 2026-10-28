import os
import json
import random
import datetime
import uuid
import mimetypes
import urllib.request
import urllib.parse
from flask import Flask, jsonify, request, send_from_directory, session, redirect
from database import get_db, init_db, ensure_notification_reads
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from services.categorization import categorizeComplaint
from services.complaint_splitter import splitComplaint, analyzeMultiIssues
from services.priority import detectPriority, detectLocation
from services.routing import routeComplaint
from services.escalation import checkEscalation

app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'smart_complaint_secret_key_antigravity')

# Upload & File Storage Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max upload
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'}
ASSIGNED_STAFF_TYPES = {
    'staff', 'teaching staff', 'non-teaching staff', 'research staff',
    'lab technician', 'maintenance worker', 'housekeeping worker'
}
OPERATIONAL_STAFF_TYPES = {'lab technician', 'maintenance worker', 'housekeeping worker'}

# Google OAuth2 Credentials
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI', '')

CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.json')

def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def format_timestamp():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_session_user():
    user_id = session.get('user_id')
    if not user_id:
        return None

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, email, password, role, user_type, roll_number, employee_id, designation, status, department
        FROM users WHERE id = ?
    """, (user_id,))
    user = cursor.fetchone()
    conn.close()

    if not user or user['status'] == 'Inactive':
        return None
    return dict(user)


def require_auth():
    user = get_session_user()
    if user is None:
        return None
    return user

def complaint_scope_for_user(user, alias='c'):
    if user['role'] == 'Organization Admin':
        return '1 = 1', []
    if user['role'] == 'Department Admin':
        return f'({alias}.department = ? OR {alias}.assigned_person = ?)', [user['department'] or '', user['name']]
    if (user['user_type'] or '').strip().lower() in ASSIGNED_STAFF_TYPES:
        return f'({alias}.user_id = ? OR {alias}.assigned_person = ?)', [user['id'], user['name']]
    return f'{alias}.user_id = ?', [user['id']]


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS


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
    return jsonify({'authenticated': False, 'user': None}), 200

@app.route('/api/me', methods=['GET'])
def api_get_me():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, email, role, user_type, roll_number, employee_id, designation, status, department
        FROM users WHERE id = ?
    """, (user_id,))
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
    return jsonify({'error': 'User not found'}), 404

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json or {}
    user_id = data.get('userId') or data.get('user_id')
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')
    role_key = (data.get('roleKey') or data.get('role_key') or data.get('role') or '').strip().lower()

    if not (email or user_id) or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    conn = get_db()
    cursor = conn.cursor()

    u = None
    if user_id:
        cursor.execute("""
            SELECT id, name, email, password, role, user_type, roll_number, employee_id, designation, status, department
            FROM users WHERE id = ?
        """, (user_id,))
        u = cursor.fetchone()
    else:
        cursor.execute("""
            SELECT id, name, email, password, role, user_type, roll_number, employee_id, designation, status, department
            FROM users WHERE LOWER(email) = ? OR LOWER(email) = ? OR LOWER(roll_number) = ? OR LOWER(employee_id) = ?
        """, (email, f"{email}@college.edu", email, email))
        u = cursor.fetchone()

    if u and u['status'] == 'Inactive':
        conn.close()
        return jsonify({'error': 'This account has been deactivated. Please contact the administrator.'}), 403

    if not u or not (u['password'] == password or check_password_hash(u['password'], password)):
        conn.close()
        return jsonify({'error': 'Invalid email or password'}), 401

    if role_key and role_key not in ('student', 'teaching', 'non-teaching', 'research', 'lab', 'maintenance', 'housekeeping', 'dept-admin', 'org-admin', 'user'):
        # Accept legacy role hint only as metadata; it must never override the verified user record.
        pass

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

@app.route('/api/logout', methods=['POST', 'GET'])
def api_logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})

# --- ACCOUNT REGISTRATION & RECOVERY ---

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.json or {}
    name = (data.get('name') or data.get('fullName') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '').strip()
    user_type = (data.get('user_type') or data.get('userType') or 'Student').strip()
    role = 'User'  # Standard user role
    roll_number = (data.get('roll_number') or data.get('rollNumber') or '').strip() or None
    employee_id = (data.get('employee_id') or data.get('employeeId') or '').strip() or None
    designation = (data.get('designation') or user_type).strip()
    department = (data.get('department') or 'General Campus').strip()

    # Input validations with clear, friendly error messages
    if not name or len(name) < 2:
        return jsonify({'error': 'Please enter your full name (at least 2 characters).'}), 400
    if not email or '@' not in email or '.' not in email:
        return jsonify({'error': 'Please enter a valid institutional email address.'}), 400
    if not password:
        return jsonify({'error': 'Please enter a password.'}), 400
    if len(password) < 8 or not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        return jsonify({'error': 'Password requirement not met: Use at least 8 characters, including letters and numbers (e.g. College2026).'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # Prevent duplicate accounts
    cursor.execute("SELECT id, name FROM users WHERE email = ?", (email,))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        return jsonify({'error': f'An account with email {email} already exists. Please sign in instead.'}), 409

    now = format_timestamp()
    pw_hash = generate_password_hash(password)

    cursor.execute('''
    INSERT INTO users (
        name, email, password, role, user_type, roll_number, employee_id,
        designation, status, organization_id, department, created_at, last_login_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', 1, ?, ?, ?)
    ''', (name, email, pw_hash, role, user_type, roll_number, employee_id, designation, department, now, now))
    new_user_id = cursor.lastrowid

    # Create default user settings
    cursor.execute('''
    INSERT INTO user_settings (user_id, full_name, notify_forwarding, notify_seen, notify_resolution, notify_escalation, ai_threshold, sla_window, updated_at)
    VALUES (?, ?, 1, 1, 1, 1, 75, '24 Hours (Standard)', ?)
    ''', (new_user_id, name, now))

    conn.commit()
    conn.close()

    # Immediately log user in with session
    session['user_id'] = new_user_id
    session['user_name'] = name
    session['role'] = role
    session['department'] = department

    return jsonify({
        'success': True,
        'message': f'Welcome to PROBLEMINT, {name}! Your account has been created successfully.',
        'user': {
            'id': new_user_id,
            'name': name,
            'email': email,
            'role': role,
            'user_type': user_type,
            'roll_number': roll_number,
            'employee_id': employee_id,
            'designation': designation,
            'status': 'Active',
            'department': department
        }
    }), 201

@app.route('/api/forgot-password', methods=['POST'])
def api_forgot_password():
    data = request.json or {}
    email = (data.get('email') or '').strip().lower()
    if not email:
        return jsonify({'error': 'Please enter your institutional email address.'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()

    if not user:
        conn.close()
        return jsonify({'error': f'No registered account was found with email {email}. Please check your spelling or create an account.'}), 404

    # Generate 6-digit reset code (valid 15 minutes)
    reset_code = f"{random.randint(100000, 999999)}"
    now = datetime.datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    expires_at = (now + datetime.timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute('''
    INSERT INTO password_resets (email, reset_code, created_at, expires_at, used)
    VALUES (?, ?, ?, ?, 0)
    ''', (email, reset_code, now_str, expires_at))
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': f'Password reset code generated. For this campus environment, your verification code is: {reset_code}',
        'resetCode': reset_code,
        'email': email
    })

@app.route('/api/reset-password', methods=['POST'])
def api_reset_password():
    data = request.json or {}
    email = (data.get('email') or '').strip().lower()
    reset_code = (data.get('resetCode') or data.get('code') or '').strip()
    new_password = (data.get('newPassword') or data.get('password') or '').strip()

    if not email or not reset_code or not new_password:
        return jsonify({'error': 'Please fill out all fields: Email, Verification Code, and New Password.'}), 400

    if len(new_password) < 8 or not any(c.isalpha() for c in new_password) or not any(c.isdigit() for c in new_password):
        return jsonify({'error': 'Password requirement not met: Use at least 8 characters, including letters and numbers.'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
    SELECT id, expires_at, used FROM password_resets
    WHERE email = ? AND reset_code = ? AND used = 0
    ORDER BY id DESC LIMIT 1
    ''', (email, reset_code))
    reset_req = cursor.fetchone()

    if not reset_req:
        conn.close()
        return jsonify({'error': 'Invalid or already used verification code. Please request a new code.'}), 400

    now_str = format_timestamp()
    if now_str > reset_req['expires_at']:
        conn.close()
        return jsonify({'error': 'Verification code has expired (valid for 15 minutes). Please request a new code.'}), 400

    pw_hash = generate_password_hash(new_password)
    cursor.execute("UPDATE users SET password = ? WHERE email = ?", (pw_hash, email))
    cursor.execute("UPDATE password_resets SET used = 1 WHERE id = ?", (reset_req['id'],))
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Password has been reset successfully! You can now log in with your new credentials.'
    })

# --- GOOGLE OAUTH AUTHENTICATION ---

@app.route('/api/auth/google/config', methods=['GET'])
def api_google_config():
    is_configured = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
    redirect_uri = GOOGLE_REDIRECT_URI or (request.host_url.rstrip('/') + '/api/auth/google/callback')
    return jsonify({
        'configured': is_configured,
        'clientId': GOOGLE_CLIENT_ID if is_configured else None,
        'redirectUri': redirect_uri,
        'help': 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables for live Google OAuth production login.'
    })

@app.route('/api/auth/google/url', methods=['GET'])
def api_google_auth_url():
    if not GOOGLE_CLIENT_ID:
        return jsonify({
            'error': 'Google OAuth is not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.',
            'configured': False
        }), 400

    redirect_uri = GOOGLE_REDIRECT_URI or (request.host_url.rstrip('/') + '/api/auth/google/callback')
    state = uuid.uuid4().hex
    session['oauth_state'] = state

    params = {
        'client_id': GOOGLE_CLIENT_ID,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': 'openid email profile',
        'access_type': 'online',
        'state': state,
        'prompt': 'select_account'
    }
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return jsonify({'authUrl': auth_url, 'configured': True})

@app.route('/api/auth/google/callback', methods=['GET'])
def api_google_callback():
    code = request.args.get('code')
    error = request.args.get('error')

    if error or not code:
        return redirect('/#auth-error=google_auth_cancelled')

    redirect_uri = GOOGLE_REDIRECT_URI or (request.host_url.rstrip('/') + '/api/auth/google/callback')

    try:
        token_data = urllib.parse.urlencode({
            'code': code,
            'client_id': GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_CLIENT_SECRET,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code'
        }).encode('utf-8')

        token_req = urllib.request.Request(
            'https://oauth2.googleapis.com/token',
            data=token_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        with urllib.request.urlopen(token_req) as token_resp:
            token_json = json.loads(token_resp.read().decode('utf-8'))
            access_token = token_json.get('access_token')

        user_req = urllib.request.Request(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f'Bearer {access_token}'}
        )
        with urllib.request.urlopen(user_req) as user_resp:
            profile = json.loads(user_resp.read().decode('utf-8'))

        email = profile.get('email')
        name = profile.get('name') or profile.get('given_name') or 'Google User'
        google_id = profile.get('id')
        picture = profile.get('picture')

        if not email:
            return redirect('/#auth-error=no_email_provided')

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ? OR google_id = ?", (email, google_id))
        user = cursor.fetchone()
        now = format_timestamp()

        if user:
            cursor.execute("UPDATE users SET google_id = COALESCE(google_id, ?), avatar_url = COALESCE(?, avatar_url), last_login_at = ? WHERE id = ?", (google_id, picture, now, user['id']))
            user_id = user['id']
            user_name = user['name']
            user_role = user['role']
            user_dept = user['department']
        else:
            cursor.execute('''
            INSERT INTO users (name, email, password, role, user_type, designation, status, organization_id, department, google_id, avatar_url, created_at, last_login_at)
            VALUES (?, ?, ?, 'User', 'Student', 'Student (Google Verified)', 'Active', 1, 'General Campus', ?, ?, ?, ?)
            ''', (name, email, generate_password_hash(uuid.uuid4().hex), google_id, picture, now, now))
            user_id = cursor.lastrowid
            user_name = name
            user_role = 'User'
            user_dept = 'General Campus'

            cursor.execute('''
            INSERT INTO user_settings (user_id, full_name, notify_forwarding, notify_seen, notify_resolution, notify_escalation, ai_threshold, sla_window, updated_at)
            VALUES (?, ?, 1, 1, 1, 1, 75, '24 Hours (Standard)', ?)
            ''', (user_id, name, now))

        conn.commit()
        conn.close()

        session['user_id'] = user_id
        session['user_name'] = user_name
        session['role'] = user_role
        session['department'] = user_dept

        return redirect('/#home')

    except Exception as e:
        return redirect(f'/#auth-error={urllib.parse.quote(str(e))}')

@app.route('/api/auth/google/verify', methods=['POST'])
def api_google_verify():
    data = request.json or {}
    credential = data.get('credential')
    if not credential:
        return jsonify({'error': 'Google credential token is required'}), 400

    try:
        req = urllib.request.Request(f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}")
        with urllib.request.urlopen(req) as resp:
            profile = json.loads(resp.read().decode('utf-8'))

        email = profile.get('email')
        name = profile.get('name') or profile.get('given_name') or 'Google User'
        google_id = profile.get('sub')
        picture = profile.get('picture')

        if not email:
            return jsonify({'error': 'Email not verified by Google'}), 400

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ? OR google_id = ?", (email, google_id))
        user = cursor.fetchone()
        now = format_timestamp()

        if user:
            cursor.execute("UPDATE users SET google_id = COALESCE(google_id, ?), avatar_url = COALESCE(?, avatar_url), last_login_at = ? WHERE id = ?", (google_id, picture, now, user['id']))
            user_id = user['id']
            user_name = user['name']
            user_role = user['role']
            user_dept = user['department']
        else:
            cursor.execute('''
            INSERT INTO users (name, email, password, role, user_type, designation, status, organization_id, department, google_id, avatar_url, created_at, last_login_at)
            VALUES (?, ?, ?, 'User', 'Student', 'Student (Google Verified)', 'Active', 1, 'General Campus', ?, ?, ?, ?)
            ''', (name, email, generate_password_hash(uuid.uuid4().hex), google_id, picture, now, now))
            user_id = cursor.lastrowid
            user_name = name
            user_role = 'User'
            user_dept = 'General Campus'

            cursor.execute('''
            INSERT INTO user_settings (user_id, full_name, notify_forwarding, notify_seen, notify_resolution, notify_escalation, ai_threshold, sla_window, updated_at)
            VALUES (?, ?, 1, 1, 1, 1, 75, '24 Hours (Standard)', ?)
            ''', (user_id, name, now))

        conn.commit()
        conn.close()

        session['user_id'] = user_id
        session['user_name'] = user_name
        session['role'] = user_role
        session['department'] = user_dept

        return jsonify({
            'success': True,
            'message': f'Signed in as {user_name} via Google',
            'user': {
                'id': user_id,
                'name': user_name,
                'email': email,
                'role': user_role,
                'user_type': 'Student',
                'department': user_dept,
                'avatar_url': picture
            }
        })
    except Exception as e:
        return jsonify({'error': f'Google token verification error: {str(e)}'}), 400

@app.route('/api/auth/google/demo', methods=['POST'])
def api_google_demo():
    """Allows reliable demonstration of Google OAuth sign-in flow for campus demonstration when live credentials are not set."""
    data = request.json or {}
    email = (data.get('email') or 'kavin.campus@gmail.com').strip().lower()
    name = (data.get('name') or 'Kavin M (Google)').strip()
    avatar = data.get('picture') or ''

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    now = format_timestamp()

    if user:
        cursor.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (now, user['id']))
        user_id = user['id']
        user_name = user['name']
        user_role = user['role']
        user_dept = user['department']
    else:
        cursor.execute('''
        INSERT INTO users (name, email, password, role, user_type, designation, status, organization_id, department, google_id, avatar_url, created_at, last_login_at)
        VALUES (?, ?, ?, 'User', 'Student', 'Student (Google Verified)', 'Active', 1, 'Computer Science', 'google_demo_101', ?, ?, ?)
        ''', (name, email, generate_password_hash('google_demo_pass'), avatar, now, now))
        user_id = cursor.lastrowid
        user_name = name
        user_role = 'User'
        user_dept = 'Computer Science'

        cursor.execute('''
        INSERT INTO user_settings (user_id, full_name, notify_forwarding, notify_seen, notify_resolution, notify_escalation, ai_threshold, sla_window, updated_at)
        VALUES (?, ?, 1, 1, 1, 1, 75, '24 Hours (Standard)', ?)
        ''', (user_id, name, now))

    conn.commit()
    conn.close()

    session['user_id'] = user_id
    session['user_name'] = user_name
    session['role'] = user_role
    session['department'] = user_dept

    return jsonify({
        'success': True,
        'message': f'Signed in as {user_name} via Google Account',
        'user': {
            'id': user_id,
            'name': user_name,
            'email': email,
            'role': user_role,
            'user_type': 'Student',
            'department': user_dept,
            'avatar_url': avatar
        }
    })

# --- PHOTO EVIDENCE & FILE STORAGE ---

@app.route('/api/upload', methods=['POST'])
def api_upload_files():
    """Securely uploads photo evidence with MIME type, size, and extension validation."""
    if require_auth() is None:
        return jsonify({'error': 'Authentication required'}), 401

    uploaded_files = []

    # 1. Handle multipart form data files
    files_list = []
    if 'photos' in request.files:
        files_list.extend(request.files.getlist('photos'))
    if 'photo' in request.files:
        files_list.append(request.files.get('photo'))
    if 'file' in request.files:
        files_list.extend(request.files.getlist('file'))

    for file in files_list:
        if file and file.filename:
            orig_fn = secure_filename(file.filename)
            if not allowed_file(orig_fn):
                return jsonify({'error': f"File '{orig_fn}' is not an accepted image format. Allowed formats: PNG, JPG, JPEG, WEBP, GIF, HEIC."}), 400

            unique_prefix = uuid.uuid4().hex[:12]
            stored_fn = f"{unique_prefix}_{orig_fn}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], stored_fn)

            file.save(file_path)
            file_size = os.path.getsize(file_path)
            mime_type = mimetypes.guess_type(file_path)[0] or 'image/jpeg'

            uploaded_files.append({
                'stored_filename': stored_fn,
                'original_filename': orig_fn,
                'file_size': file_size,
                'mime_type': mime_type,
                'url': f"/uploads/{stored_fn}"
            })

    # 2. Also handle base64 image payload if JSON passed (e.g. from camera canvas)
    if not uploaded_files and request.is_json:
        data = request.json or {}
        base64_images = data.get('images') or ([data.get('image')] if data.get('image') else [])
        for idx, b64_str in enumerate(base64_images):
            if b64_str and ',' in b64_str:
                header, encoded = b64_str.split(',', 1)
                ext = 'png'
                if 'jpeg' in header or 'jpg' in header: ext = 'jpg'
                elif 'webp' in header: ext = 'webp'
                import base64
                raw_bytes = base64.b64decode(encoded)
                stored_fn = f"{uuid.uuid4().hex[:12]}_camera_photo_{idx+1}.{ext}"
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], stored_fn)
                with open(file_path, 'wb') as f:
                    f.write(raw_bytes)
                file_size = len(raw_bytes)
                uploaded_files.append({
                    'stored_filename': stored_fn,
                    'original_filename': f"camera_capture_{idx+1}.{ext}",
                    'file_size': file_size,
                    'mime_type': f"image/{ext}",
                    'url': f"/uploads/{stored_fn}"
                })

    if not uploaded_files:
        return jsonify({'error': 'No files were uploaded. Please choose or capture an image.'}), 400

    return jsonify({
        'success': True,
        'message': f'Successfully uploaded {len(uploaded_files)} file(s).',
        'files': uploaded_files
    })

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    """Serve evidence only to the complaint owner or an authorized assignee/admin."""
    curr_user = require_auth()
    if curr_user is None:
        return jsonify({'error': 'Authentication required'}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT c.user_id, c.department, c.assigned_person
        FROM complaint_attachments a
        JOIN complaints c ON c.id = a.complaint_id
        WHERE a.stored_filename = ?
    ''', (filename,))
    attachment = cursor.fetchone()
    conn.close()
    if not attachment:
        return jsonify({'error': 'Evidence not found'}), 404

    user_id = curr_user['id']
    role = curr_user['role']
    can_view = role == 'Organization Admin'
    if role == 'Department Admin':
        can_view = attachment['department'] == curr_user['department'] or attachment['assigned_person'] == curr_user['name']
    elif role == 'User':
        can_view = attachment['user_id'] == user_id or (
            (curr_user['user_type'] or '').strip().lower() in ASSIGNED_STAFF_TYPES
            and attachment['assigned_person'] == curr_user['name']
        )
    if not can_view:
        return jsonify({'error': 'You are not authorized to view this evidence.'}), 403

    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


# --- SETTINGS & PREFERENCES PERSISTENCE ---

@app.route('/api/settings', methods=['GET', 'POST'])
def api_settings():
    curr_user = require_auth()
    if curr_user is None:
        return jsonify({'error': 'Authentication required'}), 401

    session_user_id = curr_user['id']
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
    session_user = require_auth()
    if session_user is None:
        return jsonify({'error': 'Authentication required'}), 401

    conn = get_db()
    cursor = conn.cursor()

    session_user_id = session_user['id']
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

@app.route('/api/analytics', methods=['GET'])
def api_analytics():
    user = require_auth()
    if user is None:
        return jsonify({'error': 'Authentication required'}), 401
    if user['role'] != 'Organization Admin':
        return jsonify({'error': 'Institutional administrator access required.'}), 403

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS active,
               SUM(CASE WHEN status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS resolved,
               SUM(CASE WHEN user_verified = 1 THEN 1 ELSE 0 END) AS verified
        FROM complaints
    ''')
    complaint_counts = cursor.fetchone()
    resolved_count = complaint_counts['resolved'] or 0
    verified_count = complaint_counts['verified'] or 0
    verification_rate = round(verified_count * 100 / resolved_count, 1) if resolved_count else None

    cursor.execute('''
        SELECT AVG(resolution_time_hours)
        FROM resolutions
        WHERE success = 1 AND resolution_time_hours IS NOT NULL AND resolution_time_hours >= 0
    ''')
    avg_resolution_time = cursor.fetchone()[0]

    cursor.execute('''
        SELECT COUNT(*) FROM incidents
        WHERE LOWER(severity) = 'critical' AND LOWER(status) NOT IN ('resolved', 'closed')
    ''')
    open_critical_incidents = cursor.fetchone()[0]

    cursor.execute('''
        SELECT department, COUNT(*) AS total,
               SUM(CASE WHEN status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS active
        FROM complaints
        GROUP BY department
        ORDER BY total DESC, department ASC
    ''')
    department_workload = [
        {'department': row['department'], 'total': row['total'], 'active': row['active'] or 0}
        for row in cursor.fetchall()
    ]

    cursor.execute('''
        SELECT category, COUNT(*) AS total
        FROM complaints
        GROUP BY category
        ORDER BY total DESC, category ASC
    ''')
    category_counts = [{'category': row['category'], 'total': row['total']} for row in cursor.fetchall()]

    cursor.execute('''
        SELECT date(created_at) AS report_date, COUNT(*) AS total
        FROM complaints
        WHERE date(created_at) >= date('now', '-6 days')
        GROUP BY date(created_at)
        ORDER BY report_date ASC
    ''')
    daily_volume = [{'date': row['report_date'], 'total': row['total']} for row in cursor.fetchall()]
    conn.close()

    return jsonify({
        'totalComplaints': complaint_counts['total'] or 0,
        'activeComplaints': complaint_counts['active'] or 0,
        'resolvedComplaints': resolved_count,
        'verifiedComplaints': verified_count,
        'resolutionVerificationRate': f'{verification_rate}%' if verification_rate is not None else None,
        'avgResolutionTimeHours': round(avg_resolution_time, 1) if avg_resolution_time is not None else None,
        'openCriticalIncidents': open_critical_incidents,
        'departmentWorkload': department_workload,
        'categoryCounts': category_counts,
        'dailyVolume': daily_volume
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
    curr_user = require_auth()
    if curr_user is None:
        return jsonify({'error': 'Authentication required'}), 401

    session_user_id = curr_user['id']
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
    curr_user = require_auth()
    if curr_user is None:
        return jsonify({'error': 'Authentication required'}), 401

    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'POST':
        data = request.json or {}
        confirmed_issues = data.get('confirmedIssues')
        text = (data.get('complaintText') or data.get('description') or '').strip()
        attachments = data.get('attachments') or data.get('photos') or []
        user_cat = data.get('category')
        user_loc = data.get('location')
        user_prio = data.get('priority') or data.get('severity')

        session_user_id = curr_user['id']
        cursor.execute("SELECT id, name FROM users WHERE id = ?", (session_user_id,))
        u = cursor.fetchone()
        if not u:
            conn.close()
            return jsonify({'error': 'Authentication required'}), 401
        user_id = u['id']
        user_name = u['name']

        now = format_timestamp()
        current_year = datetime.datetime.now().year
        base_num = random.randint(1000, 9999)
        original_id = f"CMP-{current_year}-{base_num}"
        letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

        created_tickets = []

        def save_ticket_attachments(ticket_id, att_list):
            for att in att_list:
                if isinstance(att, dict):
                    s_fn = att.get('stored_filename') or att.get('storedFilename') or att.get('filename') or att.get('name')
                    o_fn = att.get('original_filename') or att.get('originalFilename') or s_fn or 'photo_evidence.jpg'
                    f_sz = att.get('file_size') or att.get('fileSize') or 0
                    m_tp = att.get('mime_type') or att.get('mimeType') or 'image/jpeg'
                else:
                    s_fn = str(att)
                    o_fn = s_fn
                    f_sz = 0
                    m_tp = 'image/jpeg'
                if s_fn:
                    f_path = os.path.join(app.config['UPLOAD_FOLDER'], s_fn)
                    cursor.execute('''
                    INSERT INTO complaint_attachments (complaint_id, original_filename, stored_filename, file_path, file_size, mime_type, uploaded_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (ticket_id, o_fn, s_fn, f_path, f_sz, m_tp, now))

            if att_list:
                cursor.execute('''
                INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
                VALUES (?, 'Evidence Attached', ?, ?, ?)
                ''', (ticket_id, f"Photographic evidence attached ({len(att_list)} photo(s))", user_name, now))

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

                prio_hours = 24
                if prio == 'Critical': prio_hours = 1
                elif prio == 'High': prio_hours = 6
                elif prio == 'Low': prio_hours = 48

                deadline_dt = datetime.datetime.now() + datetime.timedelta(hours=prio_hours)
                deadline_str = deadline_dt.strftime("%Y-%m-%d %H:%M:%S")

                cursor.execute("SELECT incident_id FROM incidents WHERE category = ? AND location = ? LIMIT 1", (cat, loc))
                inc_match = cursor.fetchone()
                linked_inc_id = inc_match['incident_id'] if inc_match else None

                has_ev = 1 if (attachments and len(attachments) > 0) else 0

                cursor.execute('''
                INSERT INTO complaints (
                    id, original_complaint_id, user_id, description, category, subcategory,
                    department, assigned_person, location, priority, status, seen,
                    assigned_at, acknowledgement_deadline, escalated, incident_id,
                    source, has_evidence, evidence_provenance, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'Multi-Issue Ticket', ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, 'Web', ?, 'User Submission', ?, ?)
                ''', (
                    ticket_id, original_id, user_id, desc, cat, dept, person,
                    loc, prio, status, now, deadline_str, linked_inc_id, has_ev, now, now
                ))

                save_ticket_attachments(ticket_id, attachments)

                cursor.execute('''
                INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
                VALUES (?, 'Submitted', 'Complaint registered via campus portal', ?, ?)
                ''', (ticket_id, user_name, now))

                cursor.execute('''
                INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
                VALUES (?, 'AI Categorized', ?, 'AI Engine', ?)
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
                    'incidentId': linked_inc_id,
                    'hasEvidence': bool(has_ev)
                })

        elif user_cat and text:
            # Guided submission flow with explicit category and location
            ticket_id = f"{original_id}"
            cat = user_cat
            loc = user_loc or detectLocation(text) or 'Campus'
            prio = user_prio or detectPriority(text) or 'Medium'
            route = routeComplaint(cat)
            dept = route['department']
            person = route['assigned_person']
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
            has_ev = 1 if (attachments and len(attachments) > 0) else 0

            cursor.execute('''
            INSERT INTO complaints (
                id, original_complaint_id, user_id, description, category, subcategory,
                department, assigned_person, location, priority, status, seen,
                assigned_at, acknowledgement_deadline, escalated, incident_id,
                source, has_evidence, evidence_provenance, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'Guided Ticket', ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, 'Web', ?, 'User Submission', ?, ?)
            ''', (
                ticket_id, original_id, user_id, text, cat, dept, person,
                loc, prio, status, now, deadline_str, linked_inc_id, has_ev, now, now
            ))

            save_ticket_attachments(ticket_id, attachments)

            cursor.execute('''
            INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
            VALUES (?, 'Submitted', 'Problem reported via guided submission form', ?, ?)
            ''', (ticket_id, user_name, now))

            cursor.execute('''
            INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
            VALUES (?, 'Forwarded', ?, 'Routing Engine', ?)
            ''', (ticket_id, f"Routed to {dept} ({person}) | SLA: {prio_hours}h", now))

            created_tickets.append({
                'complaintId': ticket_id,
                'originalId': original_id,
                'complaintText': text,
                'category': cat,
                'location': loc,
                'severity': prio,
                'department': dept,
                'assignedPerson': person,
                'status': status,
                'acknowledgementDeadline': deadline_str,
                'incidentId': linked_inc_id,
                'hasEvidence': bool(has_ev)
            })

        else:
            if not text:
                conn.close()
                return jsonify({'error': 'Description is required'}), 400

            try:
                analysis = analyzeMultiIssues(text)
                issues_list = analysis['issues']
            except Exception:
                issues_list = [{
                    'description': text,
                    'category': categorizeComplaint(text),
                    'location': detectLocation(text) or 'Campus',
                    'severity': detectPriority(text) or 'Medium',
                    'department': 'General Administration',
                    'assigned_person': 'Campus Administrator'
                }]

            num_issues = len(issues_list)
            for i, issue in enumerate(issues_list):
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
                has_ev = 1 if (attachments and len(attachments) > 0) else 0

                cursor.execute('''
                INSERT INTO complaints (
                    id, original_complaint_id, user_id, description, category, subcategory,
                    department, assigned_person, location, priority, status, seen,
                    assigned_at, acknowledgement_deadline, escalated, incident_id,
                    source, has_evidence, evidence_provenance, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'Ticket', ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, 'Web', ?, 'User Submission', ?, ?)
                ''', (
                    ticket_id, original_id, user_id, desc, cat, dept, person,
                    loc, prio, status, now, deadline_str, linked_inc_id, has_ev, now, now
                ))

                save_ticket_attachments(ticket_id, attachments)

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
                    'incidentId': linked_inc_id,
                    'hasEvidence': bool(has_ev)
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
    session_user_id = curr_user['id']
    cursor.execute("SELECT role, user_type, department, name FROM users WHERE id = ?", (session_user_id,))
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
    elif role == 'User' and (u['user_type'] or '').strip().lower() in ASSIGNED_STAFF_TYPES:
        query_parts.append("(c.user_id = ? OR c.assigned_person = ?)")
        params.extend([session_user_id, user_name])
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

    complaints_list = []
    for r in rows:
        # Check for first attachment thumbnail
        cursor.execute("SELECT stored_filename FROM complaint_attachments WHERE complaint_id = ? LIMIT 1", (r['id'],))
        att_row = cursor.fetchone()
        thumb_url = f"/uploads/{att_row['stored_filename']}" if att_row else None

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
            'userName': r['user_name'],
            'userVerified': r['status'] == 'Closed',
            'hasEvidence': bool(r['has_evidence'] or thumb_url),
            'evidenceThumbnail': thumb_url,
            'createdAt': r['created_at'],
            'incidentId': r['incident_id'] or r['original_complaint_id'],
            'evidenceProvenance': r['evidence_provenance'] or 'User Submission'
        })

    conn.close()
    return jsonify(complaints_list)

@app.route('/api/complaints/<complaint_id>', methods=['GET'])
def api_get_complaint_detail(complaint_id):
    curr_user = require_auth()
    if curr_user is None:
        return jsonify({'error': 'Authentication required'}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.*, u.name as user_name, u.email as user_email, u.user_type, u.role as user_role, u.department as user_dept
        FROM complaints c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
    """, (complaint_id,))
    r = cursor.fetchone()

    if not r:
        conn.close()
        return jsonify({'error': 'Complaint not found'}), 404

    curr_role = curr_user['role']
    session_user_id = curr_user['id']

    can_view_assigned = (curr_user['user_type'] or '').strip().lower() in ASSIGNED_STAFF_TYPES
    if curr_role == 'User' and r['user_id'] != session_user_id and not (can_view_assigned and r['assigned_person'] == curr_user['name']):
        conn.close()
        return jsonify({'error': 'You are not authorized to view this complaint.'}), 403
    if curr_role == 'Department Admin' and r['department'] != curr_user['department'] and r['assigned_person'] != curr_user['name']:
        conn.close()
        return jsonify({'error': 'You are not authorized to view complaints outside your department scope.'}), 403

    now = format_timestamp()

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

    # Fetch attached photographic evidence
    cursor.execute("SELECT * FROM complaint_attachments WHERE complaint_id = ? ORDER BY id ASC", (complaint_id,))
    att_rows = cursor.fetchall()
    conn.close()

    attachments = []
    for a in att_rows:
        attachments.append({
            'id': a['id'],
            'originalFilename': a['original_filename'],
            'storedFilename': a['stored_filename'],
            'url': f"/uploads/{a['stored_filename']}",
            'fileSize': a['file_size'],
            'mimeType': a['mime_type'],
            'uploadedAt': a['uploaded_at']
        })

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
        'userName': r['user_name'],
        'userEmail': r['user_email'] if r['user_id'] == session_user_id or curr_role in ('Department Admin', 'Organization Admin') else None,
        'userType': r['user_type'],
        'resolutionNote': r['resolution_note'],
        'escalated': bool(r['escalated']),
        'escalationLevel': r['escalation_level'],
        'escalationReason': r['escalation_reason'],
        'incidentId': r['incident_id'] or r['original_complaint_id'],
        'evidenceProvenance': r['evidence_provenance'] or 'User Submission',
        'hasEvidence': bool(r['has_evidence'] or len(attachments) > 0),
        'attachments': attachments,
        'timeline': timeline
    })


# --- COMPLAINT ACKNOWLEDGEMENT & ESCALATION DAEMON ---

@app.route('/api/complaints/<complaint_id>/acknowledge', methods=['POST'])
def api_acknowledge_complaint(complaint_id):
    curr_user = require_auth()
    if curr_user is None:
        return jsonify({'error': 'Authentication required'}), 401
    session_user_id = curr_user['id']
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT role, user_type, name, department FROM users WHERE id = ?", (session_user_id,))
    u = cursor.fetchone()
    worker_type = u['user_type'] if u else ''
    is_assigned_worker = (worker_type or '').strip().lower() in OPERATIONAL_STAFF_TYPES
    if not u or (u['role'] not in ['Department Admin', 'Organization Admin'] and not is_assigned_worker):
        conn.close()
        return jsonify({'error': 'You do not have permission to acknowledge assigned work.'}), 403

    now = format_timestamp()
    admin_name = u['name']

    cursor.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,))
    c = cursor.fetchone()
    if not c:
        conn.close()
        return jsonify({'error': 'Complaint not found'}), 404

    if is_assigned_worker and c['assigned_person'] != u['name']:
        conn.close()
        return jsonify({'error': 'You can only acknowledge complaints assigned to you.'}), 403
    if u['role'] == 'Department Admin' and c['department'] != u['department'] and c['assigned_person'] != u['name']:
        conn.close()
        return jsonify({'error': 'You can only acknowledge complaints within your department.'}), 403

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

@app.route('/api/complaints/<complaint_id>/update-status', methods=['POST'])
def api_update_complaint_status(complaint_id):
    curr_user = require_auth()
    if curr_user is None:
        return jsonify({'error': 'Authentication required'}), 401
    session_user_id = curr_user['id']
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT role, user_type, name, department FROM users WHERE id = ?", (session_user_id,))
    u = cursor.fetchone()
    worker_type = u['user_type'] if u else ''
    is_assigned_worker = (worker_type or '').strip().lower() in OPERATIONAL_STAFF_TYPES
    if not u or (u['role'] not in ['Department Admin', 'Organization Admin'] and not is_assigned_worker):
        conn.close()
        return jsonify({'error': 'You do not have permission to update complaint status.'}), 403

    cursor.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,))
    c = cursor.fetchone()
    if not c:
        conn.close()
        return jsonify({'error': 'Complaint not found'}), 404

    # Enforce role boundaries: Department Admin can only update complaints within their department
    if u['role'] == 'Department Admin' and c['department'] != u['department'] and c['assigned_person'] != u['name']:
        conn.close()
        return jsonify({'error': f"You only have permission to update tickets for '{u['department']}', not '{c['department']}'."}), 403

    if is_assigned_worker and c['assigned_person'] != u['name']:
        conn.close()
        return jsonify({'error': 'You can only update complaints assigned to you.'}), 403

    data = request.json or {}
    new_status = data.get('status', 'In Progress')
    note = (data.get('note') or data.get('resolutionNote') or '').strip()
    allowed_statuses = {'In Progress', 'Resolved'} if is_assigned_worker else {'Forwarded', 'In Progress', 'Resolved', 'Closed'}
    if new_status not in allowed_statuses:
        conn.close()
        return jsonify({'error': 'That status transition is not permitted.'}), 400
    if new_status == 'Resolved' and not note:
        conn.close()
        return jsonify({'error': 'Add a brief resolution note before marking work completed.'}), 400
    now = format_timestamp()
    admin_name = u['name']

    resolution_note = note if new_status == 'Resolved' else (c['resolution_note'] or (note if note else None))

    cursor.execute('''
    UPDATE complaints
    SET status = ?, resolution_note = ?, updated_at = ?,
        seen = 1, seen_at = COALESCE(seen_at, ?), seen_by = COALESCE(seen_by, ?)
    WHERE id = ?
    ''', (new_status, resolution_note, now, now, admin_name, complaint_id))

    timeline_desc = note if note else f"Status updated to '{new_status}' by {admin_name}"
    cursor.execute('''
    INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
    VALUES (?, ?, ?, ?, ?)
    ''', (complaint_id, new_status, timeline_desc, admin_name, now))

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Ticket {complaint_id} status updated to '{new_status}'.",
        'status': new_status,
        'updatedAt': now
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
    user = require_auth()
    if user is None:
        return jsonify({'error': 'Authentication required'}), 401

    data = request.json or {}
    complaint_id = data.get('complaintId')
    status = data.get('verificationStatus', 'Yes') # 'Yes', 'No', 'Partial'
    feedback = data.get('feedbackText', '')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT user_id FROM complaints WHERE id = ?', (complaint_id,))
    complaint = cursor.fetchone()
    if not complaint:
        conn.close()
        return jsonify({'error': 'Complaint not found.'}), 404
    if complaint['user_id'] != user['id']:
        conn.close()
        return jsonify({'error': 'Only the complaint submitter can verify its resolution.'}), 403

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
    user = require_auth()
    if user is None:
        return jsonify({'error': 'Authentication required'}), 401
    if user['role'] not in ('Department Admin', 'Organization Admin'):
        return jsonify({'error': 'Administrator access required.'}), 403

    conn = get_db()
    cursor = conn.cursor()
    if user['role'] == 'Organization Admin':
        cursor.execute("SELECT * FROM prevention_recommendations ORDER BY recommendation_id ASC")
    else:
        cursor.execute("SELECT * FROM prevention_recommendations WHERE responsible_department = ? ORDER BY recommendation_id ASC", (user['department'] or '',))
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
    user = require_auth()
    if user is None:
        return jsonify({'error': 'Authentication required'}), 401
    if user['role'] not in ('Department Admin', 'Organization Admin'):
        return jsonify({'error': 'Administrator access required.'}), 403

    data = request.json or {}
    new_status = data.get('status', 'Approved') # 'Approved', 'Under Review', 'Rejected', 'Completed'
    decision_note = data.get('decisionNote', '')
    if new_status not in ('Approved', 'Under Review', 'Rejected', 'Completed'):
        return jsonify({'error': 'Invalid recommendation status.'}), 400
    reviewer = user['name']
    now = format_timestamp()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT responsible_department FROM prevention_recommendations WHERE recommendation_id = ?", (rec_id,))
    recommendation = cursor.fetchone()
    if not recommendation:
        conn.close()
        return jsonify({'error': 'Recommendation not found.'}), 404
    if user['role'] == 'Department Admin' and recommendation['responsible_department'] != user['department']:
        conn.close()
        return jsonify({'error': 'You can only manage recommendations for your department.'}), 403

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
    curr_user = require_auth()
    if curr_user is None:
        return jsonify({'error': 'Authentication required'}), 401

    data = request.json or {}
    query = data.get('query', '').strip().lower()

    session_user_id = curr_user['id']
    conn = get_db()
    cursor = conn.cursor()

    role = curr_user['role']
    user_dept = curr_user['department'] or ''
    user_name = curr_user['name']

    resp = ""
    suggested_actions = []

    # 0. Empty or whitespace query
    if not query:
        conn.close()
        return jsonify({
            'response': f"Hello {user_name or 'there'}! I am your **PROBLEMINT Campus Intelligence Assistant**. How can I help you today? You can ask me to track your complaints, find out which department handles an issue, or check campus maintenance updates.",
            'answer': f"Hello {user_name or 'there'}! I am your **PROBLEMINT Campus Intelligence Assistant**. How can I help you today? You can ask me to track your complaints, find out which department handles an issue, or check campus maintenance updates.",
            'suggestedActions': [
                {'label': 'Report a Problem', 'link': '#submit-problem'},
                {'label': 'Track My Complaints', 'link': '#my-complaints'}
            ]
        })

    # 1. Greetings & Introductions
    if query in ['hi', 'hello', 'hey', 'greetings', 'who are you', 'what can you do', 'help', 'good morning', 'good afternoon', 'good evening']:
        resp = (f"Hello **{user_name or 'there'}**! I am your **PROBLEMINT Campus Intelligence Assistant**.\n\n"
                f"I can help you:\n"
                f"- **Report a campus issue** with automatic department routing\n"
                f"- **Track your submitted complaints** and check expected response times\n"
                f"- **Find out who handles what** (e.g. Wi-Fi, electricity, plumbing, hostel food)\n"
                f"- **Explain next steps** and how resolution verification works\n\n"
                f"What would you like assistance with?")
        suggested_actions.append({'label': 'Report a Problem', 'link': '#submit-problem'})
        suggested_actions.append({'label': 'Track My Complaints', 'link': '#my-complaints'})

    # 2. How to report / Guided workflow help
    elif any(k in query for k in ['how to report', 'help me report', 'how do i report', 'submit a complaint', 'report a problem', 'submit ticket', 'file a complaint']):
        resp = ("Reporting a problem is quick and straightforward:\n\n"
                "1. **Open the form**: Click **'Report a Problem'** in the navigation bar.\n"
                "2. **Select Category**: Tap the closest category (Wi-Fi, Water, Electricity, Restroom, etc.) or choose *Not sure* for AI auto-detection.\n"
                "3. **Choose Location**: Select your campus building (Block A, B, C, Hostel, Library) and specify room/floor.\n"
                "4. **Attach Photo**: Tap **Take Photo** or upload pictures from your device.\n"
                "5. **Submit**: Our routing engine immediately assigns your ticket to the authorized department with an SLA target.")
        suggested_actions.append({'label': 'Open Report Form', 'link': '#submit-problem'})
        suggested_actions.append({'label': 'View My Complaints', 'link': '#my-complaints'})

    # 3. Who handles what? / Department lookup
    elif any(k in query for k in ['who handles', 'which department handles', 'who is in charge of', 'who fixes', 'who takes care of', 'responsible for']):
        cat_map = {
            'wifi': ('Internet/Wi-Fi', 'Network Administration', 'Network Admin'),
            'wi-fi': ('Internet/Wi-Fi', 'Network Administration', 'Network Admin'),
            'internet': ('Internet/Wi-Fi', 'Network Administration', 'Network Admin'),
            'network': ('Internet/Wi-Fi', 'Network Administration', 'Network Admin'),
            'water': ('Water Supply', 'Water & Maintenance Dept', 'Maintenance Admin'),
            'plumb': ('Water Supply', 'Water & Maintenance Dept', 'Maintenance Admin'),
            'leak': ('Water Supply', 'Water & Maintenance Dept', 'Maintenance Admin'),
            'electric': ('Electricity', 'Electrical Maintenance', 'Chief Electrician'),
            'power': ('Electricity', 'Electrical Maintenance', 'Chief Electrician'),
            'light': ('Electricity', 'Electrical Maintenance', 'Chief Electrician'),
            'fan': ('Electricity', 'Electrical Maintenance', 'Chief Electrician'),
            'lift': ('Lift/Elevator', 'Lift Maintenance Dept', 'Lift Maintenance Officer'),
            'elevator': ('Lift/Elevator', 'Lift Maintenance Dept', 'Lift Maintenance Officer'),
            'food': ('Hostel Food/Mess', 'Mess / Food Administration', 'Mess Manager'),
            'mess': ('Hostel Food/Mess', 'Mess / Food Administration', 'Mess Manager'),
            'hostel': ('Hostel Food/Mess', 'Mess / Food Administration', 'Mess Manager'),
            'clean': ('Sanitization/Cleanliness', 'Housekeeping Dept', 'Housekeeping Supervisor'),
            'garbage': ('Sanitization/Cleanliness', 'Housekeeping Dept', 'Housekeeping Supervisor'),
            'restroom': ('Restrooms', 'Housekeeping Dept', 'Housekeeping Supervisor'),
            'washroom': ('Restrooms', 'Housekeeping Dept', 'Housekeeping Supervisor'),
            'toilet': ('Restrooms', 'Housekeeping Dept', 'Housekeeping Supervisor'),
            'security': ('Security', 'Security & Parking', 'Security Officer'),
            'parking': ('Security', 'Security & Parking', 'Security Officer'),
            'classroom': ('Classroom Facilities', 'Academic Infrastructure', 'Facility Coordinator'),
            'projector': ('Classroom Facilities', 'Academic Infrastructure', 'Facility Coordinator'),
            'lab': ('Laboratory', 'Lab Administration', 'Lab Administrator')
        }
        matched = None
        for key, val in cat_map.items():
            if key in query:
                matched = val
                break
        if matched:
            resp = f"**{matched[0]}** issues on campus are handled directly by the **{matched[1]}**, assigned to **{matched[2]}**."
            suggested_actions.append({'label': f"Report {matched[0]} Issue", 'link': '#submit-problem'})
        else:
            resp = ("Campus issues are routed to specialized teams:\n"
                    "- **Network Administration**: Wi-Fi, Internet, LAN\n"
                    "- **Water & Maintenance**: Plumbing, water coolers, taps\n"
                    "- **Electrical Maintenance**: Power supply, lights, fans\n"
                    "- **Housekeeping**: Sanitization, restrooms, dustbins\n"
                    "- **Lift Maintenance**: Elevators and passenger lifts\n"
                    "- **Mess / Food Admin**: Dining halls, mess food\n"
                    "- **Security**: Campus gates, vehicle parking")
            suggested_actions.append({'label': 'Report a Problem', 'link': '#submit-problem'})
    # 4. Department workload
    elif any(k in query for k in ['most unresolved', 'department workload', 'which department', 'department has the most', 'most complaints']):
        scope_sql, scope_params = complaint_scope_for_user(curr_user)
        cursor.execute(f"SELECT c.department, COUNT(*) as total, SUM(CASE WHEN c.status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) as active FROM complaints c WHERE {scope_sql} GROUP BY c.department ORDER BY active DESC", scope_params)
        depts = cursor.fetchall()
        top = depts[0] if depts else None
        if top:
            scope_label = 'the institution' if role == 'Organization Admin' else 'your authorized scope'
            resp = f"Within {scope_label}, **{top['department']}** has the highest workload with **{top['active']} unresolved complaints** out of {top['total']} total reported."
            suggested_actions.append({'label': 'View Complaints', 'link': '#my-complaints'})
        else:
            resp = "No department complaints are currently logged."

    # 2. Pending / Unresolved complaints
    elif any(k in query for k in ['pending', 'unresolved', 'active complaints', 'how many complaints']):
        scope_sql, scope_params = complaint_scope_for_user(curr_user)
        cursor.execute(f"SELECT COUNT(*) as cnt FROM complaints c WHERE {scope_sql} AND c.status NOT IN ('Resolved', 'Closed')", scope_params)
        cnt = cursor.fetchone()['cnt']
        if role == 'Organization Admin':
            cursor.execute(f"SELECT c.department, COUNT(*) as cnt FROM complaints c WHERE {scope_sql} AND c.status NOT IN ('Resolved', 'Closed') GROUP BY c.department ORDER BY cnt DESC LIMIT 3", scope_params)
            breakdown = cursor.fetchall()
            b_str = ', '.join([f"**{b['department']}** ({b['cnt']})" for b in breakdown]) or 'no active department queues'
            resp = f"Across the institution, there are **{cnt} active complaints**. Top department queues: {b_str}."
            suggested_actions.append({'label': 'View All Complaints', 'link': '#my-complaints'})
        elif role == 'Department Admin':
            resp = f"There are currently **{cnt} unresolved complaints** in your authorized departmental scope."
            suggested_actions.append({'label': 'View Department Queue', 'link': '#my-complaints'})
        else:
            resp = f"You have **{cnt} active complaint(s)** submitted by you or assigned to you."
            suggested_actions.append({'label': 'Track My Complaints', 'link': '#my-complaints'})

    # 3. Specific complaint query (CMP...)
    elif 'cmp' in query:
        words = query.replace('?', '').replace('.', '').split()
        target_cmp = next((w.upper() for w in words if 'CMP' in w.upper()), None)
        if target_cmp:
            cursor.execute("SELECT c.*, u.name as user_name FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.id LIKE ? OR c.original_complaint_id LIKE ?", (f"%{target_cmp}%", f"%{target_cmp}%"))
            c_row = cursor.fetchone()
            if c_row:
                # Ticket details stay within the same owner/assignee/department scope as the complaint API.
                can_access = c_row['user_id'] == session_user_id
                if role == 'Organization Admin':
                    can_access = True
                elif role == 'Department Admin':
                    can_access = c_row['department'] == user_dept or c_row['assigned_person'] == user_name
                elif role == 'User' and (curr_user['user_type'] or '').strip().lower() in ASSIGNED_STAFF_TYPES:
                    can_access = can_access or c_row['assigned_person'] == user_name
                if not can_access:
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
        scope_sql, scope_params = complaint_scope_for_user(curr_user)
        cursor.execute(f"SELECT COUNT(*) as cnt FROM complaints c WHERE {scope_sql} AND c.category LIKE ?", [*scope_params, f"%{topic}%"])
        c_cnt = cursor.fetchone()['cnt']
        cursor.execute(f"""
            SELECT i.incident_id, i.title, i.location, i.severity, i.root_cause_confidence, i.possible_root_cause
            FROM incidents i
            WHERE i.category LIKE ? AND EXISTS (
                SELECT 1 FROM complaints c WHERE c.incident_id = i.incident_id AND {scope_sql}
            ) LIMIT 1
        """, [f"%{topic}%", *scope_params])
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
        scope_sql, scope_params = complaint_scope_for_user(curr_user)
        cursor.execute(f"""
            SELECT i.incident_id, i.title, i.location, i.first_reported_at, i.complaint_count
            FROM incidents i
            WHERE i.status != 'Resolved' AND EXISTS (
                SELECT 1 FROM complaints c WHERE c.incident_id = i.incident_id AND {scope_sql}
            ) ORDER BY i.first_reported_at ASC LIMIT 2
        """, scope_params)
        oldest = cursor.fetchall()
        if oldest:
            lines = [f"- **{o['incident_id']}** ({o['title']}): Reported on {o['first_reported_at']} ({o['complaint_count']} linked reports)" for o in oldest]
            resp = "The longest standing unresolved incidents are:\n" + "\n".join(lines)
            suggested_actions.append({'label': 'Open Incidents Board', 'link': '#incidents'})
        else:
            resp = "All campus incidents have been resolved."

    # 6. Prevention & recommendations
    elif any(k in query for k in ['recommendation', 'prevent', 'prevention', 'suggested action']):
        if role == 'Organization Admin':
            cursor.execute("SELECT recommendation_id, problem, recommendation, responsible_department, priority FROM prevention_recommendations WHERE status = 'Approved' LIMIT 2")
            recs = cursor.fetchall()
        elif role == 'Department Admin':
            cursor.execute("SELECT recommendation_id, problem, recommendation, responsible_department, priority FROM prevention_recommendations WHERE status = 'Approved' AND responsible_department = ? LIMIT 2", (user_dept,))
            recs = cursor.fetchall()
        else:
            recs = []
        if recs:
            lines = [f"- **{r['recommendation_id']}** ({r['responsible_department']}): {r['recommendation']} *(Problem: {r['problem']})*" for r in recs]
            resp = "Key active prevention recommendations:\n" + "\n".join(lines)
            suggested_actions.append({'label': 'View Prevention Center', 'link': '#prevention-center'})
            suggested_actions.append({'label': 'AI Assistant', 'link': '#ai-assistant'})
        else:
            resp = "No prevention recommendations are available in your authorized scope yet."

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
        scope_sql, scope_params = complaint_scope_for_user(curr_user)
        cursor.execute('''
            SELECT c.id, c.category, c.location, c.priority, c.department, c.assigned_person, c.acknowledgement_deadline
            FROM complaints c
            WHERE ({}) AND (c.priority = 'Critical' OR c.escalated = 1 OR (c.acknowledged_at IS NULL AND c.status NOT IN ('Resolved', 'Closed')))
            ORDER BY c.priority DESC, c.created_at ASC LIMIT 4
        '''.format(scope_sql), scope_params)
        urgent = cursor.fetchall()
        if urgent:
            lines = [f"- **{u_item['id']}** ({u_item['category']}): {u_item['location']} [Dept: {u_item['department']} | Priority: {u_item['priority']}]" for u_item in urgent]
            resp = "⚠️ **Urgent Operational Attention / SLA Telemetry**:\n" + "\n".join(lines)
            suggested_actions.append({'label': 'Inspect Overdue & Escalations', 'link': '#my-complaints'})
        else:
            resp = "Good news: No tickets are currently escalated or flagged as Critical priority."

    # 9. Self-Service & Prevention Impact
    elif any(k in query for k in ['self-service', 'self service', 'saved', 'prevented', 'self help']):
        if role == 'Organization Admin':
            cursor.execute("SELECT COUNT(*) as total FROM self_service_resolutions")
        else:
            cursor.execute("SELECT COUNT(*) as total FROM self_service_resolutions WHERE user_id = ?", (session_user_id,))
        total_ss = cursor.fetchone()['total']
        if role == 'Organization Admin':
            cursor.execute("SELECT problem_type, COUNT(*) as cnt FROM self_service_resolutions GROUP BY problem_type ORDER BY cnt DESC LIMIT 3")
        else:
            cursor.execute("SELECT problem_type, COUNT(*) as cnt FROM self_service_resolutions WHERE user_id = ? GROUP BY problem_type ORDER BY cnt DESC LIMIT 3", (session_user_id,))
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
        scope_sql, scope_params = complaint_scope_for_user(curr_user)
        cursor.execute(f"SELECT COUNT(*) as total FROM complaints c WHERE {scope_sql}", scope_params)
        total = cursor.fetchone()['total']
        cursor.execute(f"SELECT COUNT(*) as active FROM complaints c WHERE {scope_sql} AND c.status NOT IN ('Resolved', 'Closed')", scope_params)
        active = cursor.fetchone()['active']
        cursor.execute(f"SELECT COUNT(DISTINCT c.incident_id) as inc_cnt FROM complaints c WHERE {scope_sql} AND c.incident_id IS NOT NULL", scope_params)
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
    curr_user = require_auth()
    if curr_user is None:
        return jsonify({'error': 'Authentication required'}), 401

    conn = get_db()
    ensure_notification_reads(conn)
    cursor = conn.cursor()

    role = curr_user['role']
    user_dept = curr_user['department'] or ''
    user_id = curr_user['id']

    if role == 'Organization Admin':
        scope_sql = ''
        scope_params = []
    elif role == 'Department Admin':
        scope_sql = 'WHERE c.department = ? OR c.assigned_person = ?'
        scope_params = [user_dept, curr_user['name']]
    elif (curr_user['user_type'] or '').strip().lower() in ASSIGNED_STAFF_TYPES:
        scope_sql = 'WHERE c.user_id = ? OR c.assigned_person = ?'
        scope_params = [user_id, curr_user['name']]
    else:
        scope_sql = 'WHERE c.user_id = ?'
        scope_params = [user_id]

    cursor.execute(f'''
        SELECT ct.id, ct.complaint_id, ct.status, ct.description, ct.timestamp,
               c.location, nr.timeline_id AS read_timeline_id
        FROM complaint_timeline ct
        JOIN complaints c ON ct.complaint_id = c.id
        LEFT JOIN notification_reads nr
          ON nr.timeline_id = ct.id AND nr.user_id = ?
        {scope_sql}
        ORDER BY ct.id DESC LIMIT 10
    ''', [user_id, *scope_params])

    rows = cursor.fetchall()
    conn.close()

    notifs = []
    for r in rows:
        notifs.append({
            'id': r['id'],
            'complaintId': r['complaint_id'],
            'title': f"{r['complaint_id']} — {r['status']}",
            'message': f"{r['description']} ({r['location']})" if r['location'] else r['description'],
            'timestamp': r['timestamp'],
            'link': '#my-complaints',
            'unread': r['read_timeline_id'] is None
        })

    return jsonify(notifs)

@app.route('/api/notifications/read', methods=['POST'])
def api_mark_notifications_read():
    curr_user = require_auth()
    if curr_user is None:
        return jsonify({'error': 'Authentication required'}), 401

    data = request.json or {}
    timeline_ids = data.get('ids')
    if timeline_ids is not None and (not isinstance(timeline_ids, list) or any(not isinstance(item, int) for item in timeline_ids)):
        return jsonify({'error': 'Notification ids must be a list of integers.'}), 400

    role = curr_user['role']
    user_id = curr_user['id']
    conn = get_db()
    ensure_notification_reads(conn)
    cursor = conn.cursor()

    scope_sql = ''
    scope_params = []
    if role == 'Department Admin':
        scope_sql = 'AND (c.department = ? OR c.assigned_person = ?)'
        scope_params = [curr_user['department'] or '', curr_user['name']]
    elif role != 'Organization Admin':
        if (curr_user['user_type'] or '').strip().lower() in ASSIGNED_STAFF_TYPES:
            scope_sql = 'AND (c.user_id = ? OR c.assigned_person = ?)'
            scope_params = [user_id, curr_user['name']]
        else:
            scope_sql = 'AND c.user_id = ?'
            scope_params = [user_id]

    id_sql = ''
    if timeline_ids:
        id_sql = f"AND ct.id IN ({','.join('?' for _ in timeline_ids)})"
    elif timeline_ids == []:
        conn.close()
        return jsonify({'success': True, 'updated': 0})

    cursor.execute(f'''
        SELECT ct.id
        FROM complaint_timeline ct
        JOIN complaints c ON ct.complaint_id = c.id
        WHERE 1 = 1 {scope_sql} {id_sql}
    ''', [*scope_params, *(timeline_ids or [])])
    visible_ids = [row['id'] for row in cursor.fetchall()]
    now = format_timestamp()
    cursor.executemany('''
        INSERT OR IGNORE INTO notification_reads (user_id, timeline_id, read_at)
        VALUES (?, ?, ?)
    ''', [(user_id, timeline_id, now) for timeline_id in visible_ids])
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'updated': len(visible_ids)})

if __name__ == '__main__':
    init_db()
    print("Starting PROBLEMINT Platform Server on http://127.0.0.1:5000 ...")
    app.run(debug=True, port=5000)
