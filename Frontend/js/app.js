// PROBLEMINT Frontend Application Router & View Renderer
const app = {
    currentView: 'dashboard',

    init() {
        this.bindNavigation();
        this.bindCopilot();
        this.bindNotifications();
        this.bindAccountSwitcher();
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

    bindAccountSwitcher() {
        const btn = document.getElementById('switch-account-btn');
        const dropdown = document.getElementById('account-dropdown');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
            });
        }
        document.addEventListener('click', (e) => {
            if (dropdown && !dropdown.contains(e.target) && btn && !btn.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
        this.updateCurrentUserDisplay();
    },


    async updateCurrentUserDisplay() {
        try {
            const me = await Api.getMe();
            this.currentUser = me;
            if (me) {
                const nameEl = document.getElementById('current-user-name');
                const badgeEl = document.getElementById('current-user-role-badge');
                if (nameEl) nameEl.textContent = `${me.name} (${me.department})`;
                if (badgeEl) {
                    badgeEl.textContent = me.role;
                    badgeEl.style.background = me.role === 'Organization Admin' ? '#dc2626' : (me.role === 'Department Admin' ? '#059669' : '#6366f1');
                }
                this.applyRoleNavigationVisibility(me.role);
            }
        } catch(e) {}
    },

    applyRoleNavigationVisibility(role) {
        document.querySelectorAll('.nav-item').forEach(item => {
            const view = item.getAttribute('data-view');
            if (role === 'User') {
                if (['dashboard', 'submit-problem', 'my-complaints', 'settings'].includes(view)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            } else if (role === 'Department Admin') {
                if (['dashboard', 'my-complaints', 'incidents', 'knowledge-base', 'settings'].includes(view)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            } else {
                item.style.display = 'flex';
            }
        });
    },



    async loadAccountList() {
        const list = document.getElementById('account-list');
        list.innerHTML = '<div style="padding:12px; font-size:12px; color:#6b7280;">Loading demo accounts...</div>';
        try {
            const users = await Api.getUsers();
            list.innerHTML = users.map(u => `
                <div class="notif-item" onclick="app.switchUser(${u.id})" style="cursor:pointer; padding:10px 14px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:700; font-size:13px; color:#1e293b;">${u.name}</div>
                        <div style="font-size:11px; color:#64748b;">${u.email} • ${u.department}</div>
                    </div>
                    <span class="tag" style="font-size:10px; padding:2px 8px; font-weight:700; background:${u.role === 'Organization Admin' ? '#fee2e2; color:#991b1b;' : (u.role === 'Department Admin' ? '#d1fae5; color:#065f46;' : '#e0e7ff; color:#3730a3;')}">${u.role}</span>
                </div>
            `).join('');
        } catch(e) {
            list.innerHTML = '<div style="padding:12px; font-size:12px; color:#ef4444;">Failed to load accounts.</div>';
        }
    },

    async switchUser(userId) {
        try {
            const res = await Api.login(userId);
            const dropdown = document.getElementById('account-dropdown');
            if (dropdown) dropdown.classList.add('hidden');
            this.updateCurrentUserDisplay();
            this.handleHashChange();
        } catch(e) {
            alert('Failed to switch user.');
        }
    },


    async logout() {
        try {
            await Api.logout();
            this.isLoggedIn = false;
            window.location.hash = '#login';
        } catch(e) {
            this.isLoggedIn = false;
            window.location.hash = '#login';
        }
    },

    handleHashChange() {
        let hash = window.location.hash.replace('#', '');
        if (!hash) hash = 'login';
        
        if (!this.isLoggedIn && hash !== 'login') {
            window.location.hash = '#login';
            return;
        }

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
            case 'login':
                this.renderLogin(container);
                break;
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
                this.renderLogin(container);
        }
    },

    async renderLogin(container) {
        try {
            const users = await Api.getUsers();
            
            const regularUsers = users.filter(u => u.role === 'User');
            const deptAdmins = users.filter(u => u.role === 'Department Admin');
            const orgAdmins = users.filter(u => u.role === 'Organization Admin');

            container.innerHTML = `
                <div style="max-width:900px; margin:20px auto; padding:32px; background:white; border-radius:16px; border:1px solid #e2e8f0; box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);">
                    <div style="text-align:center; margin-bottom:28px;">
                        <div style="display:inline-flex; align-items:center; justify-content:center; width:56px; height:56px; background:#e0e7ff; border-radius:16px; margin-bottom:12px;">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M2 17L12 22L22 17" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M2 12L12 17L22 12" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <h1 style="font-size:26px; font-weight:800; color:#0f172a; margin-bottom:6px;">PROBLEMINT User Portal Sign In</h1>
                        <p style="font-size:14px; color:#64748b;">Sign in with your user credentials or select a specific user account below</p>
                    </div>

                    <!-- Interactive Email / Password Credentials Form -->
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:24px; border-radius:14px; margin-bottom:32px;">
                        <h3 style="font-size:15px; font-weight:800; color:#1e293b; margin-bottom:16px;">🔑 Account Sign In</h3>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:6px;">Login ID / Email Address:</label>
                                <input type="email" id="input-login-email" value="student@college.edu" style="width:100%; padding:11px 14px; border-radius:8px; border:1px solid #cbd5e1; outline:none; font-size:14px;" placeholder="e.g. student@college.edu">
                            </div>
                            <div>
                                <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:6px;">Password:</label>
                                <input type="password" id="input-login-password" value="student123" style="width:100%; padding:11px 14px; border-radius:8px; border:1px solid #cbd5e1; outline:none; font-size:14px;" placeholder="Enter password">
                            </div>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="font-size:12px; color:#64748b;">Select an account from below to auto-fill credentials</div>
                            <button class="btn-header-primary" style="padding:12px 28px; font-size:14px; font-weight:700;" onclick="app.submitCredentialsForm()">Sign In →</button>
                        </div>
                    </div>

                    <!-- Role-Based Credentials Directory -->
                    <h3 style="font-size:16px; font-weight:800; color:#1e293b; margin-bottom:16px;">📋 User Credentials Reference & Quick Login</h3>

                    <!-- Regular Users -->
                    <div style="margin-bottom:24px;">
                        <h4 style="font-size:14px; font-weight:800; color:#475569; margin-bottom:10px;">👤 Regular Users (Students, Faculty, Staff)</h4>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:12px;">
                            ${regularUsers.map(u => `
                                <div onclick="app.fillAndLogin('${u.email}', '${u.password}', ${u.id})" style="border:1.5px solid #e2e8f0; padding:14px; border-radius:10px; cursor:pointer; background:white; transition:all 0.2s;" class="login-role-card">
                                    <div style="font-weight:700; font-size:14px; color:#1e293b;">${u.name}</div>
                                    <div style="font-size:11px; color:#4f46e5; font-weight:600; margin-top:2px;">Login ID: ${u.email}</div>
                                    <div style="font-size:11px; color:#059669; font-weight:600;">Password: <code>${u.password}</code></div>
                                    <div style="font-size:11px; color:#64748b; margin-top:6px; font-weight:600;">Click to Auto-fill & Login →</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Department Admins -->
                    <div style="margin-bottom:24px;">
                        <h4 style="font-size:14px; font-weight:800; color:#475569; margin-bottom:10px;">🛠️ Department Administrators</h4>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:12px;">
                            ${deptAdmins.map(u => `
                                <div onclick="app.fillAndLogin('${u.email}', '${u.password}', ${u.id})" style="border:1.5px solid #e2e8f0; padding:14px; border-radius:10px; cursor:pointer; background:white; transition:all 0.2s;" class="login-role-card">
                                    <div style="font-weight:700; font-size:14px; color:#1e293b;">${u.name}</div>
                                    <div style="font-size:11px; color:#64748b;">${u.department}</div>
                                    <div style="font-size:11px; color:#4f46e5; font-weight:600; margin-top:2px;">Login ID: ${u.email}</div>
                                    <div style="font-size:11px; color:#059669; font-weight:600;">Password: <code>${u.password}</code></div>
                                    <div style="font-size:11px; color:#059669; margin-top:6px; font-weight:600;">Click to Auto-fill & Login →</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Organization Admin -->
                    <div>
                        <h4 style="font-size:14px; font-weight:800; color:#475569; margin-bottom:10px;">🏛️ Organization Administrator</h4>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:12px;">
                            ${orgAdmins.map(u => `
                                <div onclick="app.fillAndLogin('${u.email}', '${u.password}', ${u.id})" style="border:1.5px solid #fca5a5; padding:14px; border-radius:10px; cursor:pointer; background:#fef2f2; transition:all 0.2s;" class="login-role-card">
                                    <div style="font-weight:700; font-size:14px; color:#991b1b;">${u.name}</div>
                                    <div style="font-size:11px; color:#7f1d1d;">${u.department}</div>
                                    <div style="font-size:11px; color:#4f46e5; font-weight:600; margin-top:2px;">Login ID: ${u.email}</div>
                                    <div style="font-size:11px; color:#059669; font-weight:600;">Password: <code>${u.password}</code></div>
                                    <div style="font-size:11px; color:#dc2626; margin-top:6px; font-weight:600;">Click to Auto-fill & Login →</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        } catch(e) {
            container.innerHTML = `<div style="color:red; text-align:center; padding:40px;">Error loading login page: ${e.message}</div>`;
        }
    },

    fillAndLogin(email, password, userId) {
        document.getElementById('input-login-email').value = email;
        document.getElementById('input-login-password').value = password;
        this.quickLoginUser(userId);
    },

    async submitCredentialsForm() {
        const email = document.getElementById('input-login-email').value.trim();
        const password = document.getElementById('input-login-password').value.trim();

        if (!email || !password) {
            alert('Please enter both Login ID / Email and Password.');
            return;
        }

        try {
            const res = await Api.login({ email, password });
            this.isLoggedIn = true;
            this.updateCurrentUserDisplay();
            window.location.hash = '#dashboard';
        } catch(e) {
            alert(e.error || 'Invalid Login ID or Password');
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

            this.showForwardedPopupModal(res);
        } catch (e) {
            alert('Failed to submit complaint: ' + (e.message || JSON.stringify(e)));
        }
    },

    showForwardedPopupModal(res) {
        const tickets = res.all_tickets || [res.complaint];
        const modalId = 'forwarded-popup-modal';

        let existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const firstTicket = tickets[0];
        const dept = firstTicket.department;
        const officer = firstTicket.assignedPerson;

        const modalHtml = `
            <div id="${modalId}" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;">
                <div style="background:white; max-width:650px; width:100%; border-radius:18px; padding:28px; border:1px solid #e2e8f0; box-shadow:0 20px 30px -10px rgba(0,0,0,0.2); animation:popIn 0.3s ease-out;">
                    <div style="display:flex; align-items:center; gap:14px; margin-bottom:20px; border-bottom:1px solid #f1f5f9; padding-bottom:16px;">
                        <div style="width:48px; height:48px; background:#ecfdf5; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#059669; font-size:24px; font-weight:800;">🚀</div>
                        <div>
                            <h2 style="font-size:20px; font-weight:800; color:#0f172a; margin-bottom:2px;">Complaint Forwarded Successfully!</h2>
                            <p style="font-size:13px; color:#64748b;">AI engine split your report into ${tickets.length} actionable ticket(s) and routed them to responsible admins.</p>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:12px; max-height:300px; overflow-y:auto; margin-bottom:24px;">
                        ${tickets.map(t => `
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:14px 18px; border-radius:12px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                    <span style="font-weight:800; color:#4f46e5; font-size:14px;">Ticket #${t.complaintId}</span>
                                    <span style="background:#d1fae5; color:#065f46; font-size:10px; font-weight:700; padding:3px 8px; border-radius:10px;">FORWARDED</span>
                                </div>
                                <div style="font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">"${t.complaintText}"</div>
                                <div style="display:flex; justify-content:space-between; font-size:12px; color:#475569; background:white; padding:8px 12px; border-radius:8px; border:1px solid #cbd5e1;">
                                    <div><strong>Category:</strong> ${t.category}</div>
                                    <div><strong>Forwarded To:</strong> <span style="color:#059669; font-weight:700;">${t.assignedPerson} (${t.department})</span></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="background:#fffbe8; border:1px solid #fde68a; padding:12px 16px; border-radius:10px; font-size:12px; color:#92400e; margin-bottom:24px; font-weight:600; display:flex; align-items:center; gap:8px;">
                        <span>👁️</span> <span><strong>Transparency Telemetry Active:</strong> You will see an immediate timestamped alert when <strong>${officer}</strong> opens and views this complaint.</span>
                    </div>

                    <div style="display:flex; gap:12px; justify-content:flex-end;">
                        <button class="btn-header-primary" style="padding:10px 20px; font-size:13px;" onclick="document.getElementById('${modalId}').remove(); window.location.hash='#my-complaints';">Go to My Complaints &rarr;</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
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
                        <p>Track live routing, admin view timestamps (Seen / Not Seen), and resolution timelines</p>
                    </div>
                    <a href="#submit-problem" class="btn-header-primary">+ Submit New Problem</a>
                </div>

                <div class="card">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Ticket ID</th>
                                <th>Description</th>
                                <th>Category & Location</th>
                                <th>Forwarded To Admin</th>
                                <th>Transparency (Seen Status)</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${complaints.slice(0, 20).map(c => `
                                <tr>
                                    <td><strong>${c.complaintId}</strong></td>
                                    <td style="max-width:280px; font-weight:600;">${c.complaintText}</td>
                                    <td>${c.category} <br><span style="font-size:11px; color:#6b7280;">${c.location}</span></td>
                                    <td>
                                        <strong style="color:#0f172a;">${c.assignedPerson}</strong><br>
                                        <span style="font-size:11px; color:#059669; font-weight:600;">${c.department}</span>
                                    </td>
                                    <td>
                                        ${c.seen ? 
                                            `<span style="background:#d1fae5; color:#065f46; font-size:11px; font-weight:800; padding:4px 10px; border-radius:12px; display:inline-block;">👁️ Viewed by ${c.seenBy || c.assignedPerson}</span><br><span style="font-size:10px; color:#64748b;">at ${c.seenAt}</span>` :
                                            `<span style="background:#fef3c7; color:#92400e; font-size:11px; font-weight:800; padding:4px 10px; border-radius:12px; display:inline-block;">⏳ Pending Admin Review (Not Seen)</span>`
                                        }
                                    </td>
                                    <td>
                                        <span class="tag" style="background:#e0e7ff; color:#3730a3; font-weight:700;">${c.status}</span>
                                    </td>
                                    <td>
                                        <button class="quick-action-btn" style="padding:6px 12px; font-size:12px;" onclick="app.viewTicketTimelineModal('${c.complaintId}')">Timeline & Details</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div style="color:red; padding:20px;">Error loading complaints: ${e.message}</div>`;
        }
    },

    async viewTicketTimelineModal(complaintId) {
        try {
            const data = await Api.getComplaintById(complaintId);
            const modalId = 'ticket-timeline-modal';

            let existing = document.getElementById(modalId);
            if (existing) existing.remove();

            const modalHtml = `
                <div id="${modalId}" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;">
                    <div style="background:white; max-width:650px; width:100%; border-radius:18px; padding:28px; border:1px solid #e2e8f0; box-shadow:0 20px 30px -10px rgba(0,0,0,0.2);">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; border-bottom:1px solid #f1f5f9; padding-bottom:12px;">
                            <div>
                                <h2 style="font-size:18px; font-weight:800; color:#0f172a;">Ticket Telemetry: #${data.complaintId}</h2>
                                <p style="font-size:12px; color:#64748b;">Forwarded to <strong>${data.assignedPerson} (${data.department})</strong></p>
                            </div>
                            <button onclick="document.getElementById('${modalId}').remove()" style="border:none; background:none; font-size:20px; cursor:pointer; color:#64748b;">&times;</button>
                        </div>

                        <div style="background:#f8fafc; padding:14px; border-radius:10px; font-size:13px; color:#1e293b; margin-bottom:20px; border:1px solid #e2e8f0;">
                            <strong>Description:</strong> "${data.complaintText}"<br>
                            <span style="font-size:12px; color:#64748b;">Category: ${data.category} | Location: ${data.location} | Priority: ${data.severity}</span>
                        </div>

                        <h3 style="font-size:14px; font-weight:800; color:#334155; margin-bottom:12px;">Visual Resolution Lifecycle Timeline</h3>
                        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:24px; padding-left:8px; border-left:2px solid #e0e7ff;">
                            ${data.timeline ? data.timeline.map(t => `
                                <div style="position:relative; padding-left:14px;">
                                    <div style="position:absolute; left:-21px; top:4px; width:12px; height:12px; border-radius:50%; background:${t.status === 'Seen' ? '#059669' : (t.status === 'Resolved' ? '#10b981' : '#6366f1')}; border:2px solid white;"></div>
                                    <div style="font-weight:700; font-size:13px; color:#1e293b;">${t.status} <span style="font-weight:500; font-size:11px; color:#64748b;">by ${t.updatedBy} at ${t.timestamp}</span></div>
                                    <div style="font-size:12px; color:#475569;">${t.description}</div>
                                </div>
                            `).join('') : '<div style="font-size:12px; color:#6b7280;">No timeline events recorded.</div>'}
                        </div>

                        ${data.resolutionNote ? `
                            <div style="background:#ecfdf5; border:1px solid #a7f3d0; padding:14px; border-radius:10px; font-size:12px; color:#065f46; margin-bottom:20px;">
                                <strong>Resolution Note from Admin:</strong><br>${data.resolutionNote}
                            </div>
                        ` : ''}

                        <div style="display:flex; justify-content:flex-end;">
                            <button class="quick-action-btn" onclick="document.getElementById('${modalId}').remove()">Close</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
        } catch(e) {
            alert('Failed to load ticket timeline.');
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
        const u = this.currentUser || { name: 'User', role: 'User', email: 'user@college.edu', department: 'General' };
        
        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Settings & Preferences</h1>
                    <p>Manage profile options, notification telemetry, and role-specific configurations</p>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px; max-width:950px;">
                <!-- Account Profile Card -->
                <div class="card">
                    <div style="font-weight:800; font-size:16px; color:#0f172a; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
                        <span>👤 User Account Profile</span>
                        <span class="tag" style="font-size:10px; font-weight:700; background:${u.role === 'Organization Admin' ? '#fee2e2; color:#991b1b;' : (u.role === 'Department Admin' ? '#d1fae5; color:#065f46;' : '#e0e7ff; color:#3730a3;')}">${u.role}</span>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:12px; font-size:13px;">
                        <div>
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Full Name</label>
                            <input type="text" value="${u.name}" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; outline:none; background:#f8fafc;" readonly>
                        </div>
                        <div>
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Login ID / Email</label>
                            <input type="text" value="${u.email}" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; outline:none; background:#f8fafc;" readonly>
                        </div>
                        <div>
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Department / Organization</label>
                            <input type="text" value="${u.department}" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; outline:none; background:#f8fafc;" readonly>
                        </div>
                    </div>
                </div>

                <!-- Notification & Telemetry Preferences -->
                <div class="card">
                    <div style="font-weight:800; font-size:16px; color:#0f172a; margin-bottom:16px;">🔔 Notification & Alert Telemetry</div>
                    <div style="display:flex; flex-direction:column; gap:14px; font-size:13px;">
                        <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
                            <span>Real-Time Forwarding Pop-up Alerts</span>
                            <input type="checkbox" checked style="width:18px; height:18px;">
                        </label>
                        <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
                            <span>Admin Seen Timestamp Notifications</span>
                            <input type="checkbox" checked style="width:18px; height:18px;">
                        </label>
                        <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
                            <span>Resolution Confirmation Alerts</span>
                            <input type="checkbox" checked style="width:18px; height:18px;">
                        </label>
                        <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
                            <span>Escalation SLA Warning Alerts</span>
                            <input type="checkbox" checked style="width:18px; height:18px;">
                        </label>
                    </div>
                </div>

                ${u.role !== 'User' ? `
                    <!-- Admin System Controls -->
                    <div class="card" style="grid-column: span 2;">
                        <div style="font-weight:800; font-size:16px; color:#0f172a; margin-bottom:16px;">⚙️ System SLA & Intelligence Controls (${u.role})</div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                            <div>
                                <label style="font-size:13px; font-weight:700; color:#334155;">AI Match Similarity Threshold (75%)</label>
                                <input type="range" min="50" max="95" value="75" style="width:100%; margin-top:8px;">
                            </div>
                            <div>
                                <label style="font-size:13px; font-weight:700; color:#334155;">SLA Response Window</label>
                                <select style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; margin-top:6px;">
                                    <option>24 Hours (Standard)</option>
                                    <option>12 Hours (High Priority)</option>
                                    <option>48 Hours (Low Priority)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>

            <div style="margin-top:20px;">
                <button class="btn-header-primary" style="padding:12px 28px; font-size:14px;" onclick="alert('Settings saved successfully!')">Save Preferences</button>
            </div>
        `;
    }

};

document.addEventListener('DOMContentLoaded', () => app.init());
