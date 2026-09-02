import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL DEFAULT 'password123',
        role TEXT NOT NULL,
        organization_id INTEGER,
        department TEXT,
        FOREIGN KEY (organization_id) REFERENCES organizations (id)
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        organization_id INTEGER,
        head_person TEXT,
        FOREIGN KEY (organization_id) REFERENCES organizations (id)
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS complaints (
        id TEXT PRIMARY KEY,
        original_complaint_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        department TEXT NOT NULL,
        assigned_person TEXT NOT NULL,
        location TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        seen INTEGER DEFAULT 0,
        seen_at TEXT,
        seen_by TEXT,
        resolution_note TEXT,
        escalated INTEGER DEFAULT 0,
        escalation_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS complaint_timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id TEXT NOT NULL,
        status TEXT NOT NULL,
        description TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (complaint_id) REFERENCES complaints (id)
    );
    ''')

    conn.commit()
    conn.close()
