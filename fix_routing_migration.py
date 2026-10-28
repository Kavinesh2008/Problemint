"""
Migration: Fix routing inconsistencies in live databases.
Run once: python fix_routing_migration.py
"""
import sqlite3
import os
import json

BASE = os.path.dirname(__file__)
CONFIG_PATH = os.path.join(BASE, 'config.json')

with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
    config = json.load(f)

routing_rules = config.get('routing_rules', {})

# Build set of valid (dept, person) from config (already fixed to real values)
valid_routes = {(r['department'], r['assigned_person']) for r in routing_rules.values()}
valid_depts = {r['department'] for r in routing_rules.values()}

for db_name in ['database_demo.db', 'database.db']:
    db_path = os.path.join(BASE, db_name)
    if not os.path.exists(db_path):
        print(f'  Skipping {db_name} (not found)')
        continue

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # 1. Fix Housekeeping Supervisor role
    c.execute("""
        UPDATE users
        SET role = 'Department Admin', user_type = 'Department admin'
        WHERE email = 'housekeeping@college.edu'
          AND (role != 'Department Admin' OR user_type != 'Department admin')
    """)
    print(f'  [{db_name}] Housekeeping Supervisor role fix: {c.rowcount} row(s) updated')

    # 2. Re-route complaints that were assigned to non-existent departments
    #    Fetch all departments that actually exist in the DB
    c.execute("SELECT name FROM departments")
    real_depts = {r['name'] for r in c.fetchall()}

    c.execute("""
        SELECT id, category, department, assigned_person
        FROM complaints
        WHERE department NOT IN ({})
          AND status NOT IN ('Resolved', 'Closed')
    """.format(','.join('?' * len(real_depts))), list(real_depts))
    bad_complaints = c.fetchall()

    rerouted = 0
    pending = 0
    for row in bad_complaints:
        cat = row['category']
        rule = routing_rules.get(cat)
        if rule:
            new_dept   = rule['department']
            new_person = rule['assigned_person']
            reason = f"Re-routed from invalid department '{row['department']}' to {new_dept} ({new_person})"
        else:
            new_dept   = 'Pending Assignment'
            new_person = 'Pending Assignment'
            reason = f"No valid department for category '{cat}'. Awaiting admin assignment."
            pending += 1

        c.execute("""
            UPDATE complaints
            SET department = ?, assigned_person = ?, updated_at = datetime('now')
            WHERE id = ?
        """, (new_dept, new_person, row['id']))

        c.execute("""
            INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)
            VALUES (?, 'Reassigned', ?, 'System Migration', datetime('now'))
        """, (row['id'], reason))
        rerouted += 1

    print(f'  [{db_name}] Re-routed {rerouted} complaint(s) ({pending} marked Pending Assignment)')

    conn.commit()
    conn.close()

print('\nMigration complete.')
