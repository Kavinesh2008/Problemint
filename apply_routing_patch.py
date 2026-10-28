"""
Applies routing fixes to app.py using exact binary string replacement.
Run: py apply_routing_patch.py
"""

with open('app.py', 'rb') as f:
    src = f.read()

original_len = len(src)
changes = 0

def replace_once(data, old, new, label):
    global changes
    if old not in data:
        print(f"  MISS: {label}")
        return data
    result = data.replace(old, new, 1)
    changes += 1
    print(f"  OK:   {label}")
    return result

# ── PATCH 1: confirmed_issues path – status ──────────────────────────────────
src = replace_once(
    src,
    b"person = issue.get('assignedPerson') or route['assigned_person']\r\n                status = \"Forwarded\"",
    b"person = issue.get('assignedPerson') or route['assigned_person']\r\n                status = \"Pending Assignment\" if route.get('pending') else \"Forwarded\"",
    "confirmed_issues: status"
)

# ── PATCH 2: confirmed_issues path – Forwarded timeline insert ───────────────
# Find the exact bytes: the Forwarded timeline insert followed by created_tickets.append
old2 = (
    b"cursor.execute('''\r\n\r\n                INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)\r\n                VALUES (?, 'Forwarded', ?, 'AI Engine', ?)\r\n\r\n                ''', (ticket_id, f\"Routed to {dept} ({person})\", now))\r\n\r\n\r\n                created_tickets.append({\r\n                    'complaintId': ticket_id,\r\n                    'originalId': original_id,\r\n\r\n                    'complaintText': desc,\r\n\r\n                    'category': cat,\r\n\r\n                    'location': loc,\r\n\r\n                    'severity': prio,\r\n\r\n                    'department': dept,\r\n\r\n\r\n                    'assignedPerson': person,\r\n\r\n                    'status': status,\r\n\r\n                    'acknowledgementDeadline': deadline_str,\r\n                    'incidentId': linked_inc_id,\r\n\r\n                    'hasEvidence': bool(has_ev)\r\n\r\n                })"
)
new2 = (
    b"cursor.execute('''\r\n                INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)\r\n                VALUES (?, ?, ?, 'AI Engine', ?)\r\n                ''', (ticket_id, status, route.get('routing_reason', f\"Routed to {dept} ({person})\"), now))\r\n\r\n                created_tickets.append({\r\n                    'complaintId': ticket_id,\r\n                    'originalId': original_id,\r\n                    'complaintText': desc,\r\n                    'category': cat,\r\n                    'location': loc,\r\n                    'severity': prio,\r\n                    'department': dept,\r\n                    'assignedPerson': person,\r\n                    'status': status,\r\n                    'acknowledgementDeadline': deadline_str,\r\n                    'incidentId': linked_inc_id,\r\n                    'hasEvidence': bool(has_ev)\r\n                })"
)
src = replace_once(src, old2, new2, "confirmed_issues: Forwarded timeline + append")

# ── PATCH 3: guided submission path – status ─────────────────────────────────
src = replace_once(
    src,
    b"dept = route['department']\r\n            person = route['assigned_person']\r\n\r\n            status = \"Forwarded\"",
    b"dept = route['department']\r\n            person = route['assigned_person']\r\n            status = \"Pending Assignment\" if route.get('pending') else \"Forwarded\"",
    "guided: status"
)

# ── PATCH 4: guided submission path – Forwarded timeline insert ──────────────
old4 = (
    b"cursor.execute('''\r\n\r\n\r\n            INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)\r\n\r\n\r\n            VALUES (?, 'Forwarded', ?, 'Routing Engine', ?)\r\n\r\n            ''', (ticket_id, f\"Routed to {dept} ({person}) | SLA: {prio_hours}h\", now))"
)
new4 = (
    b"cursor.execute('''\r\n            INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)\r\n            VALUES (?, ?, ?, 'Routing Engine', ?)\r\n            ''', (ticket_id, status, route.get('routing_reason', f\"Routed to {dept} ({person})\"), now))"
)
src = replace_once(src, old4, new4, "guided: Forwarded timeline")

# ── PATCH 5: free-text fallback – hardcoded General Administration ────────────
old5 = (
    b"            except Exception:\r\n                issues_list = [{\r\n                    'description': text,\r\n\r\n                    'category': categorizeComplaint(text),\r\n                    'location': detectLocation(text) or 'Campus',\r\n                    'severity': detectPriority(text) or 'Medium',\r\n                    'department': 'General Administration',\r\n\r\n                    'assigned_person': 'Campus Administrator'\r\n\r\n                }]"
)
new5 = (
    b"            except Exception:\r\n                _fb_cat = categorizeComplaint(text)\r\n                _fb_route = routeComplaint(_fb_cat)\r\n                issues_list = [{\r\n                    'description': text,\r\n                    'category': _fb_cat,\r\n                    'location': detectLocation(text) or 'Campus',\r\n                    'severity': detectPriority(text) or 'Medium',\r\n                    'department': _fb_route['department'],\r\n                    'assigned_person': _fb_route['assigned_person'],\r\n                    'routing_reason': _fb_route['routing_reason'],\r\n                    'pending': _fb_route['pending']\r\n                }]"
)
src = replace_once(src, old5, new5, "free-text: fallback department")

# ── PATCH 6: free-text path – status ─────────────────────────────────────────
src = replace_once(
    src,
    b"                dept = issue['department']\r\n                person = issue['assigned_person']\r\n                status = \"Forwarded\"",
    b"                dept = issue['department']\r\n                person = issue['assigned_person']\r\n                _issue_pending = issue.get('pending', False)\r\n                _issue_reason = issue.get('routing_reason', f\"Routed to {dept} ({person})\")\r\n                status = \"Pending Assignment\" if _issue_pending else \"Forwarded\"",
    "free-text: status"
)

# ── PATCH 7: free-text path – Forwarded timeline insert ──────────────────────
old7 = (
    b"cursor.execute('''\r\n\r\n                INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)\r\n                VALUES (?, 'Forwarded', ?, 'AI Engine', ?)\r\n                ''', (ticket_id, f\"Routed to {dept} ({person})\", now))\r\n\r\n\r\n                created_tickets.append({\r\n                    'complaintId': ticket_id,\r\n\r\n                    'originalId': original_id,\r\n                    'complaintText': desc,\r\n                    'category': cat,\r\n                    'location': loc,\r\n\r\n                    'severity': prio,\r\n                    'department': dept,\r\n                    'assignedPerson': person,\r\n                    'status': status,\r\n                    'acknowledgementDeadline': deadline_str,\r\n\r\n                    'incidentId': linked_inc_id,\r\n                    'hasEvidence': bool(has_ev)\r\n                })"
)
new7 = (
    b"cursor.execute('''\r\n                INSERT INTO complaint_timeline (complaint_id, status, description, updated_by, timestamp)\r\n                VALUES (?, ?, ?, 'AI Engine', ?)\r\n                ''', (ticket_id, status, _issue_reason, now))\r\n\r\n                created_tickets.append({\r\n                    'complaintId': ticket_id,\r\n                    'originalId': original_id,\r\n                    'complaintText': desc,\r\n                    'category': cat,\r\n                    'location': loc,\r\n                    'severity': prio,\r\n                    'department': dept,\r\n                    'assignedPerson': person,\r\n                    'status': status,\r\n                    'acknowledgementDeadline': deadline_str,\r\n                    'incidentId': linked_inc_id,\r\n                    'hasEvidence': bool(has_ev)\r\n                })"
)
src = replace_once(src, old7, new7, "free-text: Forwarded timeline + append")

print(f"\n{changes}/7 patches applied. File size: {len(src)} bytes (was {original_len}).")

with open('app.py', 'wb') as f:
    f.write(src)
print("app.py written.")
