import re
from services.categorization import categorizeComplaint
from services.priority import detectPriority, detectLocation
from services.routing import routeComplaint

# Subordinate or symptom connectives that should NEVER be split
SUBORDINATE_PATTERNS = [
    r'\bcausing\b',
    r'\bleading to\b',
    r'\bdue to\b',
    r'\bbecause of\b',
    r'\bso that\b',
    r'\bwhich is resulting in\b',
    r'\bas a result\b',
    r'\band therefore\b',
    r'\bmaking\b',
    r'\bcreating\b',
    r'\bleaving\b',
    r'\bresulting\b'
]

def splitComplaint(text):
    """
    Intelligently splits multi-issue natural language user text into discrete,
    actionable issue descriptions while preserving symptom clauses of single issues.
    """
    if not text or not text.strip():
        return []

    cleaned_text = text.strip()

    # Step 1: Initial segmentation on major sentence boundaries (periods, semicolons, newlines)
    # Mask common abbreviations temporarily
    protected_text = re.sub(r'\b(e\.g|i\.e|dr|prof|mr|mrs|ms)\.', r'\1<DOT>', cleaned_text, flags=re.IGNORECASE)
    major_delimiters = r'\.\s+|\n+|(?:;\s*)|(?:\b(?:also|additionally|furthermore|in addition|plus)\b\s*[:,]?\s*)'
    raw_segments = re.split(major_delimiters, protected_text, flags=re.IGNORECASE)
    raw_segments = [s.replace('<DOT>', '.') for s in raw_segments]

    candidate_chunks = []
    for seg in raw_segments:
        if not seg or not seg.strip():
            continue
        seg_clean = seg.strip()
        
        # Check if the segment contains multiple independent clauses joined by "and" or commas with different categories
        # Example: "The Wi-Fi is not working in Block C and the drinking water supply is unavailable in Block B"
        clause_delims = r'(?:,\s*and\s+)|(?:,\s*also\s+)|(?:\s+and\s+also\s+)|(?:\s+as\s+well\s+as\s+)|(?:\s+and\s+)|(?:\s*,\s*)'
        sub_clauses = re.split(clause_delims, seg_clean, flags=re.IGNORECASE)

        if len(sub_clauses) > 1:
            current_group = []
            current_cat = None
            
            for clause in sub_clauses:
                c_strip = clause.strip()
                if len(c_strip) < 3:
                    continue
                
                # Check if this clause is a continuation/symptom via subordinate keywords
                is_subordinate = any(re.search(pat, c_strip, re.IGNORECASE) for pat in SUBORDINATE_PATTERNS)
                
                clause_cat = categorizeComplaint(c_strip)
                
                if not current_group:
                    current_group.append(c_strip)
                    current_cat = clause_cat
                elif is_subordinate or (clause_cat == current_cat and clause_cat != "General Maintenance"):
                    # Same category or subordinate consequence -> merge as single problem description
                    current_group.append(c_strip)
                else:
                    # Different category or independent problem statement -> split!
                    candidate_chunks.append(" and ".join(current_group))
                    current_group = [c_strip]
                    current_cat = clause_cat
            
            if current_group:
                candidate_chunks.append(" and ".join(current_group))
        else:
            candidate_chunks.append(seg_clean)

    # Step 2: Post-process & clean issues
    issues = []
    for chunk in candidate_chunks:
        chunk_clean = chunk.strip()
        # Clean trailing punctuation
        chunk_clean = re.sub(r'[\.\,;]+$', '', chunk_clean).strip()
        # Clean leading conjunctions
        chunk_clean = re.sub(r'^(and\s+|also\s+|plus\s+|furthermore\s+)', '', chunk_clean, flags=re.IGNORECASE).strip()
        
        # Capitalize first letter
        if chunk_clean:
            chunk_clean = chunk_clean[0].upper() + chunk_clean[1:]
            
        if len(chunk_clean) > 5:
            issues.append(chunk_clean)

    if not issues:
        issues = [cleaned_text]

    return issues

def analyzeMultiIssues(text):
    """
    Returns full analysis dictionary with discrete issues, category, department,
    priority, and location for each detected issue.
    """
    issues_text = splitComplaint(text)
    analyzed_issues = []
    
    global_loc = detectLocation(text, default_location="Main Academic Block")

    for i, issue_text in enumerate(issues_text, 1):
        cat = categorizeComplaint(issue_text)
        prio = detectPriority(issue_text)
        loc = detectLocation(issue_text, default_location=global_loc)
        route = routeComplaint(cat)

        analyzed_issues.append({
            "id": f"issue_{i}",
            "description": issue_text,
            "category": cat,
            "department": route["department"],
            "assigned_person": route["assigned_person"],
            "location": loc,
            "severity": prio,
            "confidence": 0.94 if cat != "General Maintenance" else 0.75
        })

    return {
        "num_issues": len(analyzed_issues),
        "is_multi_issue": len(analyzed_issues) > 1,
        "shared_location": global_loc,
        "issues": analyzed_issues
    }
