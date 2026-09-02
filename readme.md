# PROBLEMINT - Smart Complaint Categorization and Monitoring System

**High-Fidelity Intelligence & Multi-Issue Resolution Platform**

---

## 🎯 Overview

**PROBLEMINT** is a general-purpose, intelligent complaint management system that transforms unstructured natural language user reports into actionable, trackable, and automatically routed infrastructure tickets.

The platform's core innovation lies in its **multi-issue NLP parsing, automatic category mapping, dynamic department routing, user transparency timeline, and escalation management**.

---

## 🚀 Key Features

1. **Multi-Issue Splitting**: Converts complex multi-clause user complaints into individual, independently actionable tickets (e.g. `CMP100-A`, `CMP100-B`, `CMP100-C`, `CMP100-D`, `CMP100-E`).
2. **AI Categorization & Priority**: Rule-based intelligence mapping across 39 categories, location extraction, and severity scoring (Low, Medium, High, Critical).
3. **Automated Department Routing**: Configurable category-to-department routing rules mapped to responsible officers (Mess Manager, Maintenance Admin, Network Admin, Housekeeping Supervisor, Lift Maintenance Officer, etc.).
4. **Transparency Telemetry (Seen / Not Seen)**: Tracks when a department administrator opens and views a ticket with precise timestamps (`seen_at`, `seen_by`).
5. **Visual Complaint Timeline**: End-to-end status lifecycle (`Submitted` → `AI Categorized` → `Forwarded` → `Seen` → `Accepted` → `Action Started` → `Resolved` → `Closed` / `Reopened`).
6. **Escalation Hierarchy**: Triggers automated escalation when complaints experience response delays.
7. **AI Co-pilot & Telemetry Dashboard**: Real-time problem intelligence, campus heatmaps, and natural language analytics querying the SQLite database.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.14 + Flask
- **Database**: SQLite 3
- **Frontend**: HTML5, Vanilla CSS3 (Glassmorphism Dark/Light Theme), Modern Vanilla JavaScript (Fetch API, Chart.js)
- **Architecture**: Modular Python services (`categorization.py`, `complaint_splitter.py`, `priority.py`, `routing.py`, `escalation.py`)

---

## 💻 Installation & Quick Start

### 1. Requirements
Ensure Python 3.x and Flask are installed:
```bash
pip install flask
```

### 2. Initialize & Seed Database
Run the initialization script to prepare SQLite tables and seed demo data:
```bash
python init_db.py
```

### 3. Run the Web Application
Start the Flask dev server:
```bash
python app.py
```
Open your browser and navigate to: **`http://127.0.0.1:5000`**

---

## 🧪 Demonstration Flow (5-in-1 Multi-Issue Example)

1. Open `http://127.0.0.1:5000` to view the high-fidelity **PROBLEMINT** dashboard.
2. Click **Submit Problem** in the navigation menu.
3. Paste the sample multi-issue complaint:
   > *"The hostel food quality is poor, the water cooler near Block B is not working, Wi-Fi is slow, the washroom is dirty and the lift is not working."*
4. Click **Analyze & Step** or **Create Complaint**.
5. Observe the system detect **5 distinct problems** and generate 5 split tickets:
   - **Hostel Food** → `Mess Manager` (`Mess / Food Administration`)
   - **Water Supply** → `Maintenance Admin` (`Water & Maintenance Dept`)
   - **Internet/Wi-Fi** → `Network Admin` (`Network Administration`)
   - **Sanitization** → `Housekeeping Supervisor` (`Housekeeping Dept`)
   - **Lift/Elevator** → `Lift Maintenance Officer` (`Lift Maintenance Dept`)
6. Go to **My Complaints** to view all split tickets, check transparency status ("Seen / Not Seen"), and monitor the live resolution timeline.

---

## 🔮 Architecture for Future Enhancements

- **Real LLM Integration**: Replace `services/categorization.py` and `services/complaint_splitter.py` with OpenAI / Anthropic / Local Ollama APIs.
- **Interactive Campus GIS Map**: Direct building/floor spatial map selection with problem heatmaps.
- **Push & SMS SLA Alerts**: Automated SMS / Email dispatch when escalation thresholds are breached.
