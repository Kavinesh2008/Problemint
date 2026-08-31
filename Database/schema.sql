-- PROBLEMINT Relational Database Schema
-- Defines entities and relationships for Complaints, Incidents, Resolutions, Feedback, Knowledge Base, Prevention, and AI Insights

CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    role VARCHAR(50) DEFAULT 'User',
    department VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS incidents (
    incident_id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    location VARCHAR(100),
    department VARCHAR(100),
    severity VARCHAR(20),
    status VARCHAR(50),
    first_reported_at VARCHAR(50),
    last_reported_at VARCHAR(50),
    complaint_count INT DEFAULT 1,
    affected_users INT DEFAULT 1,
    pattern_detected TEXT,
    possible_root_cause TEXT,
    root_cause_confidence DOUBLE DEFAULT 0.0,
    assigned_team VARCHAR(100),
    resolution_status VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS complaints (
    complaint_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    complaint_text TEXT NOT NULL,
    created_at VARCHAR(50),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    location VARCHAR(100),
    department VARCHAR(100),
    severity VARCHAR(20),
    impact VARCHAR(50),
    status VARCHAR(50),
    incident_id VARCHAR(50),
    source VARCHAR(20) DEFAULT 'Web',
    has_evidence BOOLEAN DEFAULT FALSE,
    user_verified BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (incident_id) REFERENCES incidents(incident_id)
);

CREATE TABLE IF NOT EXISTS resolutions (
    resolution_id VARCHAR(50) PRIMARY KEY,
    incident_id VARCHAR(50),
    attempt_number INT DEFAULT 1,
    action_taken TEXT NOT NULL,
    performed_by VARCHAR(100),
    performed_at VARCHAR(50),
    action_type VARCHAR(50),
    outcome VARCHAR(50),
    success BOOLEAN DEFAULT FALSE,
    resolution_time_hours DOUBLE DEFAULT 0.0,
    verification_status VARCHAR(50),
    user_feedback_summary TEXT,
    follow_up_required BOOLEAN DEFAULT FALSE,
    incident_final_status VARCHAR(50),
    FOREIGN KEY (incident_id) REFERENCES incidents(incident_id)
);

CREATE TABLE IF NOT EXISTS user_feedback (
    feedback_id VARCHAR(50) PRIMARY KEY,
    complaint_id VARCHAR(50),
    user_id VARCHAR(50),
    incident_id VARCHAR(50),
    submitted_at VARCHAR(50),
    resolution_id VARCHAR(50),
    verification_status VARCHAR(50),
    problem_resolved VARCHAR(20),
    satisfaction_score INT,
    feedback_text TEXT,
    remaining_issue TEXT,
    reopen_requested VARCHAR(10),
    evidence_provided BOOLEAN DEFAULT FALSE,
    follow_up_required BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (incident_id) REFERENCES incidents(incident_id),
    FOREIGN KEY (resolution_id) REFERENCES resolutions(resolution_id)
);

CREATE TABLE IF NOT EXISTS knowledge_items (
    knowledge_id VARCHAR(50) PRIMARY KEY,
    incident_id VARCHAR(50),
    problem_type VARCHAR(100),
    problem_description TEXT,
    location VARCHAR(100),
    root_cause TEXT,
    root_cause_confidence DOUBLE DEFAULT 0.0,
    solution_attempted TEXT,
    successful_solution TEXT,
    failed_solution TEXT,
    outcome VARCHAR(50),
    resolution_time_hours DOUBLE DEFAULT 0.0,
    success_rate VARCHAR(20),
    lesson_learned TEXT,
    recommended_future_action TEXT,
    created_from_incident VARCHAR(50),
    last_updated VARCHAR(50),
    FOREIGN KEY (incident_id) REFERENCES incidents(incident_id)
);

CREATE TABLE IF NOT EXISTS prevention_recommendations (
    recommendation_id VARCHAR(50) PRIMARY KEY,
    incident_id VARCHAR(50),
    problem TEXT,
    recommendation TEXT NOT NULL,
    reason TEXT,
    evidence TEXT,
    risk_level VARCHAR(20),
    priority VARCHAR(20),
    expected_impact TEXT,
    suggested_timeline VARCHAR(50),
    responsible_department VARCHAR(100),
    recommended_action_type VARCHAR(50),
    status VARCHAR(50),
    created_at VARCHAR(50),
    based_on_previous_incident BOOLEAN DEFAULT TRUE,
    supporting_complaint_count INT DEFAULT 1,
    FOREIGN KEY (incident_id) REFERENCES incidents(incident_id)
);

CREATE TABLE IF NOT EXISTS ai_insights (
    insight_id VARCHAR(50) PRIMARY KEY,
    incident_id VARCHAR(50),
    insight_type VARCHAR(50),
    description TEXT NOT NULL,
    evidence TEXT,
    confidence DOUBLE DEFAULT 0.0,
    severity VARCHAR(20),
    detected_at VARCHAR(50),
    recommended_action TEXT,
    status VARCHAR(50),
    FOREIGN KEY (incident_id) REFERENCES incidents(incident_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    type VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(255),
    read_status BOOLEAN DEFAULT FALSE,
    timestamp VARCHAR(50)
);
