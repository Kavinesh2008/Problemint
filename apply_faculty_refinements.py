#!/usr/bin/env python3
"""
apply_faculty_refinements.py
Comprehensive patch implementing all faculty review requirements:
1. Landing page and login navigation flow (strictly requiring login for protected pages)
2. Removal of Knowledge Base module from all user-facing UI
3. Fixed Change Password with clear requirements (8+ chars, letters and numbers)
4. Dedicated full-page AI Assistant view (#ai-assistant)
5. Pre-submission AI assistance with "Did this solve your problem?" self-service option
6. Clean navigation for Regular Users (Home, Report a Problem, My Problems, AI Assistant, Settings)
"""

# =============================================================================
# 1. UPDATE index.html
# =============================================================================
html = open('index.html', encoding='utf-8').read()

# Replace any user-facing "knowledge base" text on public landing page
html = html.replace('Instant solutions from knowledge base', 'Instant solutions from verified previous fixes')
html = html.replace('Our AI checks the Knowledge Base and suggests solutions that have worked before.',
                    'Our AI checks verified previous resolutions and suggests safe solutions that worked before.')
html = html.replace('Before submitting, get instant suggestions from our Knowledge Base. Many problems can be solved immediately without waiting.',
                    'Before submitting, get instant suggestions from verified previous solutions. Many common issues can be solved immediately without waiting.')

# Replace knowledge base nav item in sidebar with AI Assistant
kb_nav_snippet = """<a href="#knowledge-base" class="nav-item" data-view="knowledge-base">
                    <svg class="nav-icon" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                    <span>Help & Solutions</span>
                </a>"""

ai_nav_snippet = """<a href="#ai-assistant" class="nav-item" data-view="ai-assistant" id="nav-ai-assistant">
                    <svg class="nav-icon" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    <span>AI Assistant</span>
                </a>"""

if kb_nav_snippet in html:
    html = html.replace(kb_nav_snippet, ai_nav_snippet)
    print("Replaced knowledge-base nav item with AI Assistant in index.html.")

# Footer help link
html = html.replace('<a href="#knowledge-base">', '<a href="#ai-assistant">')

# Make sure hero and CTA buttons call app.handleReportProblemClick()
html = html.replace('<button class="hero-primary-btn" onclick="app.showRoleSelection()">',
                    '<button class="hero-primary-btn" onclick="app.handleReportProblemClick()">')
html = html.replace('<button class="cta-main-btn" onclick="app.showRoleSelection()">',
                    '<button class="cta-main-btn" onclick="app.handleReportProblemClick()">')

open('index.html', 'w', encoding='utf-8').write(html)
print("Updated index.html successfully.")


# =============================================================================
# 2. UPDATE js/app.js
# =============================================================================
js = open('js/app.js', encoding='utf-8').read()

# Update applyRoleNavigationVisibility to remove knowledge-base and add ai-assistant
old_nav_vis_start = '    applyRoleNavigationVisibility(role) {'
idx_nav_vis = js.find(old_nav_vis_start)
idx_user_display = js.find('    async updateCurrentUserDisplay() {')

new_nav_vis = r'''    applyRoleNavigationVisibility(role) {
        // Regular User Navigation: Home, Report a Problem, My Problems, AI Assistant, Settings
        const userViews      = ['home', 'submit-problem', 'my-complaints', 'ai-assistant', 'settings'];
        const deptAdminViews = ['home', 'dashboard', 'my-complaints', 'incidents', 'prevention-center', 'ai-assistant', 'settings'];
        const orgAdminViews  = ['home', 'dashboard', 'submit-problem', 'my-complaints', 'incidents',
                                'problem-intelligence', 'emerging-problems',
                                'prevention-center', 'analytics', 'admin-users', 'ai-assistant', 'settings'];

        let allowed;
        if (role === 'Organization Admin') allowed = orgAdminViews;
        else if (role === 'Department Admin') allowed = deptAdminViews;
        else allowed = userViews;

        document.querySelectorAll('.nav-item').forEach(item => {
            const view = item.getAttribute('data-view');
            if (view) {
                item.style.display = allowed.includes(view) ? 'flex' : 'none';
            }
        });

        // Show/hide admin-specific links
        const adminUsersNav = document.getElementById('nav-item-admin-users');
        if (adminUsersNav) adminUsersNav.style.display = role === 'Organization Admin' ? 'flex' : 'none';

        // Update suggested queries based on role
        const suggestions = document.getElementById('copilot-suggestions');
        if (suggestions) {
            if (role === 'User') {
                suggestions.innerHTML = `
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('Help me report a problem.')">Help me report a problem &rarr;</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('Where is my complaint?')">Where is my complaint? &rarr;</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('Who is handling my problem?')">Who is handling my problem? &rarr;</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('What should I do if my issue isn\\'t resolved?')">Issue not resolved? &rarr;</button>
                `;
            } else if (role === 'Department Admin') {
                suggestions.innerHTML = `
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('How many unacknowledged complaints do I have?')">My pending queue &rarr;</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('Which complaints are overdue SLA?')">SLA overdue tickets &rarr;</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('Show recent incidents in my department')">Department incidents &rarr;</button>
                `;
            } else {
                suggestions.innerHTML = `
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('Show all escalated complaints')">Escalations radar &rarr;</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('Which department has the highest workload?')">Department workload &rarr;</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('Show active recurring incidents across campus')">Recurring incidents &rarr;</button>
                `;
            }
        }
    },
'''

if idx_nav_vis != -1 and idx_user_display != -1:
    js = js[:idx_nav_vis] + new_nav_vis + js[idx_user_display:]
    print("Updated applyRoleNavigationVisibility in app.js.")
else:
    print("WARNING: applyRoleNavigationVisibility boundaries not found.")


# Update handleHashChange to handle ai-assistant, redirect knowledge-base, and enforce security
old_hash_start = '    handleHashChange() {'
idx_hash_start = js.find(old_hash_start)
old_hash_end_marker = '    updateActiveNav(viewName) {'
idx_hash_end = js.find(old_hash_end_marker)

new_hash_method = r'''    handleHashChange() {
        let hash = window.location.hash.replace('#', '').trim();

        // 1. If hash is empty, or explicitly public views: ALWAYS show the public homepage!
        if (!hash || hash === 'landing' || hash === 'public' || hash === 'about' || hash === 'how-it-works-section' || hash === 'features-section' || hash === 'trust-section') {
            this.showPublicHome();
            return;
        }

        // 2. If user specifically navigated to login / role selection:
        if (hash === 'login' || hash === 'roles' || hash === 'signin') {
            if (this.isLoggedIn) {
                const role = this.currentUser?.role;
                const isAdmin = role === 'Department Admin' || role === 'Organization Admin';
                window.location.hash = isAdmin ? '#dashboard' : '#home';
                return;
            }
            this.showRoleSelection();
            return;
        }

        // 3. For any protected application view:
        // REQUIRE AUTHENTICATION!
        if (!this.isLoggedIn) {
            this._postLoginHash = '#' + hash;
            this.showRoleSelection(this._postLoginHash);
            return;
        }

        // 4. Safely redirect removed Knowledge Base to home
        if (hash === 'knowledge-base') {
            window.location.hash = '#home';
            return;
        }

        // 5. Restrict ordinary users from accessing administrator pages
        const isAdmin = this.currentUser?.role === 'Department Admin' || this.currentUser?.role === 'Organization Admin';
        const adminOnlyViews = ['dashboard', 'incidents', 'problem-intelligence', 'emerging-problems', 'prevention-center', 'analytics', 'admin-users'];
        if (!isAdmin && adminOnlyViews.includes(hash.split('/')[0])) {
            alert('Access Restricted: Administrator pages are only accessible to authorized department and college administrators.');
            window.location.hash = '#home';
            return;
        }

        // Restrict non-org-admins from user account management
        if (this.currentUser?.role !== 'Organization Admin' && hash === 'admin-users') {
            alert('Access Restricted: Only College Administrators can manage user accounts.');
            window.location.hash = '#home';
            return;
        }

        // Authenticated & authorized: show application layout
        this.showAppLayout();

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
            case 'home':
                this.renderUserHome(container);
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
            case 'ai-assistant':
                this.renderAiAssistant(container);
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
            case 'prevention-center':
                this.renderPreventionCenter(container);
                break;
            case 'analytics':
                this.renderAnalytics(container);
                break;
            case 'admin-users':
                this.renderAdminUsers(container);
                break;
            case 'settings':
                this.renderSettings(container);
                break;
            default:
                this.renderUserHome(container);
        }
    },
'''

if idx_hash_start != -1 and idx_hash_end != -1:
    js = js[:idx_hash_start] + new_hash_method + js[idx_hash_end:]
    print("Updated handleHashChange in app.js with security checks.")


# Add renderAiAssistant and sendAiPageQuery methods
ai_assistant_methods = r'''
    // ==========================================
    // AI ASSISTANT FULL-PAGE CONVERSATIONAL VIEW
    // ==========================================
    async renderAiAssistant(container) {
        const me = this.currentUser;
        const role = me?.role || 'User';
        const isAdmin = role === 'Department Admin' || role === 'Organization Admin';

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>PROBLEMINT AI Assistant</h1>
                    <p>Conversational Institutional Problem Intelligence — Track complaints, explore verified solutions, and check live departmental routing</p>
                </div>
                <button class="quick-action-btn" onclick="app.clearAiPageChat()" style="color:#ef4444; border-color:#fca5a5;">Clear Chat</button>
            </div>

            <div style="max-width:880px; margin:0 auto; display:flex; flex-direction:column; height:calc(100vh - 210px); background:white; border:1px solid #e2e8f0; border-radius:18px; box-shadow:0 4px 20px rgba(0,0,0,0.04); overflow:hidden;">
                <!-- Chat message history -->
                <div id="ai-page-chat-history" style="flex:1; overflow-y:auto; padding:24px; display:flex; flex-direction:column; gap:16px;">
                    <!-- Initial Welcome Message from Assistant -->
                    <div style="display:flex; gap:12px; align-items:flex-start;">
                        <div style="width:36px; height:36px; border-radius:10px; background:#eef2ff; color:#4f46e5; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-weight:800; font-size:14px;">AI</div>
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:16px 20px; border-radius:14px; max-width:85%; font-size:14px; line-height:1.6; color:#1e293b;">
                            <p style="margin-bottom:8px; font-weight:700;">Hi! I'm your PROBLEMINT assistant. I can help you report a problem, check its progress or find a possible solution.</p>
                            <p style="color:#64748b; font-size:13px; margin:0;">Feel free to ask about your submitted tickets, responsible departments, SLA response deadlines, or campus solutions.</p>
                        </div>
                    </div>
                </div>

                <!-- Suggested Questions Panel -->
                <div style="padding:12px 20px; background:#f8fafc; border-top:1px solid #f1f5f9; display:flex; gap:8px; overflow-x:auto; flex-wrap:wrap; align-items:center;">
                    <span style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Suggested:</span>
                    ${!isAdmin ? `
                        <button class="quick-action-btn" style="font-size:12px; padding:6px 12px;" onclick="app.sendAiPageQuery('Help me report a problem.')">Help me report a problem &rarr;</button>
                        <button class="quick-action-btn" style="font-size:12px; padding:6px 12px;" onclick="app.sendAiPageQuery('Where is my complaint?')">Where is my complaint? &rarr;</button>
                        <button class="quick-action-btn" style="font-size:12px; padding:6px 12px;" onclick="app.sendAiPageQuery('Who is handling my problem?')">Who is handling my problem? &rarr;</button>
                        <button class="quick-action-btn" style="font-size:12px; padding:6px 12px;" onclick="app.sendAiPageQuery('What should I do if my issue isn\\'t resolved?')">Issue not resolved? &rarr;</button>
                    ` : `
                        <button class="quick-action-btn" style="font-size:12px; padding:6px 12px;" onclick="app.sendAiPageQuery('How many unacknowledged complaints do I have?')">My pending queue &rarr;</button>
                        <button class="quick-action-btn" style="font-size:12px; padding:6px 12px;" onclick="app.sendAiPageQuery('Which complaints are overdue SLA?')">SLA overdue tickets &rarr;</button>
                        <button class="quick-action-btn" style="font-size:12px; padding:6px 12px;" onclick="app.sendAiPageQuery('Show active recurring incidents across campus')">Recurring incidents &rarr;</button>
                        <button class="quick-action-btn" style="font-size:12px; padding:6px 12px;" onclick="app.sendAiPageQuery('Which department has the highest workload?')">Department workload &rarr;</button>
                    `}
                </div>

                <!-- Chat Input Bar -->
                <div style="padding:16px 20px; background:white; border-top:1px solid #e2e8f0; display:flex; gap:10px; align-items:center;">
                    <input type="text" id="ai-page-input" placeholder="Type your question here (e.g., Where is my Wi-Fi ticket?)..." style="flex:1; padding:12px 18px; border-radius:24px; border:1.5px solid #cbd5e1; outline:none; font-size:14px; font-family:inherit;" onkeydown="if(event.key === 'Enter') app.submitAiPageMessage()">
                    <button class="btn-header-primary" style="padding:12px 22px; border-radius:24px;" onclick="app.submitAiPageMessage()">
                        <span>Send</span>
                        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                    </button>
                </div>
            </div>
        `;
    },

    clearAiPageChat() {
        const history = document.getElementById('ai-page-chat-history');
        if (history) {
            history.innerHTML = `
                <div style="display:flex; gap:12px; align-items:flex-start;">
                    <div style="width:36px; height:36px; border-radius:10px; background:#eef2ff; color:#4f46e5; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-weight:800; font-size:14px;">AI</div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:16px 20px; border-radius:14px; max-width:85%; font-size:14px; line-height:1.6; color:#1e293b;">
                        <p style="margin-bottom:8px; font-weight:700;">Hi! I'm your PROBLEMINT assistant. I can help you report a problem, check its progress or find a possible solution.</p>
                        <p style="color:#64748b; font-size:13px; margin:0;">Feel free to ask about your submitted tickets, responsible departments, SLA response deadlines, or campus solutions.</p>
                    </div>
                </div>
            `;
        }
    },

    sendAiPageQuery(query) {
        const input = document.getElementById('ai-page-input');
        if (input) {
            input.value = query;
            this.submitAiPageMessage();
        }
    },

    async submitAiPageMessage() {
        const input = document.getElementById('ai-page-input');
        const history = document.getElementById('ai-page-chat-history');
        if (!input || !history) return;

        const text = input.value.trim();
        if (!text) return;
        input.value = '';

        // Add user bubble
        const userDiv = document.createElement('div');
        userDiv.style.cssText = "display:flex; justify-content:flex-end;";
        userDiv.innerHTML = `
            <div style="background:linear-gradient(135deg, #6366f1, #4f46e5); color:white; padding:12px 18px; border-radius:16px 16px 4px 16px; max-width:80%; font-size:14px; line-height:1.5;">
                ${this.escapeHtml(text)}
            </div>
        `;
        history.appendChild(userDiv);

        // Add loading placeholder
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'ai-page-loading';
        loadingDiv.style.cssText = "display:flex; gap:12px; align-items:flex-start;";
        loadingDiv.innerHTML = `
            <div style="width:36px; height:36px; border-radius:10px; background:#eef2ff; color:#4f46e5; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-weight:800; font-size:14px;">AI</div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px 18px; border-radius:14px; font-size:13px; color:#64748b;">
                Analyzing campus records...
            </div>
        `;
        history.appendChild(loadingDiv);
        history.scrollTop = history.scrollHeight;

        try {
            const res = await Api.askCopilot(text);
            loadingDiv.remove();

            const aiDiv = document.createElement('div');
            aiDiv.style.cssText = "display:flex; gap:12px; align-items:flex-start;";
            aiDiv.innerHTML = `
                <div style="width:36px; height:36px; border-radius:10px; background:#eef2ff; color:#4f46e5; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-weight:800; font-size:14px;">AI</div>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:16px 20px; border-radius:14px; max-width:85%; font-size:14px; line-height:1.6; color:#1e293b;">
                    ${this.formatCopilotMarkdown(res.answer || 'I could not find matching records for that query.')}
                </div>
            `;
            history.appendChild(aiDiv);
            history.scrollTop = history.scrollHeight;
        } catch (e) {
            loadingDiv.remove();
            const errDiv = document.createElement('div');
            errDiv.style.cssText = "display:flex; gap:12px; align-items:flex-start;";
            errDiv.innerHTML = `
                <div style="width:36px; height:36px; border-radius:10px; background:#fee2e2; color:#dc2626; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-weight:800;">!</div>
                <div style="background:#fef2f2; border:1px solid #fca5a5; padding:12px 18px; border-radius:14px; font-size:13px; color:#dc2626;">
                    Error connecting to assistant: ${e.message || 'Please check connection.'}
                </div>
            `;
            history.appendChild(errDiv);
            history.scrollTop = history.scrollHeight;
        }
    },
'''

# Place renderAiAssistant before renderIncidents
idx_incidents = js.find('    // ==========================================\n    // 3. INCIDENTS VIEW')
if idx_incidents != -1:
    js = js[:idx_incidents] + ai_assistant_methods + js[idx_incidents:]
    print("Added renderAiAssistant methods to app.js.")
else:
    print("WARNING: renderIncidents marker not found.")


# Update renderSubmitProblem to include pre-troubleshoot check and self-service option
old_submit_start = '    renderSubmitProblem(container) {'
idx_submit_start = js.find(old_submit_start)
idx_analyze_stage = js.find('    async handleAnalyzeAndReviewStage() {')

new_submit_flow = r'''    renderSubmitProblem(container) {
        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Report an Institutional Problem</h1>
                    <p>Describe your issue naturally. PROBLEMINT will check for instant self-help solutions before routing your ticket to the authorized department.</p>
                </div>
            </div>

            <div style="max-width:860px; margin:0 auto; display:flex; flex-direction:column; gap:20px;">
                <!-- Step 1: Input Card -->
                <div class="card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <label style="font-weight:700; font-size:14px; color:#1e293b;">1. Describe the problem you are facing:</label>
                        <span style="font-size:12px; color:#64748b;">Natural Language Supported</span>
                    </div>
                    <textarea id="user-problem-input" rows="4" style="width:100%; padding:14px; border-radius:12px; border:1.5px solid #cbd5e1; outline:none; font-size:14px; line-height:1.5; font-family:inherit;" placeholder="Example: The Wi-Fi in Block C is not working and disconnecting constantly. Also water purifier on 3rd floor is leaking."></textarea>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; flex-wrap:wrap; gap:10px;">
                        <span style="font-size:12px; color:#64748b;">💡 Single or multi-problem compound descriptions are automatically handled.</span>
                        <div style="display:flex; gap:10px;">
                            <button id="btn-pre-check" class="btn-header-primary" style="padding:10px 20px; background:#4f46e5;" onclick="app.handlePreTroubleshoot()">
                                Check Solutions &rarr;
                            </button>
                            <button class="quick-action-btn" style="padding:10px 18px;" onclick="app.handleAnalyzeAndReviewStage()">
                                Skip to Formal Submission
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Step 2: Instant Pre-Check & Self-Help Guidance Panel -->
                <div id="pre-troubleshoot-panel" class="card hidden" style="border:1.5px solid #a5b4fc; background:#fafafa;"></div>

                <!-- Step 3: Multi-Issue Detection & Card Review Stage -->
                <div id="multi-issue-stage-container" class="card hidden" style="border:1.5px solid #cbd5e1;"></div>
            </div>
        `;
    },

    async handlePreTroubleshoot() {
        const text = document.getElementById('user-problem-input')?.value?.trim();
        if (!text) {
            alert('Please describe your problem first.');
            return;
        }

        const panel = document.getElementById('pre-troubleshoot-panel');
        if (!panel) return;
        panel.classList.remove('hidden');
        panel.innerHTML = `<div style="text-align:center; padding:20px; color:#64748b;">Checking safety hazards and verified previous solutions...</div>`;

        try {
            const data = await Api.preTroubleshoot({ text });
            const warnings = data.safetyWarnings || (data.safetyWarning ? [data.safetyWarning] : []);
            const checklist = data.selfServiceChecklist || data.stepChecklist || [];
            const matches = data.kbMatches || data.matchedSolutions || [];

            let html = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
                    <div>
                        <div style="font-size:15px; font-weight:800; color:#1e293b;">Here are a few safe steps you can try:</div>
                        <div style="font-size:12px; color:#64748b;">Verified previous resolutions from our campus technical history</div>
                    </div>
                    <button onclick="document.getElementById('pre-troubleshoot-panel').classList.add('hidden')" style="background:none; border:none; font-size:18px; cursor:pointer; color:#94a3b8;">&times;</button>
                </div>
            `;

            // Safety Warning if present
            if (warnings.length > 0) {
                html += `
                    <div style="background:#fef2f2; border:1.5px solid #fca5a5; padding:14px 16px; border-radius:10px; color:#991b1b; font-size:13px; font-weight:700; margin-bottom:16px;">
                        ${warnings.join('<br>')}
                        <div style="font-size:12px; font-weight:500; margin-top:4px;">Do NOT attempt DIY repair. Proceed directly to formal submission so authorized emergency staff are notified.</div>
                    </div>
                `;
            }

            // Troubleshooting Steps Checklist
            if (checklist.length > 0) {
                html += `
                    <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:14px; margin-bottom:14px;">
                        <div style="font-weight:700; font-size:13px; color:#334155; margin-bottom:8px;">Suggested Actions:</div>
                        <ul style="padding-left:20px; font-size:13px; color:#475569; display:flex; flex-direction:column; gap:6px;">
                            ${checklist.map(step => `<li>${step}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }

            // Previous Solutions Matched
            if (matches.length > 0) {
                html += `
                    <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:14px; margin-bottom:16px;">
                        <div style="font-weight:700; font-size:13px; color:#334155; margin-bottom:8px;">Previous Solution that Worked:</div>
                        ${matches.map(m => `
                            <div style="font-size:12.5px; color:#334155; line-height:1.5;">
                                <strong>Problem:</strong> ${m.problemDescription || m.problemType}<br>
                                <span style="color:#059669; font-weight:600;">Solution: ${m.successfulSolution}</span>
                            </div>
                        `).join('<hr style="border:none; border-top:1px solid #f1f5f9; margin:8px 0;">')}
                    </div>
                `;
            }

            // Ask: Did this solve your problem?
            html += `
                <div style="background:#eef2ff; border:1px solid #c7d2fe; border-radius:12px; padding:16px; text-align:center;">
                    <div style="font-weight:800; font-size:14px; color:#1e1b4b; margin-bottom:6px;">Did this solve your problem?</div>
                    <div style="font-size:12px; color:#4338ca; margin-bottom:12px;">If you resolved the issue, let us know! Otherwise, continue to formal submission.</div>
                    <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
                        <button class="btn-header-primary" style="background:#059669; padding:8px 20px; font-size:13px;" onclick="app.handleSelfResolved()">
                            ✓ Yes, Problem Solved
                        </button>
                        <button class="btn-header-primary" style="background:#4f46e5; padding:8px 20px; font-size:13px;" onclick="app.handleAnalyzeAndReviewStage()">
                            No, Submit My Problem &rarr;
                        </button>
                    </div>
                </div>
            `;

            panel.innerHTML = html;
        } catch (e) {
            panel.innerHTML = `<div style="color:#ef4444; padding:14px;">Error checking solutions: ${e.message}</div>`;
        }
    },

    async handleSelfResolved() {
        const text = document.getElementById('user-problem-input')?.value?.trim() || 'General campus issue';
        try {
            await Api.logSelfServiceResolved({
                problemType: text.slice(0, 50),
                location: 'Campus',
                solutionUsed: 'Self-service troubleshooting checklist'
            });
            const panel = document.getElementById('pre-troubleshoot-panel');
            if (panel) {
                panel.innerHTML = `
                    <div style="text-align:center; padding:24px; background:#ecfdf5; border-radius:12px; border:1px solid #a7f3d0; color:#065f46;">
                        <div style="font-size:32px; margin-bottom:8px;">🎉</div>
                        <div style="font-weight:800; font-size:16px;">Great job! Problem Solved.</div>
                        <p style="font-size:13px; margin:6px auto 14px; max-width:440px;">Your self-service resolution has been logged. This helps improve institutional intelligence and avoids unnecessary staff dispatches.</p>
                        <button class="btn-header-primary" style="background:#059669; padding:8px 18px;" onclick="window.location.hash='#home'">
                            Return to Home
                        </button>
                    </div>
                `;
            }
            const input = document.getElementById('user-problem-input');
            if (input) input.value = '';
        } catch(e) {
            alert('Self-service recorded: Thank you!');
            window.location.hash = '#home';
        }
    },
'''

if idx_submit_start != -1 and idx_analyze_stage != -1:
    js = js[:idx_submit_start] + new_submit_flow + js[idx_analyze_stage:]
    print("Updated renderSubmitProblem and added handlePreTroubleshoot in app.js.")
else:
    print("WARNING: renderSubmitProblem boundaries not found.")


# Update handleChangePassword in app.js
old_change_pw_start = '    async handleChangePassword() {'
idx_cpw_start = js.find(old_change_pw_start)
idx_cpw_end = js.find('    filterAdminUsersTable() {')

new_change_pw = r'''    async handleChangePassword() {
        const current = document.getElementById('pwd-current')?.value?.trim();
        const newPwd = document.getElementById('pwd-new')?.value?.trim();
        const confirm = document.getElementById('pwd-confirm')?.value?.trim();
        const banner = document.getElementById('pwd-change-banner');

        const showBanner = (msg, success) => {
            if (!banner) return;
            banner.style.background = success ? '#ecfdf5' : '#fef2f2';
            banner.style.color = success ? '#065f46' : '#dc2626';
            banner.style.border = `1px solid ${success ? '#a7f3d0' : '#fca5a5'}`;
            banner.textContent = msg;
            banner.style.display = 'block';
        };

        if (!current || !newPwd || !confirm) {
            showBanner('Please fill out all fields: Current Password, New Password, and Confirm Password.', false);
            return;
        }
        if (newPwd !== confirm) {
            showBanner('New password and confirmation do not match.', false);
            return;
        }
        const hasLetter = /[a-zA-Z]/.test(newPwd);
        const hasNumber = /[0-9]/.test(newPwd);
        if (newPwd.length < 8 || !hasLetter || !hasNumber) {
            showBanner('Password requirement: Use at least 8 characters, including letters and numbers (e.g. College2026, Student12345).', false);
            return;
        }

        try {
            const res = await Api.changePassword({
                currentPassword: current,
                newPassword: newPwd,
                confirmPassword: confirm
            });
            showBanner('✓ ' + (res.message || 'Password changed successfully! Your new password is now active.'), true);
            if (document.getElementById('pwd-current')) document.getElementById('pwd-current').value = '';
            if (document.getElementById('pwd-new')) document.getElementById('pwd-new').value = '';
            if (document.getElementById('pwd-confirm')) document.getElementById('pwd-confirm').value = '';
        } catch (e) {
            showBanner('Error: ' + (e.error || e.message || 'Could not update password. Please check your current password.'), false);
        }
    },
'''

if idx_cpw_start != -1 and idx_cpw_end != -1:
    js = js[:idx_cpw_start] + new_change_pw + js[idx_cpw_end:]
    print("Updated handleChangePassword in app.js.")
else:
    print("WARNING: handleChangePassword boundaries not found.")


# Update password form requirement helper text in renderSettings
old_settings_pw_card = """                            <div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">New Password:</label>
                                <input type="password" id="pwd-new" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; outline:none; font-size:14px; font-family:inherit;" placeholder="Min 8 characters">
                            </div>"""

new_settings_pw_card = """                            <div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">New Password:</label>
                                <input type="password" id="pwd-new" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; outline:none; font-size:14px; font-family:inherit;" placeholder="e.g. College2026">
                                <div style="font-size:11.5px; color:#64748b; margin-top:3px;">Requirement: Use at least 8 characters, including letters and numbers (e.g. College2026, Student12345).</div>
                            </div>"""

if old_settings_pw_card in js:
    js = js.replace(old_settings_pw_card, new_settings_pw_card, 1)
    print("Updated password requirement text in renderSettings.")

# Update user home quick help topic onclicks to open AI assistant or fill problem box
js = js.replace('onclick="window.location.hash=\'#knowledge-base\'"', 'onclick="app.startProblemFromHome()"')

open('js/app.js', 'w', encoding='utf-8').write(js)
print("Updated js/app.js successfully!")
