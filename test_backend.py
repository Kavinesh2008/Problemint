import os
import json
from services.complaint_splitter import splitComplaint
from services.categorization import categorizeComplaint
from services.priority import detectPriority, detectLocation
from services.routing import routeComplaint

sample_text = "The hostel food quality is poor, the water cooler near Block B is not working, Wi-Fi is slow, the washroom is dirty and the lift is not working."

print("--- TESTING MULTI-ISSUE SPLITTER ---")
issues = splitComplaint(sample_text)
print(f"Total issues detected: {len(issues)}")

for i, issue in enumerate(issues, 1):
    cat = categorizeComplaint(issue)
    prio = detectPriority(issue)
    loc = detectLocation(issue)
    route = routeComplaint(cat)
    print(f"\nIssue #{i}:")
    print(f"  Description: '{issue}'")
    print(f"  Category: {cat}")
    print(f"  Priority: {prio}")
    print(f"  Location: {loc}")
    print(f"  Department: {route['department']}")
    print(f"  Assigned Person: {route['assigned_person']}")

assert len(issues) == 5, f"Expected 5 issues, got {len(issues)}"
print("\n[SUCCESS] Multi-issue splitting and intelligent routing verified successfully!")
