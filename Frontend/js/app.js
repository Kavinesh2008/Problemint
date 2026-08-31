// PROBLEMINT Frontend Application Router & View Renderer
const app = {
    currentView: 'dashboard',

    init() {
        this.bindNavigation();
        this.bindCopilot();
        this.bindNotifications();
        this.handleHashChange();
        window.addEventListener('hashchange', () => this.handleHashChange());
    },

    bindNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const targetView = item.getAttribute('data-view');
                if (targetView) {
                    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                }
            });
        });
    },

    bindCopilot() {
        const drawer = document.getElementById('copilot-drawer');
        const toggleBtn = document.getElementById('copilot-toggle-btn');
        const closeBtn = document.getElementById('copilot-close-btn');
        const sendBtn = document.getElementById('copilot-send-btn');
        const input = document.getElementById('copilot-input');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                drawer.classList.toggle('hidden');
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                drawer.classList.add('hidden');
            });
        }

        const handleSend = async () => {
            const query = input.value.trim();
            if (!query) return;

            const chat = document.getElementById('copilot-chat-history');
            chat.innerHTML += `<div class="user-msg" style="align-self:flex-end; background:#4f46e5; color:white; padding:8px 12px; border-radius:12px; font-size:12px; margin-top:8px;">${query}</div>`;
            input.value = '';

            try {
                const res = await Api.askCopilot(query);
                chat.innerHTML += `<div class="ai-msg" style="background:#f1f5f9; color:#1e293b; padding:10px 14px; border-radius:12px; font-size:12px; margin-top:8px; line-height:1.4;">${res.response}</div>`;
                chat.scrollTop = chat.scrollHeight;
            } catch (e) {
                console.error(e);
            }
        };

        if (sendBtn) sendBtn.addEventListener('click', handleSend);
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleSend();
            });
        }
    },

    suggestCopilotQuery(q) {
        document.getElementById('copilot-drawer').classList.remove('hidden');
        document.getElementById('copilot-input').value = q;
        document.getElementById('copilot-send-btn').click();
    },

    bindNotifications() {
        const notifBtn = document.getElementById('notification-btn');
        const dropdown = document.getElementById('notif-dropdown');
        if (notifBtn) {
            notifBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
                if (!dropdown.classList.contains('hidden')) {
                    this.loadNotificationsList();
                }
            });
        }
        document.addEventListener('click', (e) => {
            if (dropdown && !dropdown.contains(e.target) && !notifBtn.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    },

    async loadNotificationsList() {
        const list = document.getElementById('notif-list');
        list.innerHTML = '<div style="padding:12px; font-size:12px; color:#6b7280;">Loading notifications...</div>';
        try {
            const notifs = await Api.getNotifications();
            if (!notifs || notifs.length === 0) {
                list.innerHTML = '<div style="padding:12px; font-size:12px; color:#6b7280;">No new notifications.</div>';
                return;
            }
            list.innerHTML = notifs.map(n => `
                <div class="notif-item" onclick="window.location.hash='${n.link}'">
                    <div class="notif-title">${n.title}</div>
                    <div class="notif-msg">${n.message}</div>
                    <div class="notif-time">${n.timestamp}</div>
                </div>
            `).join('');
        } catch (e) {
            list.innerHTML = '<div style="padding:12px; font-size:12px; color:#ef4444;">Failed to load notifications.</div>';
        }
    },

    handleHashChange() {
        let hash = window.location.hash.replace('#', '');
        if (!hash) hash = 'dashboard';
        
        let viewName = hash;
        let param = null;
        if (hash.includes('/')) {
            const parts = hash.split('/');
            viewName = parts[0];
            param = parts[1];
        }

        this.currentView = viewName;
        this.updateActiveNav(viewName);

        const container = document.getElementById('view-container');
        container.innerHTML = `<div style="padding:40px; text-align:center; color:#6b7280;">Loading view...</div>`;

        switch (viewName) {
            case 'dashboard':
                this.renderDashboard(container);
                break;
            case 'submit-problem':
                this.renderSubmitProblem(container);
                break;
            case 'my-complaints':
                this.renderMyComplaints(container);
                break;
            case 'incidents':
                if (param) this.renderIncidentDetail(container, param);
                else this.renderIncidents(container);
                break;
            case 'problem-intelligence':
                this.renderProblemIntelligence(container);
                break;
            case 'emerging-problems':
                this.renderEmergingProblems(container);
                break;
            case 'knowledge-base':
                this.renderKnowledgeBase(container);
                break;
            case 'prevention-center':
                this.renderPreventionCenter(container);
                break;
            case 'analytics':
                this.renderAnalytics(container);
                break;
            case 'settings':
                this.renderSettings(container);
                break;
            default:
                this.renderDashboard(container);
        }
    },

    updateActiveNav(viewName) {
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-view') === viewName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    },

    // ==========================================
    // 1. DASHBOARD VIEW
    // ==========================================
    async renderDashboard(container) {
        try {
            const stats = await Api.getDashboardStats();
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h1>Problem Intelligence</h1>
                        <p>Real-time campus problem analysis and resolution telemetry</p>
                    </div>
                    <div style="display:flex; gap:12px;">
                        <button class="quick-action-btn" onclick="app.renderDashboard(document.getElementById('view-container'))">Refresh Telemetry</button>
                    </div>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Total Reports <span>📄</span></div>
                        <div class="stat-value">${stats.totalReports} <span class="stat-badge badge-up">+12%</span></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Active Problems <span>⚠️</span></div>
                        <div class="stat-value">${stats.activeProblems} <span class="stat-badge badge-down">-2</span></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Emerging Issues <span>📈</span></div>
                        <div class="stat-value" style="color:#ef4444;">${stats.emergingIssues}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Recurring Problems <span>🔄</span></div>
                        <div class="stat-value" style="color:#f59e0b;">${stats.recurringProblems}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">AI Confidence <span>🎯</span></div>
                        <div class="stat-value" style="color:#4f46e5;">${stats.aiConfidence}</div>
                    </div>
                </div>

                <div class="dashboard-grid">
                    <div>
                        <div class="card" style="margin-bottom:28px;">
                            <div class="card-title">What needs attention now?</div>
                            ${stats.needsAttention.map(item => `
                                <div class="attention-card" onclick="window.location.hash='${item.incidentId ? 'incidents/' + item.incidentId : 'prevention-center'}'" style="cursor:pointer;">
                                    <div class="attention-type">${item.type}</div>
                                    <div class="attention-title">${item.title}</div>
                                    <div class="attention-desc">${item.location}</div>
                                    <div class="tag-list">
                                        ${item.tags.map(t => `<span class="tag tag-urgent">${t}</span>`).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>

                        <div class="card">
                            <div class="card-title">Complaint Trend Over Time <span style="font-size:12px; font-weight:500; color:#6b7280;">Last 7 Days</span></div>
                            <canvas id="trendChart" height="140"></canvas>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:28px;">
                        <div class="card">
                            <div class="card-title">Category Distribution</div>
                            <canvas id="categoryChart" height="200"></canvas>
                        </div>

                        <div class="card">
                            <div class="card-title">Campus Heatmap</div>
                            <div style="background:#f8fafc; border-radius:8px; padding:20px; text-align:center;">
                                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px;">
                                    <div style="background:#fee2e2; border:1px solid #fca5a5; padding:16px; border-radius:8px; color:#991b1b; font-weight:700;">Block B<br><span style="font-size:11px; font-weight:500;">High Density (11 reports)</span></div>
                                    <div style="background:#fef3c7; border:1px solid #fde047; padding:16px; border-radius:8px; color:#92400e; font-weight:700;">Library<br><span style="font-size:11px; font-weight:500;">Medium (4 reports)</span></div>
                                    <div style="background:#fef3c7; border:1px solid #fde047; padding:16px; border-radius:8px; color:#92400e; font-weight:700;">Block C<br><span style="font-size:11px; font-weight:500;">Medium (6 reports)</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.initDashboardCharts();
        } catch (e) {
            container.innerHTML = `<div style="color:red; padding:20px;">Error rendering dashboard: ${e.message}</div>`;
        }
    },

    initDashboardCharts() {
        const ctx1 = document.getElementById('trendChart');
        if (ctx1) {
            new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Complaints',
                        data: [15, 22, 18, 35, 48, 62, 54],
                        borderColor: '#4f46e5',
                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }

        const ctx2 = document.getElementById('categoryChart');
        if (ctx2) {
            new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['Water & Sanitation', 'Internet & Network', 'Electricity', 'Housekeeping'],
                    datasets: [{
                        data: [42, 30, 18, 10],
                        backgroundColor: ['#4f46e5', '#6366f1', '#f59e0b', '#10b981']
                    }]
                },
                options: { responsive: true }
            });
        }
    },

    // ==========================================
    // 2. SUBMIT PROBLEM VIEW (Interactive Flow)
    // ==========================================
    renderSubmitProblem(container) {
        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Describe the problem you're facing</h1>
                    <p>PROBLEMINT AI will structure your report, ask missing details, suggest troubleshooting, and route it to the right department.</p>
                </div>
            </div>

            <div style="max-width:800px; margin:0 auto;" class="card">
                <div id="chat-flow" style="display:flex; flex-direction:column; gap:16px; margin-bottom:24px;">
                    <div style="background:#f1f5f9; padding:16px; border-radius:12px; font-size:14px;">
                        👋 Describe your problem naturally. For example: <em>"The water pressure in Block B becomes very low every evening."</em>
                    </div>
                </div>

                <div style="display:flex; gap:12px;">
                    <textarea id="user-problem-input" rows="3" style="flex:1; padding:14px; border-radius:12px; border:1px solid #cbd5e1; outline:none; font-size:14px;" placeholder="Type your problem here..."></textarea>
                    <button id="btn-submit-flow" class="btn-header-primary" style="align-self:flex-end; padding:14px 24px;">Analyze & Step</button>
                </div>
            </div>
        `;

        document.getElementById('btn-submit-flow').addEventListener('click', () => this.executeSubmitFlowStep());
    },

    async executeSubmitFlowStep() {
        const text = document.getElementById('user-problem-input').value.trim();
        if (!text) return;

        const chat = document.getElementById('chat-flow');
        chat.innerHTML += `
            <div style="background:#4f46e5; color:white; padding:14px 18px; border-radius:12px; font-size:14px; align-self:flex-end; max-width:80%;">
                ${text}
            </div>
        `;

        // 1. AI Analysis & DNA Extraction
        chat.innerHTML += `<div style="background:#f8fafc; border:1px solid #e2e8f0; padding:14px; border-radius:12px; font-size:13px; color:#475569;">🤖 <em>Extracting Complaint DNA & analyzing symptoms...</em></div>`;

        try {
            const analysis = await Api.analyzeComplaint(text);
            const preRes = await Api.getPreResolution(analysis.category, analysis.location);
            const similar = await Api.findSimilar(text, analysis.category, analysis.location);

            chat.lastElementChild.remove(); // remove loading indicator

            chat.innerHTML += `
                <div style="background:#eef2ff; border:1px solid #c7d2fe; padding:20px; border-radius:12px; margin-top:12px;">
                    <div style="font-weight:700; color:#3730a3; font-size:15px; margin-bottom:12px;">🧬 AI Complaint DNA Extracted (Confidence ${analysis.confidence * 100}%)</div>
                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; font-size:13px; color:#1e1b4b;">
                        <div><strong>Category:</strong> ${analysis.category}</div>
                        <div><strong>Subcategory:</strong> ${analysis.subcategory}</div>
                        <div><strong>Location:</strong> ${analysis.location}</div>
                        <div><strong>Severity:</strong> <span style="color:#ef4444; font-weight:700;">${analysis.severity}</span></div>
                        <div><strong>Impact:</strong> ${analysis.impact}</div>
                        <div><strong>Time Pattern:</strong> ${analysis.timePattern}</div>
                    </div>
                </div>
            `;

            // 2. Pre-Resolution Assistance
            chat.innerHTML += `
                <div style="background:#fffbe8; border:1px solid #fde68a; padding:18px; border-radius:12px; margin-top:12px;">
                    <div style="font-weight:700; color:#92400e; font-size:14px; margin-bottom:8px;">💡 Pre-Resolution Troubleshooting: ${preRes.title}</div>
                    <p style="font-size:13px; color:#78350f; margin-bottom:10px;">${preRes.description}</p>
                    <ul style="padding-left:20px; font-size:13px; color:#78350f; margin-bottom:14px;">
                        ${preRes.steps.map(s => `<li>${s}</li>`).join('')}
                    </ul>
                    <div style="display:flex; gap:12px;">
                        <button class="quick-action-btn" style="background:#10b981; color:white; border:none; padding:8px 16px;" onclick="alert('Great! Problem resolved successfully. No ticket logged.')">Problem Solved</button>
                        <button class="btn-header-primary" onclick="app.finishComplaintSubmission('${text.replace(/'/g, "\\'")}', '${analysis.category}', '${analysis.subcategory}', '${analysis.location}', '${analysis.severity}', '${analysis.department}')">Still Having Trouble -> Create Complaint</button>
                    </div>
                </div>
            `;

            // 3. Similar Complaint Warning
            if (similar && similar.similarComplaints && similar.similarComplaints.length > 0) {
                const topMatch = similar.similarComplaints[0];
                chat.innerHTML += `
                    <div style="background:#fef2f2; border:1px solid #fca5a5; padding:16px; border-radius:12px; margin-top:12px; color:#991b1b; font-size:13px;">
                        ⚠️ <strong>High Similarity Match (${topMatch.similarityPercentage}% Match)</strong>: A similar issue (${topMatch.complaint.complaintId}: "${topMatch.complaint.complaintText}") is already logged at ${topMatch.complaint.location}.
                    </div>
                `;
            }

        } catch (e) {
            console.error(e);
        }
    },

    async finishComplaintSubmission(text, category, subcategory, location, severity, department) {
        try {
            const res = await Api.createComplaint({
                complaintText: text,
                category: category,
                subcategory: subcategory,
                location: location,
                severity: severity,
                department: department,
                impact: 'Multiple Users',
                incidentId: 'INC-016',
                source: 'Web',
                hasEvidence: true
            });

            alert(`Complaint ${res.complaint.complaintId} created successfully! Associated with common incident INC-016.`);
            window.location.hash = '#my-complaints';
        } catch (e) {
            alert('Failed to submit complaint: ' + e.message);
        }
    },

    // ==========================================
    // 3. MY COMPLAINTS VIEW
    // ==========================================
    async renderMyComplaints(container) {
        try {
            const complaints = await Api.getComplaints();
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h1>My Submitted Complaints</h1>
                        <p>Track progress, review Complaint DNA, and verify resolution status</p>
                    </div>
                    <a href="#submit-problem" class="btn-header-primary">+ Submit New Problem</a>
                </div>

                <div class="card">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Complaint ID</th>
                                <th>Description</th>
                                <th>Category & Location</th>
                                <th>Severity</th>
                                <th>Status Progression</th>
                                <th>Verification</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${complaints.slice(0, 15).map(c => `
                                <tr>
                                    <td><strong>${c.complaintId}</strong></td>
                                    <td style="max-width:300px;">${c.complaintText}</td>
                                    <td>${c.category} <br><span style="font-size:11px; color:#6b7280;">${c.location}</span></td>
                                    <td><span class="tag tag-urgent">${c.severity}</span></td>
                                    <td>
                                        <span class="tag" style="background:#e0e7ff; color:#3730a3; font-weight:700;">${c.status}</span>
                                        ${c.incidentId ? `<br><a href="#incidents/${c.incidentId}" style="font-size:11px; color:#4f46e5;">Link: ${c.incidentId}</a>` : ''}
                                    </td>
                                    <td>
                                        ${c.userVerified ? 
                                            `<span style="color:#10b981; font-weight:700; font-size:12px;">✅ Verified Fixed</span>` :
                                            `<button class="quick-action-btn" onclick="app.showVerificationModal('${c.complaintId}')">Verify Fix</button>`
                                        }
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div style="color:red;">Error loading complaints</div>`;
        }
    },

    showVerificationModal(complaintId) {
        const answer = prompt(`Verification for Complaint ${complaintId}:\nIs the problem actually solved?\n\nOptions: Yes / No / Partially`, "Yes");
        if (answer) {
            Api.submitVerification({ complaintId: complaintId, verificationStatus: answer, feedbackText: "User verification submitted via web interface." })
               .then(res => {
                   alert(res.message);
                   this.renderMyComplaints(document.getElementById('view-container'));
               });
        }
    },

    // ==========================================
    // 4. INCIDENTS VIEW
    // ==========================================
    async renderIncidents(container) {
        try {
            const incidents = await Api.getIncidents();
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h1>Incident Intelligence</h1>
                        <p>Problem-centric view grouping multiple related complaints into common incidents</p>
                    </div>
                </div>

                <div class="card">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Incident ID</th>
                                <th>Title & Category</th>
                                <th>Location</th>
                                <th>Grouped Reports</th>
                                <th>Root Cause Confidence</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${incidents.map(inc => `
                                <tr>
                                    <td><strong>${inc.incidentId}</strong></td>
                                    <td><strong>${inc.title}</strong><br><span style="font-size:11px; color:#6b7280;">${inc.category}</span></td>
                                    <td>${inc.location}</td>
                                    <td><span style="font-weight:800; color:#4f46e5;">${inc.complaintCount} reports</span> (${inc.affectedUsers} users)</td>
                                    <td><span style="color:#10b981; font-weight:700;">${(inc.rootCauseConfidence * 100).toFixed(0)}%</span></td>
                                    <td><span class="tag tag-urgent">${inc.status}</span></td>
                                    <td><a href="#incidents/${inc.incidentId}" class="btn-header-primary" style="padding:6px 12px; font-size:12px;">View Detail &rarr;</a></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div style="color:red;">Error loading incidents</div>`;
        }
    },

    // ==========================================
    // 5. INCIDENT DETAIL VIEW (With AI Root Cause Hypothesis)
    // ==========================================
    async renderIncidentDetail(container, incidentId) {
        try {
            const data = await Api.getIncidentById(incidentId);
            const inc = data.incident;
            const hyp = data.rootCauseHypothesis;
            const grouped = data.groupedComplaints;

            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <h1>${inc.title}</h1>
                            <span class="tag tag-urgent">${inc.severity} Severity</span>
                            <span class="tag" style="background:#e0e7ff; color:#3730a3;">${inc.status}</span>
                        </div>
                        <p>Problem-centric view grouping ${grouped.length} related complaints</p>
                    </div>
                    <button class="btn-header-primary" onclick="app.recordResolutionAttempt('${inc.incidentId}')">Record Resolution Attempt</button>
                </div>

                <div class="dashboard-grid">
                    <div>
                        <!-- Impact Overview -->
                        <div class="card" style="margin-bottom:28px;">
                            <div class="card-title">Impact Overview</div>
                            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:16px;">
                                <div style="background:#f8fafc; padding:16px; border-radius:8px;">
                                    <span style="font-size:12px; color:#6b7280;">Affected Users</span>
                                    <div style="font-size:28px; font-weight:800; color:#1e293b;">${inc.affectedUsers}</div>
                                </div>
                                <div style="background:#f8fafc; padding:16px; border-radius:8px;">
                                    <span style="font-size:12px; color:#6b7280;">Grouped Complaints</span>
                                    <div style="font-size:28px; font-weight:800; color:#4f46e5;">${inc.complaintCount}</div>
                                </div>
                                <div style="background:#f8fafc; padding:16px; border-radius:8px;">
                                    <span style="font-size:12px; color:#6b7280;">Est. Time to Resolve</span>
                                    <div style="font-size:28px; font-weight:800; color:#10b981;">4h</div>
                                </div>
                            </div>
                        </div>

                        <!-- AI-Generated Root Cause Hypothesis -->
                        <div class="card" style="background:linear-gradient(135deg, #f5f3ff, #eef2ff); border:1px solid #c7d2fe; margin-bottom:28px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                                <h3 style="color:#4338ca; font-size:16px; font-weight:800;">🧠 AI-Generated Root Cause Hypothesis</h3>
                                <span style="background:#6366f1; color:white; font-size:10px; font-weight:800; padding:2px 8px; border-radius:10px;">SYNTHESIZED</span>
                            </div>
                            <div style="background:#fffbe8; border:1px solid #fde68a; padding:10px 14px; border-radius:8px; color:#92400e; font-size:12px; font-weight:700; margin-bottom:14px;">
                                ⚠️ ${hyp.mandatoryDisclaimer}
                            </div>
                            <p style="font-size:14px; color:#1e1b4b; line-height:1.6; margin-bottom:14px;">${hyp.hypothesisText}</p>
                            <div style="background:white; padding:14px; border-radius:8px; border:1px solid #e0e7ff; margin-bottom:14px;">
                                <strong style="font-size:12px; color:#4338ca;">Recommended Immediate Action:</strong>
                                <p style="font-size:13px; color:#3730a3; margin-top:4px;">${hyp.recommendedAction}</p>
                            </div>
                        </div>

                        <!-- Grouped Complaints -->
                        <div class="card">
                            <div class="card-title">Grouped Complaints (${grouped.length})</div>
                            <div style="display:flex; flex-direction:column; gap:12px;">
                                ${grouped.map(c => `
                                    <div style="border:1px solid #e2e8f0; padding:14px; border-radius:8px;">
                                        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; color:#1e293b;">
                                            <span>${c.complaintId}</span>
                                            <span style="color:#6b7280;">${c.createdAt}</span>
                                        </div>
                                        <p style="font-size:13px; color:#475569; margin:6px 0;">"${c.complaintText}"</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:28px;">
                        <div class="card">
                            <div class="card-title">Evidence & Media</div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                                <img src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=300&q=80" style="width:100%; border-radius:8px; height:100px; object-fit:cover;">
                                <img src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=300&q=80" style="width:100%; border-radius:8px; height:100px; object-fit:cover;">
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-title">Incident Timeline</div>
                            <div class="timeline">
                                <div class="timeline-item">
                                    <div class="timeline-node"></div>
                                    <div class="timeline-time">18:45</div>
                                    <div class="timeline-text">AI Pattern Detected</div>
                                </div>
                                <div class="timeline-item">
                                    <div class="timeline-node"></div>
                                    <div class="timeline-time">18:50</div>
                                    <div class="timeline-text">Incident Auto-Created</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div style="color:red;">Error loading incident detail</div>`;
        }
    },

    async recordResolutionAttempt(incidentId) {
        const action = prompt("Record Resolution Action Taken:\n(e.g., Replaced booster pump valve impellers)", "Replaced booster pump valve impellers");
        if (!action) return;

        try {
            const res = await Api.createResolution({
                incidentId: incidentId,
                attemptNumber: 2,
                actionTaken: action,
                performedBy: 'Facilities Ops Team',
                actionType: 'Replacement',
                outcome: 'Successful',
                success: true,
                resolutionTimeHours: 4.0
            });
            alert("Resolution attempt recorded successfully! Organizational Memory updated.");
            this.renderIncidentDetail(document.getElementById('view-container'), incidentId);
        } catch (e) {
            if (e.status === 'BLOCKED') {
                alert(`🛑 PROBLEMINT BLOCKED THIS ACTION:\n\n${e.error}\n\nHistorically Failed Solution: ${e.historicallyFailedSolution}\n\nRecommended Alternative: ${e.recommendedAlternative}`);
            } else {
                alert("Error: " + JSON.stringify(e));
            }
        }
    },

    // ==========================================
    // 6. PROBLEM INTELLIGENCE & EMERGING PROBLEMS
    // ==========================================
    renderProblemIntelligence(container) {
        this.renderEmergingProblems(container);
    },

    async renderEmergingProblems(container) {
        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Emerging Problem Intelligence</h1>
                    <p>Detect rapid complaint volume spikes and emerging infrastructure anomalies</p>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="quick-action-btn active">Last 7 Days</button>
                    <button class="quick-action-btn">Last 30 Days</button>
                </div>
            </div>

            <div class="stats-grid">
                <div class="stat-card" style="border-top:4px solid #ef4444;">
                    <div class="stat-label">Water Supply Spikes</div>
                    <div class="stat-value" style="color:#ef4444;">+180% <span style="font-size:12px; color:#6b7280;">Block B</span></div>
                </div>
                <div class="stat-card" style="border-top:4px solid #f59e0b;">
                    <div class="stat-label">Network Drops</div>
                    <div class="stat-value" style="color:#f59e0b;">+120% <span style="font-size:12px; color:#6b7280;">Transport Bay</span></div>
                </div>
                <div class="stat-card" style="border-top:4px solid #3b82f6;">
                    <div class="stat-label">HVAC Temperature</div>
                    <div class="stat-value" style="color:#3b82f6;">+75% <span style="font-size:12px; color:#6b7280;">North Hall</span></div>
                </div>
            </div>
        `;
    },

    // ==========================================
    // 7. KNOWLEDGE BASE (Organizational Memory)
    // ==========================================
    async renderKnowledgeBase(container) {
        try {
            const kb = await Api.getKnowledge();
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h1>Organizational Memory & Knowledge Base</h1>
                        <p>Preserved historical incident solutions, failed attempts, and lessons learned</p>
                    </div>
                </div>

                <div class="card">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Knowledge ID</th>
                                <th>Problem & Location</th>
                                <th>Root Cause</th>
                                <th>Failed Solution (Blocked)</th>
                                <th>Successful Solution</th>
                                <th>Lesson Learned</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${kb.map(item => `
                                <tr>
                                    <td><strong>${item.knowledgeId}</strong></td>
                                    <td><strong>${item.problemType}</strong><br><span style="font-size:11px; color:#6b7280;">${item.location}</span></td>
                                    <td>${item.rootCause}</td>
                                    <td><span style="color:#ef4444; font-weight:700;">❌ ${item.failedSolution}</span></td>
                                    <td><span style="color:#10b981; font-weight:700;">✅ ${item.successfulSolution}</span></td>
                                    <td style="font-size:12px; color:#475569;">${item.lessonLearned}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div style="color:red;">Error loading knowledge base</div>`;
        }
    },

    // ==========================================
    // 8. PREVENTION CENTER
    // ==========================================
    async renderPreventionCenter(container) {
        try {
            const recs = await Api.getPrevention();
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h1>Prevention Center</h1>
                        <p>Proactive prevention recommendations generated from historical problem patterns</p>
                    </div>
                </div>

                <div class="card">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>REC ID</th>
                                <th>Problem Pattern</th>
                                <th>Recommended Intervention</th>
                                <th>Risk & Priority</th>
                                <th>Expected Impact</th>
                                <th>Department</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recs.map(r => `
                                <tr>
                                    <td><strong>${r.recommendationId}</strong></td>
                                    <td>${r.problem}</td>
                                    <td><strong>${r.recommendation}</strong><br><span style="font-size:11px; color:#6b7280;">${r.reason}</span></td>
                                    <td><span class="tag tag-urgent">${r.priority}</span></td>
                                    <td style="font-size:12px; color:#475569;">${r.expectedImpact}</td>
                                    <td>${r.responsibleDepartment}</td>
                                    <td><span class="tag" style="background:#ecfdf5; color:#10b981; font-weight:700;">${r.status}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div style="color:red;">Error loading prevention recommendations</div>`;
        }
    },

    // ==========================================
    // 9. ANALYTICS
    // ==========================================
    async renderAnalytics(container) {
        try {
            const analytics = await Api.getAnalytics();
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h1>Advanced Analytics Overview</h1>
                        <p>Real-time intelligence on problem resolution and system health</p>
                    </div>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Resolution Verification</div>
                        <div class="stat-value" style="color:#10b981;">${analytics.resolutionVerificationRate}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Avg Resolution Time</div>
                        <div class="stat-value">${analytics.avgResolutionTimeHours} <span style="font-size:12px; color:#6b7280;">hours</span></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Open Critical Incidents</div>
                        <div class="stat-value" style="color:#ef4444;">${analytics.openCriticalIncidents}</div>
                    </div>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div style="color:red;">Error loading analytics</div>`;
        }
    },

    renderSettings(container) {
        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Platform Settings</h1>
                    <p>System configuration, AI thresholds, and integration preferences</p>
                </div>
            </div>

            <div class="card" style="max-width:600px;">
                <div style="display:flex; flex-direction:column; gap:16px;">
                    <div>
                        <label style="font-size:13px; font-weight:700;">AI Similarity Match Threshold</label>
                        <input type="range" min="50" max="95" value="75" style="width:100%;">
                    </div>
                    <div>
                        <label style="font-size:13px; font-weight:700;">Auto Incident Clustering</label>
                        <select style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1;"><option>Enabled (Spatial & Temporal)</option></select>
                    </div>
                    <div>
                        <label style="font-size:13px; font-weight:700;">Failed Solution Memory Enforcement</label>
                        <select style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1;"><option>Strict (Block repeating failed actions)</option></select>
                    </div>
                </div>
            </div>
        `;
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
