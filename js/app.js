// PROBLEMINT Frontend Application Router & View Renderer
const app = {
    currentView: 'home',
    isLoggedIn: false,
    currentUser: null,
    currentDetectedIssues: [],
    selectedRole: null,
    _postLoginHash: null,

    async init() {
        this.setupLoginFormListeners();
        window.addEventListener('hashchange', () => this.handleHashChange());

        try {
            const res = await fetch('/api/check-auth');
            if (res.ok) {
                const data = await res.json();
                if (data.authenticated && data.user) {
                    this.isLoggedIn = true;
                    this.currentUser = data.user;
                    this.bindNavigation();
                    this.bindCopilot();
                    this.bindNotifications();
                    this.updatePublicNavForAuth(data.user);
                }
            }
        } catch (e) { /* not authenticated */ }

        // Route to the appropriate view (defaults to public landing page if no app hash is specified)
        this.handleHashChange();
    },

    // ---- Layout switching ----

    showPublicHome() {
        document.getElementById('public-home')?.classList.remove('hidden');
        document.getElementById('auth-layout')?.classList.add('hidden');
        document.getElementById('app-container')?.classList.add('hidden');
        if (this.isLoggedIn && this.currentUser) {
            this.updatePublicNavForAuth(this.currentUser);
        }
        window.scrollTo(0, 0);
    },

    handleReportProblemClick() {
        if (this.isLoggedIn) {
            this.showAppLayout();
            window.location.hash = '#submit-problem';
        } else {
            this.showRoleSelection('#submit-problem');
        }
    },

    goToPortal() {
        if (this.isLoggedIn) {
            const role = this.currentUser?.role;
            const isAdmin = role === 'Department Admin' || role === 'Organization Admin';
            this.showAppLayout();
            window.location.hash = isAdmin ? '#dashboard' : '#home';
        } else {
            this.showRoleSelection();
        }
    },

    updatePublicNavForAuth(user) {
        const container = document.getElementById('pub-nav-auth-buttons');
        if (!container) return;
        if (user) {
            container.innerHTML = `
                <button class="pub-signin-btn" onclick="app.goToPortal()">Go to Portal &rarr;</button>
                <button class="pub-cta-btn" onclick="app.handleReportProblemClick()">Report a Problem</button>
                <button class="pub-signin-btn" style="color:#ef4444; border-color:#fca5a5; background:#fef2f2;" onclick="app.logout()">Sign Out</button>
            `;
        } else {
            container.innerHTML = `
                <button class="pub-signin-btn" onclick="app.showRoleSelection()">Sign In</button>
                <button class="pub-cta-btn" onclick="app.handleReportProblemClick()">Report a Problem</button>
            `;
        }
    },

    showRoleSelection(postLoginHash) {
        if (postLoginHash) this._postLoginHash = postLoginHash;
        document.getElementById('public-home').classList.add('hidden');
        document.getElementById('auth-layout').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('role-selection-view').classList.remove('hidden');
        document.getElementById('login-form-view').classList.add('hidden');
        // Reset any prior selection
        this.selectedRole = null;
    },

    selectRole(roleLabel, emoji, roleKey) {
        this.selectedRole = { label: roleLabel, emoji, key: roleKey };
        document.getElementById('role-selection-view').classList.add('hidden');
        document.getElementById('login-form-view').classList.remove('hidden');

        const badge = document.getElementById('selected-role-badge');
        const roleEmoji = document.getElementById('selected-role-emoji');
        const roleName = document.getElementById('selected-role-name');
        const loginTitle = document.getElementById('login-title');
        if (badge) badge.classList.remove('hidden');
        if (roleEmoji) roleEmoji.textContent = emoji;
        if (roleName) roleName.textContent = roleLabel + ' Sign In';
        if (loginTitle) loginTitle.textContent = roleLabel + ' Sign In';

        setTimeout(() => {
            const emailEl = document.getElementById('auth-email');
            if (emailEl) emailEl.focus();
        }, 50);
    },

    showAuthLayout() {
        // Legacy method — now shows role selection
        this.showRoleSelection();
    },

    showAppLayout() {
        document.getElementById('public-home').classList.add('hidden');
        document.getElementById('auth-layout').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        this.updateCurrentUserDisplay();
    },

    toggleMobileMenu() {
        document.getElementById('pub-mobile-menu')?.classList.toggle('hidden');
    },

    toggleSidebar() {
        document.getElementById('app-sidebar')?.classList.toggle('open');
    },

    // ---- Login form ----

    setupLoginFormListeners() {
        const pwToggle = document.getElementById('pw-toggle-btn');
        const pwInput  = document.getElementById('auth-password');
        const showIcon = document.getElementById('pw-show-icon');
        const hideIcon = document.getElementById('pw-hide-icon');

        if (pwToggle && pwInput) {
            pwToggle.addEventListener('click', () => {
                const isPassword = pwInput.type === 'password';
                pwInput.type = isPassword ? 'text' : 'password';
                showIcon.classList.toggle('hidden', isPassword);
                hideIcon.classList.toggle('hidden', !isPassword);
            });
        }

        if (pwInput) {
            pwInput.addEventListener('keyup', (e) => {
                const capsWarning = document.getElementById('capslock-warning');
                if (capsWarning) {
                    capsWarning.classList.toggle('hidden', !e.getModifierState('CapsLock'));
                }
            });
        }

        const emailInput = document.getElementById('auth-email');
        if (emailInput) {
            emailInput.addEventListener('blur', () => {
                const emailErr = document.getElementById('email-error');
                if (emailErr) {
                    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim());
                    emailErr.classList.toggle('hidden', valid || !emailInput.value.trim());
                }
            });
            emailInput.addEventListener('input', () => {
                document.getElementById('auth-error-banner')?.classList.add('hidden');
            });
        }

        if (pwInput) {
            pwInput.addEventListener('input', () => {
                document.getElementById('auth-error-banner')?.classList.add('hidden');
            });
        }

        const form = document.getElementById('login-form');
        if (form) {
            form.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); this.handleLogin(); }
            });
        }
    },

    async handleLogin() {
        const emailInput = document.getElementById('auth-email');
        const pwInput    = document.getElementById('auth-password');
        const submitBtn  = document.getElementById('auth-submit-btn');
        const btnText    = document.getElementById('auth-btn-text');
        const spinner    = document.getElementById('auth-btn-spinner');
        const errorBanner = document.getElementById('auth-error-banner');
        const errorText   = document.getElementById('auth-error-text');

        if (!emailInput || !pwInput) return;

        const email    = emailInput.value.trim();
        const password = pwInput.value;

        if (!email || !password) {
            errorText.textContent = 'Please enter your email and password.';
            errorBanner.classList.remove('hidden');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errorText.textContent = 'Please enter a valid institutional email address.';
            errorBanner.classList.remove('hidden');
            return;
        }

        submitBtn.disabled = true;
        btnText.classList.add('hidden');
        spinner.classList.remove('hidden');
        errorBanner.classList.add('hidden');

        try {
            const res = await Api.login({ email, password });
            if (res && res.user) {
                this.isLoggedIn = true;
                this.currentUser = res.user;

                // Check role mismatch notice
                const actualRole = res.user.role;
                const sel = this.selectedRole?.key;
                const isAdminSelected = sel === 'dept-admin' || sel === 'org-admin';
                const isActuallyAdmin = actualRole === 'Department Admin' || actualRole === 'Organization Admin';
                if (isAdminSelected && !isActuallyAdmin) {
                    const notice = document.getElementById('role-mismatch-notice');
                    if (notice) {
                        notice.textContent = `Authenticated as "${res.user.name}" (${actualRole}). Account role applied securely.`;
                        notice.classList.remove('hidden');
                    }
                }

                this.showAppLayout();
                this.bindNavigation();
                this.bindCopilot();
                this.bindNotifications();
                window.addEventListener('hashchange', () => this.handleHashChange());

                const dest = this._postLoginHash || (isActuallyAdmin ? '#dashboard' : '#home');
                this._postLoginHash = null;
                window.location.hash = dest;
                this.handleHashChange();
            } else {
                throw new Error('Unexpected response');
            }
        } catch (err) {
            errorText.textContent = err.error || 'Incorrect email or password. Please try again.';
            errorBanner.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
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
        const clearBtn = document.getElementById('copilot-clear-btn');
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
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                const chat = document.getElementById('copilot-chat-history');
                if (chat) chat.innerHTML = '';
            });
        }

        const handleSend = async () => {
            const query = input.value.trim();
            if (!query) return;

            const chat = document.getElementById('copilot-chat-history');
            chat.innerHTML += `
                <div class="user-msg" style="align-self:flex-end; background:#4f46e5; color:white; padding:10px 14px; border-radius:12px; font-size:13px; margin-top:8px; max-width:85%; word-break:break-word;">
                    ${query}
                </div>
            `;
            input.value = '';
            chat.scrollTop = chat.scrollHeight;

            // Loading bubble
            const loadingBubble = document.createElement('div');
            loadingBubble.className = 'ai-msg';
            loadingBubble.style = "background:#f1f5f9; color:#64748b; padding:10px 14px; border-radius:12px; font-size:12px; margin-top:8px; font-style:italic;";
            loadingBubble.textContent = "Querying PROBLEMINT database...";
            chat.appendChild(loadingBubble);
            chat.scrollTop = chat.scrollHeight;

            try {
                const res = await Api.askCopilot(query);
                loadingBubble.remove();

                // Format markdown bold & linebreaks
                let formattedText = res.response
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/`(.*?)`/g, '<code style="background:#e2e8f0; padding:2px 4px; border-radius:4px; font-size:11px;">$1</code>')
                    .replace(/\n/g, '<br>');

                let actionsHtml = '';
                if (res.suggestedActions && res.suggestedActions.length > 0) {
                    actionsHtml = `
                        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">
                            ${res.suggestedActions.map(a => `
                                <button class="quick-action-btn" style="padding:4px 10px; font-size:11px;" onclick="window.location.hash='${a.link}'">${a.label} &rarr;</button>
                            `).join('')}
                        </div>
                    `;
                }

                chat.innerHTML += `
                    <div class="ai-msg" style="background:#f8fafc; border:1px solid #e2e8f0; color:#1e293b; padding:12px 14px; border-radius:12px; font-size:12.5px; margin-top:8px; line-height:1.5;">
                        <div>${formattedText}</div>
                        ${actionsHtml}
                    </div>
                `;
                chat.scrollTop = chat.scrollHeight;
            } catch (e) {
                loadingBubble.remove();
                chat.innerHTML += `<div style="background:#fef2f2; color:#dc2626; padding:8px 12px; border-radius:8px; font-size:12px; margin-top:8px;">Failed to reach AI assistant.</div>`;
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
        const input = document.getElementById('copilot-input');
        if (input) {
            input.value = q;
            document.getElementById('copilot-send-btn').click();
        }
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

    async updateCurrentUserDisplay() {
        try {
            const me = this.currentUser || await Api.getMe();
            this.currentUser = me;
            if (me) {
                const parts = me.name ? me.name.trim().split(' ') : ['U'];
                const initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
                const roleColor = me.role === 'Organization Admin' ? '#dc2626' : (me.role === 'Department Admin' ? '#059669' : '#6366f1');

                // Top header chip
                const nameEl = document.getElementById('current-user-name');
                const badgeEl = document.getElementById('current-user-role-badge');
                const initialsEl = document.getElementById('user-avatar-initials');
                if (nameEl) nameEl.textContent = me.name;
                if (badgeEl) { badgeEl.textContent = me.designation || me.user_type || me.role; badgeEl.style.color = roleColor; }
                if (initialsEl) initialsEl.textContent = initials;

                // Sidebar user section
                const sidebarName = document.getElementById('sidebar-user-name');
                const sidebarRole = document.getElementById('sidebar-user-role');
                const sidebarAvatar = document.getElementById('sidebar-user-avatar');
                if (sidebarName) sidebarName.textContent = me.name;
                if (sidebarRole) sidebarRole.textContent = (me.designation || me.user_type || me.role) + (me.department ? ' · ' + me.department : '');
                if (sidebarAvatar) sidebarAvatar.textContent = initials;

                this.applyRoleNavigationVisibility(me.role);
            }
        } catch(e) {}
    },

    applyRoleNavigationVisibility(role) {
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
    async updateCurrentUserDisplay() {
        try {
            const me = this.currentUser || await Api.getMe();
            this.currentUser = me;
            if (me) {
                const parts = me.name ? me.name.trim().split(' ') : ['U'];
                const initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
                const roleColor = me.role === 'Organization Admin' ? '#dc2626' : (me.role === 'Department Admin' ? '#059669' : '#6366f1');

                // Top header chip
                const nameEl = document.getElementById('current-user-name');
                const badgeEl = document.getElementById('current-user-role-badge');
                const initialsEl = document.getElementById('user-avatar-initials');
                if (nameEl) nameEl.textContent = me.name;
                if (badgeEl) { badgeEl.textContent = me.designation || me.user_type || me.role; badgeEl.style.color = roleColor; }
                if (initialsEl) initialsEl.textContent = initials;

                // Sidebar user section
                const sidebarName = document.getElementById('sidebar-user-name');
                const sidebarRole = document.getElementById('sidebar-user-role');
                const sidebarAvatar = document.getElementById('sidebar-user-avatar');
                if (sidebarName) sidebarName.textContent = me.name;
                if (sidebarRole) sidebarRole.textContent = (me.designation || me.user_type || me.role) + (me.department ? ' · ' + me.department : '');
                if (sidebarAvatar) sidebarAvatar.textContent = initials;

                this.applyRoleNavigationVisibility(me.role);
            }
        } catch(e) {}
    },

    applyRoleNavigationVisibility(role) {
        const userViews      = ['home', 'submit-problem', 'my-complaints', 'knowledge-base', 'settings'];
        const deptAdminViews = ['home', 'dashboard', 'my-complaints', 'incidents', 'knowledge-base', 'prevention-center', 'settings'];
        const orgAdminViews  = ['home', 'dashboard', 'submit-problem', 'my-complaints', 'incidents',
                                'problem-intelligence', 'emerging-problems', 'knowledge-base',
                                'prevention-center', 'analytics', 'admin-users', 'settings'];

        let allowed;
        if (role === 'Organization Admin') allowed = orgAdminViews;
        else if (role === 'Department Admin') allowed = deptAdminViews;
        else allowed = userViews;

        document.querySelectorAll('.nav-item').forEach(item => {
            const view = item.getAttribute('data-view');
            item.style.display = view && allowed.includes(view) ? 'flex' : 'none';
        });

        // Show/hide admin-specific IDs
        const adminUsersNav = document.getElementById('nav-item-admin-users');
        if (adminUsersNav) adminUsersNav.style.display = role === 'Organization Admin' ? 'flex' : 'none';

        // Update copilot suggestions based on role
        const suggestions = document.getElementById('copilot-suggestions');
        if (suggestions) {
            if (role === 'User') {
                suggestions.innerHTML = `
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('Where is my complaint?')">Where is my complaint? →</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('What can I do if the solution didn\\'t work?')">Solution didn't work? →</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('How do I report a water supply problem?')">Report water issue →</button>
                `;
            } else if (role === 'Department Admin') {
                suggestions.innerHTML = `
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('How many unacknowledged complaints do I have?')">My pending queue →</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('Which complaints are overdue SLA?')">SLA overdue →</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('Show recent incidents in my department')">My incidents →</button>
                `;
            } else {
                suggestions.innerHTML = `
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('How many pending complaints are there?')">Pending complaints →</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('Which department has the most overdue tickets?')">Overdue by dept →</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('Show all escalated complaints')">Escalations →</button>
                `;
            }
        }
    },

    async logout() {
        try {
            await Api.logout();
        } catch(e) { /* continue */ }
        this.isLoggedIn = false;
        this.currentUser = null;
        this.selectedRole = null;
        history.replaceState(null, '', window.location.pathname);

        const emailInput = document.getElementById('auth-email');
        const pwInput    = document.getElementById('auth-password');
        if (emailInput) emailInput.value = '';
        if (pwInput)    pwInput.value = '';
        document.getElementById('auth-error-banner')?.classList.add('hidden');

        // Go back to public homepage after logout
        this.showPublicHome();
    },

    handleHashChange() {
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
    // 0. USER HOME VIEW (Welcoming Personal Experience)
    // ==========================================
    async renderUserHome(container) {
        try {
            const me = this.currentUser || await Api.getMe();
            this.currentUser = me;
            const firstName = (me && me.name) ? me.name.split(' ')[0] : 'there';

            // Greeting based on time of day
            const hour = new Date().getHours();
            const timeGreeting = hour < 12 ? 'Good morning' : (hour < 17 ? 'Good afternoon' : 'Good evening');

            // Fetch user's complaints and dashboard stats
            const [complaints, stats] = await Promise.all([
                Api.getComplaints().catch(() => []),
                Api.getDashboardStats().catch(() => ({ activeProblems: 0, verificationPendingCount: 0, selfServiceCount: 0 }))
            ]);

            const activeProblems = complaints.filter(c => c.status !== 'Resolved' && c.status !== 'Closed');
            const pendingVerify = complaints.filter(c => c.status === 'Resolved' && !c.verified);
            const recentComplaints = complaints.slice(0, 3);

            container.innerHTML = `
                <div class="user-home-greeting">
                    <h1>${timeGreeting}, ${firstName} 👋</h1>
                    <p>How can we help you today? Report campus problems or track ongoing solutions.</p>
                </div>

                <!-- Primary Problem Reporting Hero Box -->
                <div class="report-input-hero">
                    <div class="report-input-label">
                        <svg width="20" height="20" fill="none" stroke="#4f46e5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        <span>Describe a problem you've encountered on campus</span>
                    </div>
                    <textarea id="home-problem-input" class="report-textarea" placeholder="Tell us what's happening... (e.g., Wi-Fi disconnection in Block C, water leakage in 2nd floor restroom, or projector not working in Lab 4)"></textarea>
                    <div class="report-input-footer">
                        <span style="font-size:12px; color:#64748b;">💡 AI will scan for instant self-help solutions before routing to staff</span>
                        <button class="btn-header-primary" style="padding:10px 22px; font-size:14px; border-radius:10px;" onclick="app.startProblemFromHome()">
                            Get Help &amp; Report &rarr;
                        </button>
                    </div>
                </div>

                <!-- Quick Summary Cards -->
                <div class="problems-summary-row">
                    <div class="problem-summary-card" onclick="window.location.hash='#my-complaints'">
                        <div class="problem-summary-count" style="color:#4f46e5;">${activeProblems.length}</div>
                        <div class="problem-summary-label">My Active Problems</div>
                        <div style="font-size:11px; color:#94a3b8; margin-top:4px;">Being addressed by departments</div>
                    </div>
                    <div class="problem-summary-card" onclick="window.location.hash='#my-complaints'" style="${pendingVerify.length > 0 ? 'border:1.5px solid #60a5fa; background:#eff6ff;' : ''}">
                        <div class="problem-summary-count" style="color:${pendingVerify.length > 0 ? '#2563eb' : '#059669'};">${pendingVerify.length}</div>
                        <div class="problem-summary-label">Awaiting My Confirmation</div>
                        <div style="font-size:11px; color:${pendingVerify.length > 0 ? '#1d4ed8' : '#94a3b8'}; margin-top:4px;">${pendingVerify.length > 0 ? 'Click to confirm resolution' : 'All resolved items verified'}</div>
                    </div>
                    <div class="problem-summary-card" onclick="app.startProblemFromHome()">
                        <div class="problem-summary-count" style="color:#10b981;">${stats.selfServiceCount || 0}</div>
                        <div class="problem-summary-label">Self-Service Solutions</div>
                        <div style="font-size:11px; color:#94a3b8; margin-top:4px;">Campus issues solved instantly</div>
                    </div>
                </div>

                ${pendingVerify.length > 0 ? `
                    <!-- Action Required Banner for Resolution Confirmation -->
                    <div class="card" style="margin-bottom:24px; background:#eff6ff; border:1.5px solid #93c5fd;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="font-weight:800; font-size:15px; color:#1e3a8a;">
                                <span>🔍 Please Confirm: Are these problems resolved?</span>
                            </div>
                            <span style="font-size:12px; color:#2563eb;">Campus departments marked these fixed</span>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            ${pendingVerify.map(item => `
                                <div style="background:white; border:1px solid #bfdbfe; border-radius:10px; padding:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                                    <div>
                                        <div style="font-weight:700; color:#1e293b;">#${item.complaintId}: "${item.complaintText}"</div>
                                        <div style="font-size:11px; color:#64748b; margin-top:2px;">Location: <strong>${item.location}</strong> • Department: <strong>${item.department}</strong> (${item.assignedPerson})</div>
                                        ${item.resolutionNote ? `<div style="font-size:12px; color:#059669; margin-top:4px; font-style:italic;">"${item.resolutionNote}"</div>` : ''}
                                    </div>
                                    <button class="btn-header-primary" style="padding:8px 18px; font-size:12px; background:#059669;" onclick="app.showVerificationModal('${item.complaintId}')">
                                        Confirm Solution &rarr;
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Active Problems Journey List -->
                <div class="card" style="margin-bottom:28px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <div style="font-weight:800; font-size:16px; color:#0f172a;">My Recent Problems</div>
                        <a href="#my-complaints" style="font-size:13px; font-weight:600; color:#4f46e5;">View all (${complaints.length}) &rarr;</a>
                    </div>

                    ${complaints.length === 0 ? `
                        <div style="text-align:center; padding:32px 16px; color:#64748b;">
                            <div style="font-size:36px; margin-bottom:8px;">✨</div>
                            <div style="font-weight:700; color:#1e293b;">You haven't reported any problems yet</div>
                            <div style="font-size:13px; margin-top:4px;">When you submit an issue, you can track its entire progress here.</div>
                        </div>
                    ` : `
                        <div class="complaint-cards">
                            ${recentComplaints.map(c => {
                                const isResolved = c.status === 'Resolved';
                                const statusClass = isResolved ? 'status-resolved' : (c.escalated ? 'status-escalated' : (c.status === 'In Progress' ? 'status-in-progress' : 'status-submitted'));
                                const statusText = isResolved ? 'Resolved' : (c.escalated ? 'Escalated' : (c.status === 'In Progress' ? 'In Progress' : 'Submitted'));
                                const nextAction = isResolved ? (c.verified ? 'Completed & Verified' : 'Awaiting Your Confirmation') : (c.seen ? 'Department is addressing' : 'Waiting for department review');

                                return `
                                    <div class="complaint-card">
                                        <div class="complaint-card-header">
                                            <span class="complaint-card-id">#${c.complaintId}</span>
                                            <span class="status-badge ${statusClass}">${statusText}</span>
                                        </div>
                                        <div class="complaint-card-title">${c.complaintText}</div>
                                        <div class="complaint-card-meta">
                                            <span>📁 <strong>${c.category}</strong></span>
                                            <span>📍 <strong>${c.location}</strong></span>
                                            <span>🏛️ <strong>${c.department}</strong> (${c.assignedPerson})</span>
                                            <span>👁️ ${c.seen ? 'Viewed by staff' : 'Pending review'}</span>
                                        </div>
                                        <div class="complaint-card-footer">
                                            <div style="font-size:12px; color:#64748b;">
                                                <strong>Next Step:</strong> ${nextAction}
                                            </div>
                                            <div style="display:flex; gap:8px;">
                                                ${(isResolved && !c.verified) ? `
                                                    <button class="btn-header-primary" style="padding:6px 14px; font-size:12px; background:#059669;" onclick="app.showVerificationModal('${c.complaintId}')">
                                                        Confirm Fix
                                                    </button>
                                                ` : ''}
                                                <button class="quick-action-btn" onclick="app.viewTicketTimelineModal('${c.complaintId}')">
                                                    View Journey &rarr;
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>

                <!-- Self-Help Knowledge Categories -->
                <div class="card">
                    <div style="font-weight:800; font-size:15px; color:#0f172a; margin-bottom:12px;">Quick Self-Help Solutions</div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
                        <div class="problem-summary-card" onclick="app.startProblemFromHome()" style="padding:14px; border:1px solid #e2e8f0;">
                            <div style="font-size:24px; margin-bottom:6px;">📶</div>
                            <div style="font-weight:700; font-size:13px; color:#1e293b;">Wi-Fi &amp; Network</div>
                            <div style="font-size:11px; color:#64748b; margin-top:2px;">Campus portal, DNS &amp; reconnection</div>
                        </div>
                        <div class="problem-summary-card" onclick="app.startProblemFromHome()" style="padding:14px; border:1px solid #e2e8f0;">
                            <div style="font-size:24px; margin-bottom:6px;">💧</div>
                            <div style="font-weight:700; font-size:13px; color:#1e293b;">Water &amp; Sanitation</div>
                            <div style="font-size:11px; color:#64748b; margin-top:2px;">Purifier, dispenser &amp; supply fixes</div>
                        </div>
                        <div class="problem-summary-card" onclick="app.startProblemFromHome()" style="padding:14px; border:1px solid #e2e8f0;">
                            <div style="font-size:24px; margin-bottom:6px;">⚡</div>
                            <div style="font-weight:700; font-size:13px; color:#1e293b;">Electricity &amp; Power</div>
                            <div style="font-size:11px; color:#64748b; margin-top:2px;">UPS resets &amp; lab socket troubleshooting</div>
                        </div>
                        <div class="problem-summary-card" onclick="app.startProblemFromHome()" style="padding:14px; border:1px solid #e2e8f0;">
                            <div style="font-size:24px; margin-bottom:6px;">🛗</div>
                            <div style="font-weight:700; font-size:13px; color:#1e293b;">Elevators &amp; Access</div>
                            <div style="font-size:11px; color:#64748b; margin-top:2px;">Emergency contacts &amp; alternative paths</div>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div style="color:red; padding:20px;">Error loading home: ${e.message}</div>`;
        }
    },

    startProblemFromHome() {
        const text = document.getElementById('home-problem-input')?.value.trim();
        window.location.hash = '#submit-problem';
        setTimeout(() => {
            const input = document.getElementById('user-problem-input');
            if (input && text) {
                input.value = text;
                // Automatically run pre-troubleshoot check
                app.handlePreTroubleshoot();
            }
        }, 100);
    },

    // ==========================================
    // 1. DASHBOARD VIEW (Role-Specific Intelligence)
    // ==========================================
    async renderDashboard(container) {
        try {
            const stats = await Api.getDashboardStats();
            const role = stats.role || 'User';

            let roleSpecificHeader = '';
            let roleSpecificContent = '';

            if (role === 'Organization Admin') {
                // Command Center for Organization Admin
                roleSpecificHeader = `
                    <div class="view-header">
                        <div>
                            <h1>Problem Intelligence Command Center</h1>
                            <p>Institutional oversight: Cross-department SLA telemetry, unacknowledged ticket alerts, and systemic prevention radar</p>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button class="quick-action-btn" onclick="app.runEscalationCheck()" style="background:#fef2f2; border-color:#fca5a5; color:#991b1b; font-weight:700;">⚡ Run SLA Escalation Audit</button>
                            <button class="quick-action-btn" onclick="window.location.hash='#admin-users'">👥 Manage Accounts</button>
                            <button class="quick-action-btn" onclick="app.renderDashboard(document.getElementById('view-container'))">🔄 Refresh</button>
                        </div>
                    </div>
                `;

                roleSpecificContent = `
                    <!-- Organization Escalation Radar -->
                    <div class="card" style="margin-bottom:24px; border-left:4px solid #ef4444;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="font-weight:800; font-size:15px; color:#991b1b; display:flex; align-items:center; gap:8px;">
                                <span>🚨 Campus Escalation Radar (${stats.escalatedList ? stats.escalatedList.length : 0} Overdue / Breached Tickets)</span>
                            </div>
                            <span style="font-size:12px; color:#64748b;">Automatic 1h (Critical) / 6h (High) / 24h (Med) SLA daemon tracking</span>
                        </div>
                        ${stats.escalatedList && stats.escalatedList.length > 0 ? `
                            <div style="display:flex; flex-direction:column; gap:10px;">
                                ${stats.escalatedList.map(item => `
                                    <div style="display:flex; justify-content:space-between; align-items:center; background:#fef2f2; border:1px solid #fee2e2; padding:12px 16px; border-radius:10px; font-size:13px;">
                                        <div>
                                            <div style="font-weight:700; color:#1e293b;">
                                                <span style="color:#dc2626;">#${item.complaintId}</span>: "${item.description.slice(0, 70)}..."
                                            </div>
                                            <div style="font-size:11px; color:#475569; margin-top:3px;">
                                                Dept: <strong>${item.department}</strong> (${item.assignedPerson}) • Location: ${item.location} • Submitter: ${item.submitterName}
                                            </div>
                                        </div>
                                        <div style="text-align:right;">
                                            <span style="background:#fee2e2; color:#991b1b; font-size:11px; font-weight:800; padding:4px 8px; border-radius:6px; border:1px solid #fca5a5;">${item.overdueDuration}</span>
                                            <button class="quick-action-btn" style="margin-left:8px; padding:4px 10px; font-size:11px;" onclick="app.viewTicketTimelineModal('${item.complaintId}')">Inspect</button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <div style="padding:16px; text-align:center; color:#059669; font-weight:600; font-size:13px;">
                                ✅ Excellent: Zero departmental acknowledgement breaches currently logged campus-wide.
                            </div>
                        `}
                    </div>
                `;
            } else if (role === 'Department Admin') {
                // Operational Workspace for Department Admin
                roleSpecificHeader = `
                    <div class="view-header">
                        <div>
                            <h1>Department Operational Workspace — ${stats.department}</h1>
                            <p>Departmental ticket queue, acknowledgement SLA timers, and swift incident resolution dispatch</p>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="quick-action-btn" onclick="app.renderDashboard(document.getElementById('view-container'))">🔄 Refresh Queue</button>
                        </div>
                    </div>
                `;

                roleSpecificContent = `
                    <!-- Unacknowledged Ticket Queue (SLA Timers) -->
                    <div class="card" style="margin-bottom:24px; border-left:4px solid #f59e0b;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="font-weight:800; font-size:15px; color:#92400e; display:flex; align-items:center; gap:8px;">
                                <span>⚡ Unacknowledged Department Queue (${stats.unacknowledgedCount} Awaiting Confirmation)</span>
                            </div>
                            <span style="font-size:12px; color:#64748b;">Tickets auto-escalate if not acknowledged within priority SLA window</span>
                        </div>
                        ${stats.unacknowledgedTickets && stats.unacknowledgedTickets.length > 0 ? `
                            <div style="display:flex; flex-direction:column; gap:10px;">
                                ${stats.unacknowledgedTickets.map(ticket => `
                                    <div style="display:flex; justify-content:space-between; align-items:center; background:#fffbeb; border:1px solid #fef3c7; padding:12px 16px; border-radius:10px; font-size:13px;">
                                        <div>
                                            <div style="font-weight:700; color:#1e293b;">
                                                <span style="color:#d97706;">#${ticket.complaintId}</span>: "${ticket.description.slice(0, 65)}..."
                                            </div>
                                            <div style="font-size:11px; color:#64748b; margin-top:2px;">
                                                Category: <strong>${ticket.category}</strong> • Location: ${ticket.location} • Priority: <strong style="color:${ticket.priority === 'Critical' ? '#dc2626' : '#d97706'};">${ticket.priority}</strong>
                                            </div>
                                        </div>
                                        <div style="display:flex; align-items:center; gap:8px;">
                                            <span style="background:${ticket.isBreached ? '#fee2e2' : '#fef3c7'}; color:${ticket.isBreached ? '#991b1b' : '#92400e'}; font-size:11px; font-weight:800; padding:4px 8px; border-radius:6px; border:1px solid ${ticket.isBreached ? '#fca5a5' : '#fde047'};">
                                                ⏱️ ${ticket.slaText}
                                            </span>
                                            <button class="btn-header-primary" style="padding:6px 14px; font-size:11.5px; background:#059669; border-color:#059669;" onclick="app.handleAcknowledgeComplaint('${ticket.complaintId}')">
                                                ⚡ Acknowledge
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <div style="padding:14px; text-align:center; color:#059669; font-weight:600; font-size:13px;">
                                ✅ All incoming department tickets have been acknowledged! No tickets pending first response.
                            </div>
                        `}
                    </div>
                `;
            } else {
                // Regular User: Student, Faculty, Staff ("My Problem Journey")
                roleSpecificHeader = `
                    <div class="view-header">
                        <div>
                            <h1>My Problem Journey</h1>
                            <p>Track your submitted complaints, real-time departmental routing, and verify problem resolutions</p>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <a href="#submit-problem" class="btn-header-primary">+ Submit Problem</a>
                        </div>
                    </div>
                `;

                if (stats.verificationPendingCount > 0) {
                    roleSpecificContent += `
                        <div class="card" style="margin-bottom:24px; background:#eff6ff; border:1.5px solid #93c5fd;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                                <div style="font-weight:800; font-size:15px; color:#1e3a8a;">
                                    <span>🔍 Action Required: Confirm Fix for ${stats.verificationPendingCount} Resolved Ticket(s)</span>
                                </div>
                                <span style="font-size:12px; color:#2563eb;">Campus departments reported these fixed</span>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:10px;">
                                ${stats.verificationPending.map(item => `
                                    <div style="background:white; border:1px solid #bfdbfe; border-radius:10px; padding:14px; display:flex; justify-content:space-between; align-items:center;">
                                        <div>
                                            <div style="font-weight:700; color:#1e293b;">#${item.complaintId} (${item.category}): "${item.description.slice(0, 60)}..."</div>
                                            <div style="font-size:11px; color:#475569; margin-top:2px;">Location: ${item.location} • Fixed by: ${item.assignedPerson} (${item.department})</div>
                                            <div style="font-size:11.5px; color:#059669; margin-top:4px; font-style:italic;">"${item.resolutionNote}"</div>
                                        </div>
                                        <button class="btn-header-primary" style="padding:8px 18px; font-size:12px;" onclick="app.showVerificationModal('${item.complaintId}')">
                                            Verify Fix Now &rarr;
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }
            }

            container.innerHTML = `
                ${roleSpecificHeader}

                <div class="stats-grid">
                    <div class="stat-card" onclick="window.location.hash='#my-complaints'" style="cursor:pointer;" title="Click to view complaints">
                        <div class="stat-label">${role === 'User' ? 'My Reports' : (role === 'Department Admin' ? 'Dept Reports' : 'Campus Reports')} <span>📄</span></div>
                        <div class="stat-value">${stats.totalReports} <span class="stat-badge badge-up">Live</span></div>
                    </div>
                    <div class="stat-card" onclick="window.location.hash='#my-complaints'" style="cursor:pointer;" title="Click to inspect active queue">
                        <div class="stat-label">Active Problems <span>⚠️</span></div>
                        <div class="stat-value">${stats.activeProblems} <span class="stat-badge badge-down">In Queue</span></div>
                    </div>
                    <div class="stat-card" onclick="window.location.hash='#my-complaints'" style="cursor:pointer;" title="Click to view priority alerts">
                        <div class="stat-label">${role === 'Department Admin' ? 'Unacknowledged' : (role === 'Organization Admin' ? 'Campus SLA Breaches' : 'Awaiting Verify')} <span>${role === 'Department Admin' ? '⏱️' : '🚨'}</span></div>
                        <div class="stat-value" style="color:#ef4444;">${role === 'Department Admin' ? stats.unacknowledgedCount : (role === 'Organization Admin' ? stats.recurringProblems : stats.verificationPendingCount)} <span class="stat-badge badge-up">Alert</span></div>
                    </div>
                    <div class="stat-card" onclick="app.startProblemFromHome()" style="cursor:pointer;" title="Click to view self-help impact">
                        <div class="stat-label">Self-Service Solved <span>🌱</span></div>
                        <div class="stat-value" style="color:#10b981;">${stats.selfServiceCount} <span class="stat-badge badge-up">Saved</span></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">AI Model Confidence <span>🎯</span></div>
                        <div class="stat-value" style="color:#4f46e5;">${stats.aiConfidence}</div>
                    </div>
                </div>

                ${roleSpecificContent}

                <div class="dashboard-grid">
                    <div>
                        <div class="card" style="margin-bottom:28px;">
                            <div class="card-title">What Needs Attention Now?</div>
                            ${stats.needsAttention.map(item => `
                                <div class="attention-card" onclick="window.location.hash='${item.incidentId ? 'incidents/' + item.incidentId : 'my-complaints'}'" style="cursor:pointer;">
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
                            <div class="card-title">Complaint Volume Trend <span style="font-size:12px; font-weight:500; color:#6b7280;">Recent 7 Days</span></div>
                            <canvas id="trendChart" height="140"></canvas>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:28px;">
                        <div class="card">
                            <div class="card-title">Category Distribution</div>
                            <canvas id="categoryChart" height="200"></canvas>
                        </div>

                        <div class="card">
                            <div class="card-title">Campus Telemetry Hotspots</div>
                            <div style="background:#f8fafc; border-radius:8px; padding:20px; text-align:center;">
                                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px;">
                                    <div onclick="window.location.hash='#my-complaints'" style="cursor:pointer; background:#fee2e2; border:1px solid #fca5a5; padding:16px; border-radius:8px; color:#991b1b; font-weight:700;">Block B<br><span style="font-size:11px; font-weight:500;">Water & Facilities</span></div>
                                    <div onclick="window.location.hash='#my-complaints'" style="cursor:pointer; background:#fef3c7; border:1px solid #fde047; padding:16px; border-radius:8px; color:#92400e; font-weight:700;">Library<br><span style="font-size:11px; font-weight:500;">Wi-Fi & Books</span></div>
                                    <div onclick="window.location.hash='#my-complaints'" style="cursor:pointer; background:#fef3c7; border:1px solid #fde047; padding:16px; border-radius:8px; color:#92400e; font-weight:700;">Block C<br><span style="font-size:11px; font-weight:500;">Network Switch</span></div>
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
                        data: [18, 26, 22, 38, 52, 68, 59],
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
                    labels: ['Water & Plumbing', 'Internet/Wi-Fi', 'Electricity', 'Sanitization', 'Lift/Elevator'],
                    datasets: [{
                        data: [35, 28, 20, 15, 12],
                        backgroundColor: ['#4f46e5', '#6366f1', '#f59e0b', '#10b981', '#ec4899']
                    }]
                },
                options: { responsive: true }
            });
        }
    },

    // ==========================================
    // 2. SUBMIT PROBLEM VIEW (Interactive Multi-Issue Stage)
    // ==========================================
    renderSubmitProblem(container) {
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
    async handleAnalyzeAndReviewStage() {
        const text = document.getElementById('user-problem-input').value.trim();
        if (!text) {
            alert('Please describe your problem before analyzing.');
            return;
        }

        const stageContainer = document.getElementById('multi-issue-stage-container');
        stageContainer.classList.remove('hidden');
        stageContainer.innerHTML = `
            <div style="padding:24px; text-align:center; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; color:#475569;">
                <div style="font-weight:700; font-size:14px; margin-bottom:6px;">🤖 AI Engine Analyzing Problem Clauses...</div>
                <div style="font-size:12px; color:#64748b;">Extracting distinct issues, location hotspots, category classifications, and department routing.</div>
            </div>
        `;

        try {
            const analysis = await Api.analyzeComplaint(text);
            this.currentDetectedIssues = analysis.issues || [];
            this.renderMultiIssueReviewBoard(stageContainer);
        } catch (e) {
            stageContainer.innerHTML = `<div style="color:#ef4444; padding:16px;">Failed to analyze submission: ${e.message || 'Server error'}</div>`;
        }
    },

    renderMultiIssueReviewBoard(container) {
        const issues = this.currentDetectedIssues;
        const numIssues = issues.length;

        const categoriesList = [
            "Hostel Food/Mess", "Water Supply", "Electricity", "Lift/Elevator",
            "Internet/Wi-Fi", "Sanitization/Cleanliness", "Restrooms",
            "Garden/Landscaping", "Building/Infrastructure", "Classroom Facilities",
            "Laboratory", "Library", "Security", "Plumbing", "General Maintenance"
        ];

        const locationsList = [
            "Block A", "Block B", "Block C", "Hostel Block A", "Hostel Block B",
            "Library", "Central Laboratory", "Cafeteria / Mess", "Main Academic Block",
            "Auditorium", "Campus Parking", "Sports Ground"
        ];

        container.innerHTML = `
            <div style="margin-top:24px; border-top:2px solid #eef2ff; padding-top:24px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <div>
                        <h3 style="font-size:16px; font-weight:800; color:#1e1b4b; display:flex; align-items:center; gap:8px;">
                            <span>📋 Confirmation Stage:</span>
                            <span style="background:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-size:12px;">${numIssues} Distinct Issue(s) Detected</span>
                        </h3>
                        <p style="font-size:12.5px; color:#64748b; margin-top:2px;">Review each independent ticket below before creating records. You can edit descriptions, change departments, merge, split, or remove issues.</p>
                    </div>
                    <button class="quick-action-btn" style="padding:6px 12px; font-size:12px;" onclick="app.addNewIssueCard()">+ Add Another Issue</button>
                </div>

                <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:24px;">
                    ${issues.map((issue, idx) => `
                        <div class="card" style="border:1.5px solid #cbd5e1; background:white; padding:18px; border-radius:12px; position:relative;" id="issue-card-${idx}">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span style="width:24px; height:24px; border-radius:50%; background:#4f46e5; color:white; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center;">${idx + 1}</span>
                                    <span style="font-weight:700; font-size:13px; color:#1e293b;">Issue Ticket #${idx + 1}</span>
                                </div>
                                <div style="display:flex; gap:6px;">
                                    <button class="quick-action-btn" style="font-size:11px; padding:3px 8px;" onclick="app.splitIssueCard(${idx})" title="Split this into two separate tickets">✂️ Split</button>
                                    ${idx < numIssues - 1 ? `<button class="quick-action-btn" style="font-size:11px; padding:3px 8px;" onclick="app.mergeWithNextIssueCard(${idx})" title="Merge with next ticket">🔗 Merge</button>` : ''}
                                    <button class="quick-action-btn" style="font-size:11px; padding:3px 8px; color:#ef4444;" onclick="app.removeIssueCard(${idx})" title="Remove this issue">🗑️ Remove</button>
                                </div>
                            </div>

                            <div style="margin-bottom:12px;">
                                <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Actionable Description:</label>
                                <textarea id="issue-desc-${idx}" rows="2" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px; font-family:inherit;" onchange="app.updateIssueField(${idx}, 'description', this.value)">${issue.description}</textarea>
                            </div>

                            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; font-size:12px;">
                                <div>
                                    <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Category:</label>
                                    <select style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;" onchange="app.updateIssueCategory(${idx}, this.value)">
                                        ${categoriesList.map(cat => `<option value="${cat}" ${cat === issue.category ? 'selected' : ''}>${cat}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Location:</label>
                                    <select style="width:100%; padding:8px; border-radius:8px; border:1px solid #cbd5e1;" onchange="app.updateIssueField(${idx}, 'location', this.value)">
                                        ${locationsList.map(loc => `<option value="${loc}" ${loc === issue.location ? 'selected' : ''}>${loc}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Routed Department:</label>
                                    <div style="padding:8px; background:#f1f5f9; border-radius:8px; font-weight:700; color:#059669;" id="issue-dept-${idx}">${issue.department}</div>
                                </div>
                                <div>
                                    <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Assigned Officer:</label>
                                    <div style="padding:8px; background:#f1f5f9; border-radius:8px; font-weight:700; color:#334155;" id="issue-person-${idx}">${issue.assigned_person}</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:16px; border-radius:12px; border:1px solid #e2e8f0;">
                    <div style="font-size:13px; color:#475569;">
                        <strong>Ready to submit?</strong> All ${numIssues} independent complaint(s) will be created with individual ticket IDs under a shared submission group.
                    </div>
                    <button class="btn-header-primary" style="padding:12px 28px; font-size:14px; font-weight:700;" onclick="app.submitConfirmedMultiIssues()">
                        ✅ Confirm & Create ${numIssues} Ticket(s)
                    </button>
                </div>
            </div>
        `;
    },

    updateIssueField(index, field, value) {
        if (this.currentDetectedIssues[index]) {
            this.currentDetectedIssues[index][field] = value;
        }
    },

    updateIssueCategory(index, newCategory) {
        if (!this.currentDetectedIssues[index]) return;
        this.currentDetectedIssues[index].category = newCategory;

        // Routing rule lookup
        const routingMap = {
            "Hostel Food/Mess": { dept: "Mess / Food Administration", person: "Mess Manager" },
            "Water Supply": { dept: "Water & Maintenance Dept", person: "Maintenance Admin" },
            "Electricity": { dept: "Electrical Maintenance", person: "Chief Electrician" },
            "Lift/Elevator": { dept: "Lift Maintenance Dept", person: "Lift Maintenance Officer" },
            "Internet/Wi-Fi": { dept: "Network Administration", person: "Network Admin" },
            "Sanitization/Cleanliness": { dept: "Housekeeping Dept", person: "Housekeeping Supervisor" },
            "Restrooms": { dept: "Housekeeping Dept", person: "Housekeeping Supervisor" },
            "Garden/Landscaping": { dept: "Campus Maintenance", person: "Garden Supervisor" },
            "Building/Infrastructure": { dept: "Civil & Infrastructure", person: "Estate Officer" },
            "Classroom Facilities": { dept: "Academic Infrastructure", person: "Facility Coordinator" },
            "Laboratory": { dept: "Lab Administration", person: "Lab Administrator" },
            "Library": { dept: "Library Services", person: "Librarian" },
            "Security": { dept: "Security & Parking", person: "Security Officer" },
            "Plumbing": { dept: "Water & Maintenance Dept", person: "Plumbing Supervisor" }
        };

        const rule = routingMap[newCategory] || { dept: "General Administration", person: "Campus Administrator" };
        this.currentDetectedIssues[index].department = rule.dept;
        this.currentDetectedIssues[index].assigned_person = rule.person;

        const deptEl = document.getElementById(`issue-dept-${index}`);
        const personEl = document.getElementById(`issue-person-${index}`);
        if (deptEl) deptEl.textContent = rule.dept;
        if (personEl) personEl.textContent = rule.person;
    },

    splitIssueCard(index) {
        const issue = this.currentDetectedIssues[index];
        if (!issue) return;
        const text = issue.description;
        const mid = Math.floor(text.length / 2);
        const splitPos = text.indexOf(' ', mid) !== -1 ? text.indexOf(' ', mid) : mid;
        const part1 = text.substring(0, splitPos).trim();
        const part2 = text.substring(splitPos).trim();

        issue.description = part1;
        this.currentDetectedIssues.splice(index + 1, 0, {
            id: `issue_${Date.now()}`,
            description: part2,
            category: issue.category,
            department: issue.department,
            assigned_person: issue.assigned_person,
            location: issue.location,
            severity: issue.severity,
            confidence: 0.90
        });

        this.renderMultiIssueReviewBoard(document.getElementById('multi-issue-stage-container'));
    },

    mergeWithNextIssueCard(index) {
        if (index >= this.currentDetectedIssues.length - 1) return;
        const curr = this.currentDetectedIssues[index];
        const next = this.currentDetectedIssues[index + 1];
        curr.description = `${curr.description} and ${next.description}`;
        this.currentDetectedIssues.splice(index + 1, 1);
        this.renderMultiIssueReviewBoard(document.getElementById('multi-issue-stage-container'));
    },

    removeIssueCard(index) {
        if (this.currentDetectedIssues.length <= 1) {
            alert('At least one issue description must be maintained.');
            return;
        }
        this.currentDetectedIssues.splice(index, 1);
        this.renderMultiIssueReviewBoard(document.getElementById('multi-issue-stage-container'));
    },

    addNewIssueCard() {
        this.currentDetectedIssues.push({
            id: `issue_${Date.now()}`,
            description: "Additional facility issue",
            category: "General Maintenance",
            department: "General Administration",
            assigned_person: "Campus Administrator",
            location: "Main Academic Block",
            severity: "Medium",
            confidence: 0.85
        });
        this.renderMultiIssueReviewBoard(document.getElementById('multi-issue-stage-container'));
    },

    async submitConfirmedMultiIssues() {
        const issues = this.currentDetectedIssues;
        if (!issues || issues.length === 0) {
            alert('No issues available to submit.');
            return;
        }

        try {
            const res = await Api.createComplaint({
                confirmedIssues: issues
            });
            this.showForwardedPopupModal(res);
        } catch (e) {
            alert('Failed to submit tickets: ' + (e.error || e.message || 'Server error'));
        }
    },

    showForwardedPopupModal(res) {
        const tickets = res.all_tickets || [res.complaint];
        const modalId = 'forwarded-popup-modal';

        let existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const modalHtml = `
            <div id="${modalId}" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;">
                <div style="background:white; max-width:650px; width:100%; border-radius:18px; padding:28px; border:1px solid #e2e8f0; box-shadow:0 20px 30px -10px rgba(0,0,0,0.2);">
                    <div style="display:flex; align-items:center; gap:14px; margin-bottom:20px; border-bottom:1px solid #f1f5f9; padding-bottom:16px;">
                        <div style="width:48px; height:48px; background:#ecfdf5; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#059669; font-size:24px; font-weight:800;">🚀</div>
                        <div>
                            <h2 style="font-size:20px; font-weight:800; color:#0f172a; margin-bottom:2px;">${tickets.length} Complaint(s) Forwarded Successfully!</h2>
                            <p style="font-size:13px; color:#64748b;">Shared Submission Group: <strong>#${res.originalId || tickets[0].originalId || 'CMP'}</strong>. Each issue routed independently.</p>
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
                                    <div><strong>Category:</strong> ${t.category} (${t.location})</div>
                                    <div><strong>Routed To:</strong> <span style="color:#059669; font-weight:700;">${t.assignedPerson} (${t.department})</span></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="background:#fffbe8; border:1px solid #fde68a; padding:12px 16px; border-radius:10px; font-size:12px; color:#92400e; margin-bottom:24px; font-weight:600; display:flex; align-items:center; gap:8px;">
                        <span>👁️</span> <span><strong>Transparency Telemetry Active:</strong> Timestamped alerts will log when each administrator opens and inspects their assigned ticket.</span>
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
            const role = this.currentUser?.role || 'User';
            const isAdmin = role === 'Department Admin' || role === 'Organization Admin';
            const canAcknowledge = isAdmin;

            if (!isAdmin) {
                // ==========================================
                // REGULAR USER VIEW: Clean, Friendly Complaint Cards
                // ==========================================
                container.innerHTML = `
                    <div class="view-header">
                        <div>
                            <h1>My Submitted Problems</h1>
                            <p>Track the live status, assigned department, and resolution timeline of your reports</p>
                        </div>
                        <a href="#submit-problem" class="btn-header-primary">+ Report a Problem</a>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; gap:12px; flex-wrap:wrap;">
                        <div style="font-size:14px; font-weight:700; color:#1e293b;">
                            Showing ${complaints.length} problem(s)
                        </div>
                        <input type="text" id="user-complaint-filter" placeholder="Search your problems..." style="padding:8px 14px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px; width:240px;" oninput="app.filterUserComplaintCards()">
                    </div>

                    ${complaints.length === 0 ? `
                        <div class="card" style="text-align:center; padding:48px 24px; color:#64748b;">
                            <div style="font-size:40px; margin-bottom:12px;">📋</div>
                            <div style="font-size:16px; font-weight:700; color:#1e293b;">No problems reported yet</div>
                            <p style="font-size:13px; margin:8px auto 20px; max-width:400px;">When you submit an institutional problem, it will be organized here with real-time status and assignment updates.</p>
                            <a href="#submit-problem" class="btn-header-primary">Report a Problem Now</a>
                        </div>
                    ` : `
                        <div class="complaint-cards" id="user-complaint-cards-list">
                            ${complaints.map(c => {
                                const isResolved = c.status === 'Resolved';
                                const isPendingVerify = isResolved && !c.verified;
                                const statusClass = isResolved ? 'status-resolved' : (c.escalated ? 'status-escalated' : (c.status === 'In Progress' ? 'status-in-progress' : 'status-submitted'));
                                const statusLabel = isResolved ? 'Resolved' : (c.escalated ? 'Escalated' : (c.status === 'In Progress' ? 'In Progress' : 'Submitted'));
                                const nextAction = isPendingVerify
                                    ? '⚠️ Solution reported — Please verify if it works!'
                                    : (isResolved ? '✅ Problem successfully resolved' : (c.seen ? 'Staff investigating on-site' : 'Pending initial staff review'));

                                return `
                                    <div class="complaint-card" data-search="${(c.complaintId + ' ' + c.complaintText + ' ' + c.category + ' ' + c.location).toLowerCase()}">
                                        <div class="complaint-card-header">
                                            <div style="display:flex; align-items:center; gap:8px;">
                                                <span class="complaint-card-id">#${c.complaintId}</span>
                                                ${c.escalated ? `<span style="background:#fee2e2; color:#991b1b; font-size:10px; font-weight:800; padding:2px 6px; border-radius:6px;">🔺 Escalated L${c.escalationLevel||1}</span>` : ''}
                                            </div>
                                            <span class="status-badge ${statusClass}">${statusLabel}</span>
                                        </div>
                                        <div class="complaint-card-title">${c.complaintText}</div>
                                        <div class="complaint-card-meta">
                                            <span>📁 <strong>${c.category}</strong></span>
                                            <span>📍 <strong>${c.location}</strong></span>
                                            <span>🏛️ <strong>${c.department}</strong> (${c.assignedPerson})</span>
                                            <span>👁️ ${c.seen ? `<span style="color:#059669; font-weight:600;">Viewed ${c.seenAt || ''}</span>` : '<span style="color:#d97706;">Pending Review</span>'}</span>
                                        </div>
                                        <div class="complaint-card-footer">
                                            <div style="font-size:12px; color:#475569;">
                                                <strong>Next Step:</strong> <span style="${isPendingVerify ? 'color:#2563eb; font-weight:700;' : ''}">${nextAction}</span>
                                            </div>
                                            <div style="display:flex; gap:8px;">
                                                ${isPendingVerify ? `
                                                    <button class="btn-header-primary" style="padding:6px 14px; font-size:12px; background:#059669;" onclick="app.showVerificationModal('${c.complaintId}')">
                                                        Confirm Solution
                                                    </button>
                                                ` : ''}
                                                <button class="quick-action-btn" onclick="app.viewTicketTimelineModal('${c.complaintId}')">
                                                    View Journey &rarr;
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                `;
            } else {
                // ==========================================
                // ADMIN VIEW: Operational Telemetry Table with SLA & Acknowledgement
                // ==========================================
                container.innerHTML = `
                    <div class="view-header">
                        <div>
                            <h1>Complaints &amp; Live Routing</h1>
                            <p>Track live routing, admin view timestamps, SLA acknowledgements, and resolution timelines</p>
                        </div>
                        <a href="#submit-problem" class="btn-header-primary">+ Submit Problem</a>
                    </div>

                    <div class="card">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; gap:12px; flex-wrap:wrap;">
                            <div style="font-size:14px; font-weight:700; color:#1e293b;">
                                Showing ${complaints.length} Record(s)
                            </div>
                            <div style="display:flex; gap:8px;">
                                <input type="text" id="filter-complaint-search" placeholder="Search complaints..." style="padding:6px 12px; border-radius:8px; border:1px solid #cbd5e1; font-size:12px;" oninput="app.filterComplaintsTable()">
                            </div>
                        </div>

                        <table class="data-table" id="complaints-data-table">
                            <thead>
                                <tr>
                                    <th>Ticket ID</th>
                                    <th>Description</th>
                                    <th>Category &amp; Location</th>
                                    <th>Routed Department</th>
                                    <th>Telemetry</th>
                                    <th>SLA / Acknowledgement</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${complaints.map(c => {
                                    const escBadge = c.escalated
                                        ? `<br><span style="background:#fee2e2;color:#991b1b;font-size:10px;font-weight:800;padding:2px 7px;border-radius:8px;display:inline-block;margin-top:3px;">🔺 Esc L${c.escalationLevel||1}</span>`
                                        : '';
                                    const seenBadge = c.seen
                                        ? `<span style="background:#d1fae5;color:#065f46;font-size:11px;font-weight:800;padding:4px 10px;border-radius:12px;display:inline-block;">👁️ Viewed</span><br><span style="font-size:10px;color:#64748b;">${c.seenAt||''}</span>`
                                        : `<span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:800;padding:4px 10px;border-radius:12px;display:inline-block;">⏳ Pending</span>`;
                                    let slaBadge = '';
                                    if (c.acknowledgedAt) {
                                        slaBadge = `<span style="background:#d1fae5;color:#065f46;font-size:11px;font-weight:700;padding:3px 9px;border-radius:10px;display:inline-block;">✓ Acknowledged</span>`;
                                    } else if (c.acknowledgementDeadline) {
                                        const over = new Date() > new Date(c.acknowledgementDeadline);
                                        const bg = over ? '#fee2e2;color:#991b1b' : '#fef3c7;color:#92400e';
                                        const label = over ? 'OVERDUE' : 'SLA Pending';
                                        slaBadge = `<span style="background:${bg};font-size:11px;font-weight:700;padding:3px 9px;border-radius:10px;display:inline-block;">${label}</span>`;
                                    } else {
                                        slaBadge = `<span style="color:#9ca3af;font-size:11px;">—</span>`;
                                    }
                                    const ackBtn = (!c.acknowledgedAt && canAcknowledge)
                                        ? `<br><button class="quick-action-btn" style="font-size:11px;padding:3px 8px;margin-top:4px;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;" onclick="app.handleAcknowledgeComplaint('${c.complaintId}')">Acknowledge</button>`
                                        : '';
                                    return `<tr>
                                        <td><strong>${c.complaintId}</strong>${escBadge}</td>
                                        <td style="max-width:260px;font-weight:600;font-size:13px;">${c.complaintText}</td>
                                        <td style="font-size:12px;">${c.category}<br><span style="color:#6b7280;font-size:11px;">${c.location}</span></td>
                                        <td style="font-size:12px;"><strong style="color:#0f172a;">${c.assignedPerson}</strong><br><span style="color:#059669;font-weight:600;font-size:11px;">${c.department}</span></td>
                                        <td>${seenBadge}</td>
                                        <td style="min-width:130px;">${slaBadge}${ackBtn}</td>
                                        <td><span class="tag" style="background:#e0e7ff;color:#3730a3;font-weight:700;">${c.status}</span></td>
                                        <td><button class="quick-action-btn" style="padding:6px 12px;font-size:12px;" onclick="app.viewTicketTimelineModal('${c.complaintId}')">Details &amp; Lifecycle</button></td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        } catch (e) {
            container.innerHTML = `<div style="color:red; padding:20px;">Error loading complaints: ${e.message}</div>`;
        }
    },

    filterUserComplaintCards() {
        const query = (document.getElementById('user-complaint-filter')?.value || '').toLowerCase();
        document.querySelectorAll('#user-complaint-cards-list .complaint-card').forEach(card => {
            const text = card.getAttribute('data-search') || '';
            card.style.display = text.includes(query) ? '' : 'none';
        });
    },

    filterComplaintsTable() {
        const query = document.getElementById('filter-complaint-search').value.toLowerCase();
        const rows = document.querySelectorAll('#complaints-data-table tbody tr');
        rows.forEach(r => {
            const text = r.textContent.toLowerCase();
            r.style.display = text.includes(query) ? '' : 'none';
        });
    },

    async viewTicketTimelineModal(complaintId) {
        try {
            const data = await Api.getComplaintById(complaintId);
            const modalId = 'ticket-timeline-modal';

            let existing = document.getElementById(modalId);
            if (existing) existing.remove();

            const isUser = this.currentUser && this.currentUser.role === 'User';
            const isResolved = data.status === 'Resolved';

            const modalHtml = `
                <div id="${modalId}" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;">
                    <div style="background:white; max-width:680px; width:100%; border-radius:18px; padding:28px; border:1px solid #e2e8f0; box-shadow:0 20px 30px -10px rgba(0,0,0,0.2); max-height:90vh; overflow-y:auto;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; border-bottom:1px solid #f1f5f9; padding-bottom:12px;">
                            <div>
                                <h2 style="font-size:18px; font-weight:800; color:#0f172a;">Ticket Telemetry: #${data.complaintId}</h2>
                                <p style="font-size:12px; color:#64748b;">Assigned to <strong>${data.assignedPerson} (${data.department})</strong></p>
                            </div>
                            <button onclick="document.getElementById('${modalId}').remove()" style="border:none; background:none; font-size:22px; cursor:pointer; color:#64748b;">&times;</button>
                        </div>

                        <div style="background:#f8fafc; padding:14px; border-radius:10px; font-size:13px; color:#1e293b; margin-bottom:20px; border:1px solid #e2e8f0;">
                            <strong>Description:</strong> "${data.complaintText}"<br>
                            <div style="display:flex; gap:16px; margin-top:8px; font-size:12px; color:#475569; flex-wrap:wrap;">
                                <span><strong>Category:</strong> ${data.category}</span>
                                <span><strong>Location:</strong> ${data.location}</span>
                                <span><strong>Priority:</strong> ${data.severity}</span>
                                <span><strong>Provenance:</strong> <span style="background:#e2e8f0; padding:1px 6px; border-radius:4px; font-weight:700;">${data.evidenceProvenance}</span></span>
                            </div>
                        </div>

                        <!-- SLA & Escalation Details -->
                        <div style="background:#f1f5f9; padding:12px 16px; border-radius:10px; font-size:12px; color:#334155; margin-bottom:20px; border:1px solid #e2e8f0; display:flex; flex-wrap:wrap; gap:14px;">
                            ${data.assignedAt ? `<span><strong>Assigned At:</strong> ${new Date(data.assignedAt).toLocaleString()}</span>` : ''}
                            ${data.firstViewedAt ? `<span><strong>First Viewed:</strong> ${new Date(data.firstViewedAt).toLocaleString()}</span>` : ''}
                            ${data.acknowledgedAt
                                ? `<span style="color:#065f46;"><strong>&#10003; Acknowledged:</strong> ${new Date(data.acknowledgedAt).toLocaleString()} by ${data.acknowledgedBy || 'Admin'}</span>`
                                : (data.acknowledgementDeadline
                                    ? `<span style="color:${new Date() > new Date(data.acknowledgementDeadline) ? '#991b1b' : '#92400e'};"><strong>SLA Deadline:</strong> ${new Date(data.acknowledgementDeadline).toLocaleString()}${new Date() > new Date(data.acknowledgementDeadline) ? ' — OVERDUE' : ''}</span>`
                                    : '')
                            }
                            ${data.escalated ? `<span style="color:#991b1b; font-weight:700;">&#128314; Escalated (Level ${data.escalationLevel || 1})</span>` : ''}
                        </div>

                        ${(!data.acknowledgedAt && (app.currentUser?.role === 'Department Admin' || app.currentUser?.role === 'Organization Admin')) ? `
                        <div style="margin-bottom:20px;">
                            <button class="btn-header-primary" style="padding:8px 18px; font-size:12px;" onclick="app.handleAcknowledgeComplaint('${data.complaintId}'); document.getElementById('ticket-timeline-modal')?.remove();">
                                &#10003; Acknowledge This Ticket
                            </button>
                        </div>` : ''}

                        <h3 style="font-size:14px; font-weight:800; color:#334155; margin-bottom:12px;">Lifecycle & Transparency Timeline</h3>
                        <div style="display:flex; flex-direction:column; gap:14px; margin-bottom:24px; padding-left:12px; border-left:2px solid #e0e7ff;">
                            ${data.timeline ? data.timeline.map(t => `
                                <div style="position:relative; padding-left:16px;">
                                    <div style="position:absolute; left:-23px; top:4px; width:12px; height:12px; border-radius:50%; background:${t.status === 'Seen' ? '#059669' : (t.status === 'Resolved' ? '#10b981' : (t.status === 'Closed' ? '#3b82f6' : '#6366f1'))}; border:2px solid white;"></div>
                                    <div style="font-weight:700; font-size:13px; color:#1e293b;">${t.status} <span style="font-weight:500; font-size:11px; color:#64748b;">— by ${t.updatedBy} at ${t.timestamp}</span></div>
                                    <div style="font-size:12px; color:#475569; margin-top:2px;">${t.description}</div>
                                </div>
                            `).join('') : '<div style="font-size:12px; color:#6b7280;">No timeline events recorded.</div>'}
                        </div>

                        ${data.resolutionNote ? `
                            <div style="background:#ecfdf5; border:1px solid #a7f3d0; padding:14px; border-radius:10px; font-size:12.5px; color:#065f46; margin-bottom:20px;">
                                <strong>Department Resolution Note:</strong><br>${data.resolutionNote}
                            </div>
                        ` : ''}

                        <!-- User Verification Trigger -->
                        ${(isUser || isResolved) ? `
                            <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:16px; border-radius:12px; margin-bottom:20px;">
                                <div style="font-weight:800; font-size:13px; color:#1e3a8a; margin-bottom:4px;">User Verification & Resolution Confirmation</div>
                                <p style="font-size:12px; color:#3b82f6; margin-bottom:12px;">Confirm whether the department has satisfactorily solved this problem.</p>
                                <button class="btn-header-primary" style="padding:8px 16px; font-size:12px;" onclick="app.showVerificationModal('${data.complaintId}')">Confirm Resolution Status &rarr;</button>
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
        const modalId = 'user-verification-modal';
        let existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const modalHtml = `
            <div id="${modalId}" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;">
                <div style="background:white; max-width:500px; width:100%; border-radius:18px; padding:28px; border:1px solid #e2e8f0; box-shadow:0 20px 30px -10px rgba(0,0,0,0.2);">
                    <h2 style="font-size:18px; font-weight:800; color:#0f172a; margin-bottom:4px;">Confirm Problem Resolution</h2>
                    <p style="font-size:13px; color:#64748b; margin-bottom:18px;">Ticket #${complaintId}: Is this problem actually solved?</p>

                    <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
                        <button class="quick-action-btn" style="padding:12px; text-align:left; background:#ecfdf5; border:1.5px solid #10b981; color:#065f46; font-weight:700; border-radius:10px;" onclick="app.submitVerificationResponse('${complaintId}', 'Yes')">
                            ✅ Yes — Fully Solved (Close Ticket)
                        </button>
                        <button class="quick-action-btn" style="padding:12px; text-align:left; background:#fffbe8; border:1.5px solid #f59e0b; color:#92400e; font-weight:700; border-radius:10px;" onclick="app.submitVerificationResponse('${complaintId}', 'Partial')">
                            ⚠️ Partially Solved (Needs Follow-up)
                        </button>
                        <button class="quick-action-btn" style="padding:12px; text-align:left; background:#fef2f2; border:1.5px solid #ef4444; color:#991b1b; font-weight:700; border-radius:10px;" onclick="app.submitVerificationResponse('${complaintId}', 'No')">
                            ❌ No — Still Not Solved (Reopen Ticket)
                        </button>
                    </div>

                    <div style="margin-bottom:16px;">
                        <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Feedback / Verification Note:</label>
                        <textarea id="verification-feedback-note" rows="2" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px; font-family:inherit;" placeholder="Describe what you observed..."></textarea>
                    </div>

                    <div style="display:flex; justify-content:flex-end;">
                        <button class="quick-action-btn" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    async submitVerificationResponse(complaintId, status) {
        const noteEl = document.getElementById('verification-feedback-note');
        const note = noteEl ? noteEl.value.trim() : '';

        try {
            const res = await Api.submitVerification({
                complaintId: complaintId,
                verificationStatus: status,
                feedbackText: note || `User confirmed status: ${status}`
            });
            document.getElementById('user-verification-modal')?.remove();
            document.getElementById('ticket-timeline-modal')?.remove();
            alert(res.message);
            this.renderMyComplaints(document.getElementById('view-container'));
        } catch(e) {
            alert('Failed to submit verification: ' + (e.error || e.message));
        }
    },


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
    // ==========================================
    // 4. INCIDENTS VIEW
    // ==========================================
    async renderIncidents(container) {
        try {
            const incidents = await Api.getIncidents();
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h1>Related Problems Board</h1>
                        <p>Clustered campus problem patterns with root cause confidence and assigned response teams</p>
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
                                <th>Assigned Team</th>
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
                                    <td><span style="font-weight:800; color:#4f46e5;">${inc.complaintCount} reports</span> (${inc.affectedUsers} affected)</td>
                                    <td><span style="color:#10b981; font-weight:700;">${(inc.rootCauseConfidence * 100).toFixed(0)}%</span></td>
                                    <td>${inc.assignedTeam || inc.department}</td>
                                    <td><span class="tag tag-urgent">${inc.status}</span></td>
                                    <td><a href="#incidents/${inc.incidentId}" class="btn-header-primary" style="padding:6px 12px; font-size:12px;">Inspect &rarr;</a></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div style="color:red; padding:20px;">Error loading incidents</div>`;
        }
    },

    // ==========================================
    // 5. INCIDENT DETAIL VIEW (Explainable AI & Provenance)
    // ==========================================
    async renderIncidentDetail(container, incidentId) {
        try {
            const data = await Api.getIncidentById(incidentId);
            const inc = data.incident;
            const hyp = data.rootCauseHypothesis;
            const grouped = data.groupedComplaints;
            const prov = data.dataProvenance;
            const resolutions = data.resolutions || [];

            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <h1>${inc.title}</h1>
                            <span class="tag tag-urgent">${inc.severity} Severity</span>
                            <span class="tag" style="background:#e0e7ff; color:#3730a3;">${inc.status}</span>
                        </div>
                        <p>Clustered problem group: ${inc.category} at ${inc.location}</p>
                    </div>
                    <button class="btn-header-primary" onclick="app.recordResolutionAttemptModal('${inc.incidentId}')">Record Resolution Attempt</button>
                </div>

                <div class="dashboard-grid">
                    <div>
                        <!-- Impact Overview -->
                        <div class="card" style="margin-bottom:28px;">
                            <div class="card-title">Impact & Scope Telemetry</div>
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
                                    <span style="font-size:12px; color:#6b7280;">Model Confidence</span>
                                    <div style="font-size:28px; font-weight:800; color:#10b981;">${hyp.confidencePercentage}%</div>
                                </div>
                            </div>
                        </div>

                        <!-- Explainable AI Root Cause Hypothesis Card -->
                        <div class="card" style="background:linear-gradient(135deg, #f5f3ff, #eef2ff); border:1px solid #c7d2fe; margin-bottom:28px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                                <h3 style="color:#4338ca; font-size:16px; font-weight:800;">🧠 AI Root Cause Synthesis</h3>
                                <span style="background:#6366f1; color:white; font-size:10px; font-weight:800; padding:2px 8px; border-radius:10px;">${hyp.confidencePercentage}% ESTIMATE</span>
                            </div>
                            <div style="background:#fffbe8; border:1px solid #fde68a; padding:10px 14px; border-radius:8px; color:#92400e; font-size:12px; font-weight:700; margin-bottom:14px;">
                                ⚠️ ${hyp.disclaimer}
                            </div>
                            <p style="font-size:14px; color:#1e1b4b; line-height:1.6; margin-bottom:14px;"><strong>Probable Root Cause:</strong> ${hyp.probableCause}</p>
                            <p style="font-size:13px; color:#4338ca; margin-bottom:14px;"><strong>Evidence Baseline:</strong> ${hyp.historicalEvidence}</p>
                            <div style="background:white; padding:14px; border-radius:8px; border:1px solid #e0e7ff;">
                                <strong style="font-size:12px; color:#4338ca;">Recommended Department Action:</strong>
                                <p style="font-size:13px; color:#3730a3; margin-top:4px;">${hyp.recommendedAction}</p>
                            </div>
                        </div>

                        <!-- Grouped Complaints with Provenance -->
                        <div class="card" style="margin-bottom:28px;">
                            <div class="card-title">Supporting Complaint Evidence (${grouped.length})</div>
                            <div style="display:flex; flex-direction:column; gap:12px;">
                                ${grouped.map(c => `
                                    <div style="border:1px solid #e2e8f0; padding:14px; border-radius:8px; background:white;">
                                        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; color:#1e293b;">
                                            <span>#${c.complaintId}</span>
                                            <span style="background:#f1f5f9; padding:2px 8px; border-radius:6px; font-size:10px; color:#475569;">${c.evidenceProvenance}</span>
                                        </div>
                                        <p style="font-size:13px; color:#475569; margin:6px 0;">"${c.complaintText}"</p>
                                        <span style="font-size:11px; color:#6b7280;">Reported: ${c.createdAt} · ${c.location}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:28px;">
                        <!-- Provenance Information -->
                        <div class="card">
                            <div class="card-title">Data Provenance & Traceability</div>
                            <div style="display:flex; flex-direction:column; gap:10px; font-size:12.5px; color:#475569;">
                                <div><strong>Source Records:</strong> ${prov.userComplaintsCount} user submissions</div>
                                <div><strong>Dataset Reference:</strong> ${prov.datasetBaseline}</div>
                                <div><strong>Statistical Model:</strong> ${prov.inferenceConfidence}</div>
                                <div><strong>Assigned Team:</strong> ${inc.assignedTeam}</div>
                            </div>
                        </div>

                        <!-- Resolution History -->
                        <div class="card">
                            <div class="card-title">Resolution History (${resolutions.length})</div>
                            <div style="display:flex; flex-direction:column; gap:12px;">
                                ${resolutions.length > 0 ? resolutions.map(r => `
                                    <div style="padding:12px; border-radius:8px; background:#f8fafc; border:1px solid #e2e8f0; font-size:12px;">
                                        <div style="font-weight:700; color:#1e293b; margin-bottom:4px;">Attempt #${r.attemptNumber}: ${r.actionTaken}</div>
                                        <div style="color:#64748b;">Performed by ${r.performedBy} on ${r.performedAt}</div>
                                        <div style="margin-top:6px; font-weight:700; color:${r.success ? '#10b981' : '#ef4444'};">${r.outcome}</div>
                                    </div>
                                `).join('') : '<div style="font-size:12px; color:#64748b;">No prior resolution attempts logged.</div>'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div style="color:red; padding:20px;">Error loading incident detail: ${e.message}</div>`;
        }
    },

    recordResolutionAttemptModal(incidentId) {
        const modalId = 'resolution-record-modal';
        let existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const modalHtml = `
            <div id="${modalId}" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px;">
                <div style="background:white; max-width:550px; width:100%; border-radius:18px; padding:28px; border:1px solid #e2e8f0; box-shadow:0 20px 30px -10px rgba(0,0,0,0.2);">
                    <h2 style="font-size:18px; font-weight:800; color:#0f172a; margin-bottom:4px;">Record Resolution Attempt</h2>
                    <p style="font-size:12px; color:#64748b; margin-bottom:18px;">Incident #${incidentId}: Log actions taken to resolve this problem.</p>

                    <div style="margin-bottom:14px;">
                        <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Action Taken:</label>
                        <textarea id="res-action-input" rows="3" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px; font-family:inherit;" placeholder="e.g. Replaced faulty distribution valve and cleared air locks..."></textarea>
                    </div>

                    <div style="margin-bottom:18px;">
                        <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Action Outcome:</label>
                        <select id="res-success-select" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px;">
                            <option value="1">Success — Problem Resolved</option>
                            <option value="0">Partial / Unsuccessful — Requires Further Escalation</option>
                        </select>
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:10px;">
                        <button class="quick-action-btn" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
                        <button class="btn-header-primary" onclick="app.submitResolutionRecord('${incidentId}')">Submit Record</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    async submitResolutionRecord(incidentId) {
        const actionEl = document.getElementById('res-action-input');
        const successEl = document.getElementById('res-success-select');
        const action = actionEl ? actionEl.value.trim() : '';
        const success = successEl ? (successEl.value === '1') : true;

        if (!action) {
            alert('Please describe the action taken.');
            return;
        }

        try {
            const res = await Api.createResolution({
                incidentId: incidentId,
                actionTaken: action,
                performedBy: this.currentUser ? this.currentUser.name : 'Department Admin',
                success: success
            });
            document.getElementById('resolution-record-modal')?.remove();
            alert(res.message);
            this.renderIncidentDetail(document.getElementById('view-container'), incidentId);
        } catch (e) {
            alert('Failed to record resolution: ' + (e.error || e.message));
        }
    },

    // ==========================================
    // 6. EMERGING PROBLEMS
    // ==========================================
    renderProblemIntelligence(container) {
        this.renderEmergingProblems(container);
    },

    async renderEmergingProblems(container) {
        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Emerging Problem Intelligence</h1>
                    <p>Detect rapid complaint volume spikes, anomaly clusters, and infrastructure failure risks</p>
                </div>
            </div>

            <div class="stats-grid">
                <div class="stat-card" style="border-top:4px solid #ef4444;" onclick="window.location.hash='#incidents'" style="cursor:pointer;">
                    <div class="stat-label">Water Supply Spikes</div>
                    <div class="stat-value" style="color:#ef4444;">+180% <span style="font-size:12px; color:#6b7280;">Block B</span></div>
                </div>
                <div class="stat-card" style="border-top:4px solid #f59e0b;" onclick="window.location.hash='#incidents'" style="cursor:pointer;">
                    <div class="stat-label">Network Switch Latency</div>
                    <div class="stat-value" style="color:#f59e0b;">+120% <span style="font-size:12px; color:#6b7280;">Central Library</span></div>
                </div>
                <div class="stat-card" style="border-top:4px solid #3b82f6;" onclick="window.location.hash='#incidents'" style="cursor:pointer;">
                    <div class="stat-label">Elevator Door Sensor Alarms</div>
                    <div class="stat-value" style="color:#3b82f6;">+75% <span style="font-size:12px; color:#6b7280;">Block A</span></div>
                </div>
            </div>

            <div class="card" style="margin-top:20px;">
                <div class="card-title">Early Warning Signals & Anomaly Detection</div>
                <p style="font-size:13px; color:#64748b; margin-bottom:16px;">Automated complaint clustering flagged 3 critical anomalies across facility infrastructure:</p>
                
                <div style="display:flex; flex-direction:column; gap:14px;">
                    <div style="background:#fef2f2; border:1px solid #fca5a5; padding:16px; border-radius:10px;">
                        <strong style="color:#991b1b;">⚠️ Block B Hostel Water Pressure Fluctuation</strong>
                        <p style="font-size:13px; color:#7f1d1d; margin-top:4px;">11 reports logged in 3 hours. Secondary booster valve sensor reports pressure drop below 1.2 bar.</p>
                        <div style="margin-top:8px;"><a href="#incidents" class="quick-action-btn" style="padding:4px 10px; font-size:11px;">Inspect Incident Board &rarr;</a></div>
                    </div>

                    <div style="background:#fffbe8; border:1px solid #fde68a; padding:16px; border-radius:10px;">
                        <strong style="color:#92400e;">⚠️ Library AP 2.4GHz Co-Channel Contention</strong>
                        <p style="font-size:13px; color:#78350f; margin-top:4px;">Channel 6 RF contention detected during exam hours. 8 student tickets logged.</p>
                        <div style="margin-top:8px;"><a href="#incidents" class="quick-action-btn" style="padding:4px 10px; font-size:11px;">Inspect Incident Board &rarr;</a></div>
                    </div>
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
                        <p>Institutional solutions, historically failed attempts, and prevention lessons</p>
                    </div>
                </div>

                <div class="card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
                        <span style="font-weight:700; font-size:13px; color:#334155;">${kb.length} Documented Knowledge Records</span>
                        <input type="text" id="kb-search-input" placeholder="Search knowledge..." style="padding:6px 12px; border-radius:8px; border:1px solid #cbd5e1; font-size:12px;" oninput="app.filterKnowledgeTable()">
                    </div>

                    <table class="data-table" id="kb-table">
                        <thead>
                            <tr>
                                <th>KB ID</th>
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
            container.innerHTML = `<div style="color:red; padding:20px;">Error loading knowledge base: ${e.message}</div>`;
        }
    },

    filterKnowledgeTable() {
        const query = document.getElementById('kb-search-input').value.toLowerCase();
        const rows = document.querySelectorAll('#kb-table tbody tr');
        rows.forEach(r => {
            const text = r.textContent.toLowerCase();
            r.style.display = text.includes(query) ? '' : 'none';
        });
    },

    // ==========================================
    // 8. PREVENTION CENTER
    // ==========================================
    async renderPreventionCenter(container) {
        try {
            const recs = await Api.getPrevention();
            const isAdmin = this.currentUser && this.currentUser.role !== 'User';

            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h1>Proactive Prevention Center</h1>
                        <p>Explainable preventive recommendations generated from historical problem patterns with actionable administrator review</p>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:16px;">
                    ${recs.map(r => `
                        <div class="card" style="border:1px solid #e2e8f0; background:white;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                                <div>
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <span style="font-weight:800; font-size:16px; color:#1e293b;">${r.recommendation}</span>
                                        <span class="tag" style="background:${r.status === 'Approved' ? '#ecfdf5; color:#10b981;' : (r.status === 'Completed' ? '#e0e7ff; color:#3730a3;' : '#fef3c7; color:#92400e;')} font-weight:700;">${r.status}</span>
                                        <span class="tag tag-urgent">${r.priority} Priority</span>
                                    </div>
                                    <div style="font-size:12px; color:#64748b; margin-top:4px;">Recommendation ID: ${r.recommendationId} · Target Dept: <strong>${r.responsibleDepartment}</strong></div>
                                </div>

                                ${isAdmin ? `
                                    <div style="display:flex; gap:6px;">
                                        <button class="quick-action-btn" style="font-size:11px; padding:4px 8px; background:#ecfdf5; color:#065f46;" onclick="app.updatePreventionStatus('${r.recommendationId}', 'Approved')">Approve</button>
                                        <button class="quick-action-btn" style="font-size:11px; padding:4px 8px; background:#fef2f2; color:#991b1b;" onclick="app.updatePreventionStatus('${r.recommendationId}', 'Rejected')">Reject</button>
                                        <button class="quick-action-btn" style="font-size:11px; padding:4px 8px; background:#e0e7ff; color:#3730a3;" onclick="app.updatePreventionStatus('${r.recommendationId}', 'Completed')">Mark Completed</button>
                                    </div>
                                ` : ''}
                            </div>

                            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; font-size:13px; color:#334155; background:#f8fafc; padding:14px; border-radius:10px;">
                                <div><strong>Problem Addressed:</strong><br>${r.problem}</div>
                                <div><strong>Reason & Rationale:</strong><br>${r.reason}</div>
                                <div><strong>Expected Impact:</strong><br>${r.expectedImpact}</div>
                                <div><strong>Suggested Timeline:</strong><br>${r.suggestedTimeline}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div style="color:red; padding:20px;">Error loading prevention center</div>`;
        }
    },

    async updatePreventionStatus(recId, status) {
        try {
            const res = await Api.updatePreventionAction(recId, { status: status, decisionNote: `Updated by ${this.currentUser ? this.currentUser.name : 'Admin'}` });
            alert(res.message);
            this.renderPreventionCenter(document.getElementById('view-container'));
        } catch(e) {
            alert('Failed to update recommendation status: ' + (e.error || e.message));
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
                        <h1>Institutional Problem Analytics</h1>
                        <p>Resolution verification rate, SLA response telemetry, and system reliability</p>
                    </div>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Confirm Your Solution Rate</div>
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
            container.innerHTML = `<div style="color:red; padding:20px;">Error loading analytics</div>`;
        }
    },

    // ==========================================
    // 10. SETTINGS & PREFERENCES (Fully Persistent)
    // ==========================================
    async renderSettings(container) {
        try {
            const s = await Api.getSettings();

            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h1>Settings & Preferences</h1>
                        <p>Manage profile fields, notification alert telemetry, and institutional preferences (persists across sessions)</p>
                    </div>
                </div>

                <div id="settings-feedback-banner" class="hidden" style="margin-bottom:20px; padding:14px 18px; border-radius:10px; font-size:13px; font-weight:700;"></div>

                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px; max-width:950px;">
                    <!-- Account Profile Card -->
                    <div class="card">
                        <div style="font-weight:800; font-size:16px; color:#0f172a; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
                            <span>👤 Institutional Profile</span>
                            <span class="tag" style="font-size:10px; font-weight:700; background:${s.role === 'Organization Admin' ? '#fee2e2; color:#991b1b;' : (s.role === 'Department Admin' ? '#d1fae5; color:#065f46;' : '#e0e7ff; color:#3730a3;')}">${s.role}</span>
                        </div>

                        <div style="display:flex; flex-direction:column; gap:14px; font-size:13px;">
                            <div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Full Name (Editable):</label>
                                <input type="text" id="setting-full-name" value="${s.fullName}" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; outline:none; font-size:14px; font-family:inherit;">
                            </div>
                            <div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Institutional Email (Read-Only):</label>
                                <input type="text" value="${s.email}" style="width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0; outline:none; background:#f8fafc; color:#64748b;" readonly>
                            </div>
                            <div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Department / Unit (Read-Only):</label>
                                <input type="text" value="${s.department}" style="width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0; outline:none; background:#f8fafc; color:#64748b;" readonly>
                            </div>
                            ${s.userType || s.user_type ? `<div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">User Type:</label>
                                <input type="text" value="${s.userType || s.user_type}" style="width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0; outline:none; background:#f8fafc; color:#64748b;" readonly>
                            </div>` : ''}
                            ${s.rollNumber || s.roll_number ? `<div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Roll Number:</label>
                                <input type="text" value="${s.rollNumber || s.roll_number}" style="width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0; outline:none; background:#f8fafc; color:#64748b;" readonly>
                            </div>` : ''}
                            ${s.employeeId || s.employee_id ? `<div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Employee ID:</label>
                                <input type="text" value="${s.employeeId || s.employee_id}" style="width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0; outline:none; background:#f8fafc; color:#64748b;" readonly>
                            </div>` : ''}
                            ${s.designation ? `<div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Designation:</label>
                                <input type="text" value="${s.designation}" style="width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0; outline:none; background:#f8fafc; color:#64748b;" readonly>
                            </div>` : ''}
                            ${s.status ? `<div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Account Status:</label>
                                <input type="text" value="${s.status}" style="width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0; outline:none; background:${s.status==='Active'?'#ecfdf5':'#fef2f2'}; color:${s.status==='Active'?'#065f46':'#991b1b'}; font-weight:700;" readonly>
                            </div>` : ''}
                        </div>
                    </div>

                    <!-- Password Change Card -->
                    <div class="card">
                        <div style="font-weight:800; font-size:16px; color:#0f172a; margin-bottom:16px;">&#128274; Change Password</div>
                        <div id="pwd-change-banner" style="display:none; margin-bottom:14px; padding:12px 16px; border-radius:10px; font-size:13px; font-weight:700;"></div>
                        <div style="display:flex; flex-direction:column; gap:12px; font-size:13px;">
                            <div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Current Password:</label>
                                <input type="password" id="pwd-current" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; outline:none; font-size:14px; font-family:inherit;" placeholder="Enter current password">
                            </div>
                            <div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">New Password:</label>
                                <input type="password" id="pwd-new" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; outline:none; font-size:14px; font-family:inherit;" placeholder="e.g. College2026">
                                <div style="font-size:11.5px; color:#64748b; margin-top:3px;">Requirement: Use at least 8 characters, including letters and numbers (e.g. College2026, Student12345).</div>
                            </div>
                            <div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Confirm New Password:</label>
                                <input type="password" id="pwd-confirm" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; outline:none; font-size:14px; font-family:inherit;" placeholder="Re-enter new password">
                            </div>
                            <div>
                                <button class="btn-header-primary" style="padding:10px 24px; font-size:13px;" onclick="app.handleChangePassword()">Change Password</button>
                            </div>
                        </div>
                    </div>

                    <!-- Notification & Telemetry Preferences -->
                    <div class="card">
                        <div style="font-weight:800; font-size:16px; color:#0f172a; margin-bottom:16px;">🔔 Notification & Alert Telemetry</div>
                        <div style="display:flex; flex-direction:column; gap:16px; font-size:13px;">
                            <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
                                <span>Real-Time Forwarding Pop-up Alerts</span>
                                <input type="checkbox" id="setting-notify-forwarding" ${s.notifyForwarding ? 'checked' : ''} style="width:18px; height:18px;">
                            </label>
                            <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
                                <span>Admin Seen Timestamp Notifications</span>
                                <input type="checkbox" id="setting-notify-seen" ${s.notifySeen ? 'checked' : ''} style="width:18px; height:18px;">
                            </label>
                            <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
                                <span>Resolution Confirmation Alerts</span>
                                <input type="checkbox" id="setting-notify-resolution" ${s.notifyResolution ? 'checked' : ''} style="width:18px; height:18px;">
                            </label>
                            <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
                                <span>Escalation SLA Warning Alerts</span>
                                <input type="checkbox" id="setting-notify-escalation" ${s.notifyEscalation ? 'checked' : ''} style="width:18px; height:18px;">
                            </label>
                        </div>
                    </div>

                    ${s.role !== 'User' ? `
                        <!-- Admin System Controls -->
                        <div class="card" style="grid-column: 1 / -1;">
                            <div style="font-weight:800; font-size:16px; color:#0f172a; margin-bottom:16px;">⚙️ System SLA & Intelligence Controls (${s.role})</div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                                <div>
                                    <label style="font-size:13px; font-weight:700; color:#334155;">AI Match Similarity Threshold (<span id="threshold-val-display">${s.aiThreshold}</span>%)</label>
                                    <input type="range" id="setting-ai-threshold" min="50" max="95" value="${s.aiThreshold}" style="width:100%; margin-top:8px;" oninput="document.getElementById('threshold-val-display').textContent=this.value">
                                </div>
                                <div>
                                    <label style="font-size:13px; font-weight:700; color:#334155;">SLA Response Window</label>
                                    <select id="setting-sla-window" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; margin-top:6px;">
                                        <option value="12 Hours (High Priority)" ${s.slaWindow.includes('12') ? 'selected' : ''}>12 Hours (High Priority)</option>
                                        <option value="24 Hours (Standard)" ${s.slaWindow.includes('24') ? 'selected' : ''}>24 Hours (Standard)</option>
                                        <option value="48 Hours (Low Priority)" ${s.slaWindow.includes('48') ? 'selected' : ''}>48 Hours (Low Priority)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <div style="margin-top:24px; display:flex; align-items:center; gap:12px;">
                    <button id="btn-save-settings" class="btn-header-primary" style="padding:12px 28px; font-size:14px;" onclick="app.handleSaveSettings()">
                        <span id="save-settings-text">Save Preferences</span>
                        <span id="save-settings-spinner" class="hidden">Saving...</span>
                    </button>
                </div>
            `;
        } catch(e) {
            container.innerHTML = `<div style="color:red; padding:20px;">Error loading settings: ${e.message}</div>`;
        }
    },

    async handleSaveSettings() {
        const nameInput = document.getElementById('setting-full-name');
        const notifyFwd = document.getElementById('setting-notify-forwarding');
        const notifySeen = document.getElementById('setting-notify-seen');
        const notifyRes = document.getElementById('setting-notify-resolution');
        const notifyEsc = document.getElementById('setting-notify-escalation');
        const aiThresh = document.getElementById('setting-ai-threshold');
        const slaWin = document.getElementById('setting-sla-window');

        const btn = document.getElementById('btn-save-settings');
        const btnText = document.getElementById('save-settings-text');
        const btnSpinner = document.getElementById('save-settings-spinner');
        const banner = document.getElementById('settings-feedback-banner');

        const fullName = nameInput ? nameInput.value.trim() : '';
        if (!fullName) {
            banner.className = '';
            banner.style.background = '#fef2f2';
            banner.style.color = '#dc2626';
            banner.style.border = '1px solid #fca5a5';
            banner.textContent = 'Full name cannot be empty.';
            banner.classList.remove('hidden');
            return;
        }

        btn.disabled = true;
        btnText.classList.add('hidden');
        btnSpinner.classList.remove('hidden');

        try {
            const payload = {
                fullName: fullName,
                notifyForwarding: notifyFwd ? notifyFwd.checked : true,
                notifySeen: notifySeen ? notifySeen.checked : true,
                notifyResolution: notifyRes ? notifyRes.checked : true,
                notifyEscalation: notifyEsc ? notifyEsc.checked : true,
                aiThreshold: aiThresh ? parseInt(aiThresh.value) : 75,
                slaWindow: slaWin ? slaWin.value : '24 Hours (Standard)'
            };

            const res = await Api.saveSettings(payload);
            banner.className = '';
            banner.style.background = '#ecfdf5';
            banner.style.color = '#065f46';
            banner.style.border = '1px solid #a7f3d0';
            banner.textContent = '✅ ' + (res.message || 'Preferences saved successfully! Survives re-login & page refresh.');
            banner.classList.remove('hidden');

            // Refresh header user identity display
            await this.updateCurrentUserDisplay();
        } catch(e) {
            banner.className = '';
            banner.style.background = '#fef2f2';
            banner.style.color = '#dc2626';
            banner.style.border = '1px solid #fca5a5';
            banner.textContent = 'Error saving preferences: ' + (e.error || e.message || 'Unknown error');
            banner.classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btnText.classList.remove('hidden');
            btnSpinner.classList.add('hidden');
        }
    },

    // ==========================================
    // 11. ADMIN USER MANAGEMENT (Org Admin only)
    // ==========================================
    async renderAdminUsers(container) {
        try {
            const data = await Api.getAdminUsers();
            const users = data.users || [];

            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h1>User Account Management</h1>
                        <p>Create, edit, deactivate and reset passwords for all institutional accounts. Org Admin access only.</p>
                    </div>
                    <button class="btn-header-primary" onclick="app.showCreateUserModal()">+ Create User</button>
                </div>

                <div class="card">
                    <div style="display:flex; gap:10px; align-items:center; margin-bottom:16px; flex-wrap:wrap;">
                        <input type="text" id="admin-user-search" placeholder="Search by name, email, roll no, employee ID..." style="flex:1; min-width:220px; padding:8px 14px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px;" oninput="app.filterAdminUsersTable()">
                        <select id="admin-user-role-filter" style="padding:8px 12px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px;" onchange="app.filterAdminUsersTable()">
                            <option value="">All Roles</option>
                            <option value="User">User</option>
                            <option value="Department Admin">Department Admin</option>
                            <option value="Organization Admin">Organization Admin</option>
                        </select>
                        <select id="admin-user-status-filter" style="padding:8px 12px; border-radius:8px; border:1px solid #cbd5e1; font-size:13px;" onchange="app.filterAdminUsersTable()">
                            <option value="">All Status</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>

                    <table class="data-table" id="admin-users-table">
                        <thead>
                            <tr>
                                <th>Name / Email</th>
                                <th>Role</th>
                                <th>User Type</th>
                                <th>ID / Designation</th>
                                <th>Department</th>
                                <th>Status</th>
                                <th>Last Login</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(u => `
                                <tr data-role="${u.role}" data-status="${u.status || 'Active'}">
                                    <td>
                                        <div style="font-weight:700; color:#0f172a; font-size:13px;">${u.fullName}</div>
                                        <div style="font-size:11px; color:#64748b;">${u.email}</div>
                                    </td>
                                    <td>
                                        <span class="tag" style="font-size:11px; background:${u.role === 'Organization Admin' ? '#fee2e2; color:#991b1b;' : (u.role === 'Department Admin' ? '#d1fae5; color:#065f46;' : '#e0e7ff; color:#3730a3;')}">${u.role}</span>
                                    </td>
                                    <td style="font-size:12px; color:#334155;">${u.userType || u.user_type || '—'}</td>
                                    <td>
                                        <div style="font-size:12px; font-weight:600; color:#1e293b;">${u.rollNumber || u.roll_number || u.employeeId || u.employee_id || '—'}</div>
                                        <div style="font-size:11px; color:#64748b;">${u.designation || '—'}</div>
                                    </td>
                                    <td style="font-size:12px; color:#475569;">${u.department || '—'}</td>
                                    <td>
                                        <span style="font-size:11px; font-weight:700; padding:3px 10px; border-radius:10px; background:${(u.status || 'Active') === 'Active' ? '#d1fae5; color:#065f46;' : '#fee2e2; color:#991b1b;'}">
                                            ${u.status || 'Active'}
                                        </span>
                                    </td>
                                    <td style="font-size:11px; color:#64748b;">${u.lastLoginAt || u.last_login_at || 'Never'}</td>
                                    <td>
                                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                                            <button class="quick-action-btn" style="font-size:11px; padding:4px 10px;" onclick="app.showEditUserModal(${u.id})">Edit</button>
                                            <button class="quick-action-btn" style="font-size:11px; padding:4px 10px; color:#b45309;" onclick="app.handleResetUserPassword(${u.id}, '${u.fullName}')">Reset Pwd</button>
                                            ${(u.status || 'Active') === 'Active'
                                                ? `<button class="quick-action-btn" style="font-size:11px; padding:4px 10px; color:#dc2626;" onclick="app.handleDeactivateUser(${u.id}, '${u.fullName}')">Deactivate</button>`
                                                : `<span style="font-size:11px; color:#9ca3af; font-style:italic;">Inactive</span>`
                                            }
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div style="margin-top:14px; font-size:12px; color:#64748b;">${users.length} account(s) total</div>
                </div>
            `;
        } catch (e) {
            container.innerHTML = `<div style="color:red; padding:20px;">Error loading user accounts: ${e.message || e.error}</div>`;
        }
    },

    filterAdminUsersTable() {
        const q = (document.getElementById('admin-user-search')?.value || '').toLowerCase();
        const role = document.getElementById('admin-user-role-filter')?.value || '';
        const status = document.getElementById('admin-user-status-filter')?.value || '';
        document.querySelectorAll('#admin-users-table tbody tr').forEach(row => {
            const text = row.textContent.toLowerCase();
            const rowRole = row.dataset.role || '';
            const rowStatus = row.dataset.status || '';
            const matchQ = !q || text.includes(q);
            const matchRole = !role || rowRole === role;
            const matchStatus = !status || rowStatus === status;
            row.style.display = (matchQ && matchRole && matchStatus) ? '' : 'none';
        });
    },

    showCreateUserModal() {
        const modalId = 'create-user-modal';
        document.getElementById(modalId)?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="${modalId}" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;">
                <div style="background:white; max-width:560px; width:100%; border-radius:18px; padding:28px; border:1px solid #e2e8f0; box-shadow:0 20px 40px -10px rgba(0,0,0,0.25); max-height:90vh; overflow-y:auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #f1f5f9; padding-bottom:14px;">
                        <h2 style="font-size:18px; font-weight:800; color:#0f172a;">Create New Account</h2>
                        <button onclick="document.getElementById('${modalId}').remove()" style="border:none; background:none; font-size:22px; cursor:pointer; color:#64748b;">&times;</button>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; font-size:13px;">
                        <div style="grid-column:1/-1;">
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Full Name *</label>
                            <input type="text" id="cu-name" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;" placeholder="e.g., Priya Ramesh">
                        </div>
                        <div style="grid-column:1/-1;">
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Email *</label>
                            <input type="email" id="cu-email" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;" placeholder="e.g., priya@college.edu">
                        </div>
                        <div style="grid-column:1/-1;">
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Password *</label>
                            <input type="password" id="cu-password" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;" placeholder="Min 8 characters">
                        </div>
                        <div>
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Role *</label>
                            <select id="cu-role" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px;">
                                <option value="User">User</option>
                                <option value="Department Admin">Department Admin</option>
                                <option value="Organization Admin">Organization Admin</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">User Type</label>
                            <select id="cu-user-type" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px;">
                                <option value="Student">Student</option>
                                <option value="Teaching Staff">Teaching Staff</option>
                                <option value="Non-Teaching Staff">Non-Teaching Staff</option>
                                <option value="Research Staff">Research Staff</option>
                                <option value="Lab Technician">Lab Technician</option>
                                <option value="Maintenance Worker">Maintenance Worker</option>
                                <option value="Housekeeping Worker">Housekeeping Worker</option>
                                <option value="Administrator">Administrator</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Roll / Employee ID</label>
                            <input type="text" id="cu-id" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;" placeholder="e.g., 21CS001 or EMP204">
                        </div>
                        <div>
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Designation</label>
                            <input type="text" id="cu-designation" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;" placeholder="e.g., Assistant Professor">
                        </div>
                        <div style="grid-column:1/-1;">
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Department</label>
                            <input type="text" id="cu-dept" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;" placeholder="e.g., Computer Science">
                        </div>
                    </div>
                    <div id="cu-error" style="margin-top:12px; font-size:12px; color:#dc2626; display:none;"></div>
                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid #f1f5f9; padding-top:16px;">
                        <button class="quick-action-btn" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
                        <button class="btn-header-primary" style="padding:10px 24px;" onclick="app.handleCreateUser()">Create Account</button>
                    </div>
                </div>
            </div>
        `);
    },

    async handleCreateUser() {
        const name = document.getElementById('cu-name')?.value.trim();
        const email = document.getElementById('cu-email')?.value.trim();
        const password = document.getElementById('cu-password')?.value;
        const role = document.getElementById('cu-role')?.value;
        const userType = document.getElementById('cu-user-type')?.value;
        const idVal = document.getElementById('cu-id')?.value.trim();
        const designation = document.getElementById('cu-designation')?.value.trim();
        const dept = document.getElementById('cu-dept')?.value.trim();
        const errEl = document.getElementById('cu-error');

        if (!name || !email || !password || !role) {
            errEl.textContent = 'Name, email, password and role are required.';
            errEl.style.display = 'block';
            return;
        }

        try {
            await Api.createAdminUser({
                fullName: name, email, password, role,
                userType, rollNumber: idVal, employeeId: idVal,
                designation, department: dept
            });
            document.getElementById('create-user-modal')?.remove();
            this.renderAdminUsers(document.getElementById('view-container'));
        } catch(e) {
            errEl.textContent = e.error || e.message || 'Failed to create user.';
            errEl.style.display = 'block';
        }
    },

    async showEditUserModal(userId) {
        try {
            const data = await Api.getAdminUsers();
            const u = (data.users || []).find(x => x.id === userId);
            if (!u) { alert('User not found.'); return; }

            const modalId = 'edit-user-modal';
            document.getElementById(modalId)?.remove();
            document.body.insertAdjacentHTML('beforeend', `
                <div id="${modalId}" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;">
                    <div style="background:white; max-width:480px; width:100%; border-radius:18px; padding:28px; border:1px solid #e2e8f0; box-shadow:0 20px 40px -10px rgba(0,0,0,0.25);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #f1f5f9; padding-bottom:14px;">
                            <h2 style="font-size:17px; font-weight:800; color:#0f172a;">Edit Account — ${u.fullName}</h2>
                            <button onclick="document.getElementById('${modalId}').remove()" style="border:none; background:none; font-size:22px; cursor:pointer; color:#64748b;">&times;</button>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:12px; font-size:13px;">
                            <div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Full Name</label>
                                <input type="text" id="eu-name" value="${u.fullName}" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;">
                            </div>
                            <div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Department</label>
                                <input type="text" id="eu-dept" value="${u.department || ''}" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;">
                            </div>
                            <div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Designation</label>
                                <input type="text" id="eu-designation" value="${u.designation || ''}" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;">
                            </div>
                            <div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Role</label>
                                <select id="eu-role" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px;">
                                    <option value="User" ${u.role === 'User' ? 'selected' : ''}>User</option>
                                    <option value="Department Admin" ${u.role === 'Department Admin' ? 'selected' : ''}>Department Admin</option>
                                    <option value="Organization Admin" ${u.role === 'Organization Admin' ? 'selected' : ''}>Organization Admin</option>
                                </select>
                            </div>
                        </div>
                        <div id="eu-error" style="margin-top:10px; font-size:12px; color:#dc2626; display:none;"></div>
                        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid #f1f5f9; padding-top:16px;">
                            <button class="quick-action-btn" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
                            <button class="btn-header-primary" style="padding:10px 24px;" onclick="app.handleUpdateUser(${userId})">Save Changes</button>
                        </div>
                    </div>
                </div>
            `);
        } catch(e) {
            alert('Failed to load user data: ' + (e.message || e.error));
        }
    },

    async handleUpdateUser(userId) {
        const name = document.getElementById('eu-name')?.value.trim();
        const dept = document.getElementById('eu-dept')?.value.trim();
        const designation = document.getElementById('eu-designation')?.value.trim();
        const role = document.getElementById('eu-role')?.value;
        const errEl = document.getElementById('eu-error');
        try {
            await Api.updateAdminUser(userId, { fullName: name, department: dept, designation, role });
            document.getElementById('edit-user-modal')?.remove();
            this.renderAdminUsers(document.getElementById('view-container'));
        } catch(e) {
            errEl.textContent = e.error || e.message || 'Update failed.';
            errEl.style.display = 'block';
        }
    },

    async handleDeactivateUser(userId, userName) {
        if (!confirm(`Deactivate account for ${userName}? They will be unable to log in.`)) return;
        try {
            await Api.deactivateAdminUser(userId);
            this.renderAdminUsers(document.getElementById('view-container'));
        } catch(e) {
            alert('Deactivation failed: ' + (e.error || e.message));
        }
    },

    async handleResetUserPassword(userId, userName) {
        if (!confirm(`Reset password for ${userName}? They will receive a temporary password.`)) return;
        try {
            const res = await Api.resetAdminUserPassword(userId);
            alert(`✅ Password reset for ${userName}.\nTemporary password: ${res.temporaryPassword || 'password123'}`);
        } catch(e) {
            alert('Password reset failed: ' + (e.error || e.message));
        }
    },

    // ==========================================
    // 12. ESCALATION ACTIONS
    // ==========================================
    async handleAcknowledgeComplaint(complaintId) {
        try {
            const res = await Api.acknowledgeComplaint(complaintId);
            alert(`✅ ${res.message || 'Complaint acknowledged successfully.'}`);
            this.renderDashboard(document.getElementById('view-container'));
        } catch(e) {
            alert('Failed to acknowledge: ' + (e.error || e.message || 'Server error'));
        }
    },

    async runEscalationCheck() {
        const btn = event?.target;
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Running...'; }
        try {
            const res = await Api.checkEscalations();
            const msg = `⚡ Escalation Audit Complete.\n` +
                `✅ Newly Escalated: ${res.newlyEscalatedCount || 0}\n` +
                `🔺 Total Active Escalations: ${res.totalActiveEscalations || 0}\n\n` +
                (res.escalated && res.escalated.length > 0
                    ? res.escalated.map(e => `• #${e.complaintId} — ${e.category} (${e.overdueBy || 'overdue'})`).join('\n')
                    : 'No new escalations found.'
                );
            alert(msg);
            this.renderDashboard(document.getElementById('view-container'));
        } catch(e) {
            alert('Escalation check failed: ' + (e.error || e.message || 'Server error'));
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '⚡ Run SLA Escalation Audit'; }
        }
    },

    // ==========================================
    // 13. PASSWORD CHANGE HANDLER
    // ==========================================
    async handleChangePassword() {
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
    filterAdminUsersTable() {
        const q = (document.getElementById('admin-user-search')?.value || '').toLowerCase();
        const role = document.getElementById('admin-user-role-filter')?.value || '';
        const status = document.getElementById('admin-user-status-filter')?.value || '';
        document.querySelectorAll('#admin-users-table tbody tr').forEach(row => {
            const text = row.textContent.toLowerCase();
            const rowRole = row.dataset.role || '';
            const rowStatus = row.dataset.status || '';
            const matchQ = !q || text.includes(q);
            const matchRole = !role || rowRole === role;
            const matchStatus = !status || rowStatus === status;
            row.style.display = (matchQ && matchRole && matchStatus) ? '' : 'none';
        });
    },

    showCreateUserModal() {
        const modalId = 'create-user-modal';
        document.getElementById(modalId)?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="${modalId}" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;">
                <div style="background:white; max-width:560px; width:100%; border-radius:18px; padding:28px; border:1px solid #e2e8f0; box-shadow:0 20px 40px -10px rgba(0,0,0,0.25); max-height:90vh; overflow-y:auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #f1f5f9; padding-bottom:14px;">
                        <h2 style="font-size:18px; font-weight:800; color:#0f172a;">Create New Account</h2>
                        <button onclick="document.getElementById('${modalId}').remove()" style="border:none; background:none; font-size:22px; cursor:pointer; color:#64748b;">&times;</button>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; font-size:13px;">
                        <div style="grid-column:1/-1;">
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Full Name *</label>
                            <input type="text" id="cu-name" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;" placeholder="e.g., Priya Ramesh">
                        </div>
                        <div style="grid-column:1/-1;">
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Email *</label>
                            <input type="email" id="cu-email" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;" placeholder="e.g., priya@college.edu">
                        </div>
                        <div style="grid-column:1/-1;">
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Password *</label>
                            <input type="password" id="cu-password" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;" placeholder="Min 8 characters">
                        </div>
                        <div>
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Role *</label>
                            <select id="cu-role" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px;">
                                <option value="User">User</option>
                                <option value="Department Admin">Department Admin</option>
                                <option value="Organization Admin">Organization Admin</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">User Type</label>
                            <select id="cu-user-type" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px;">
                                <option value="Student">Student</option>
                                <option value="Teaching Staff">Teaching Staff</option>
                                <option value="Non-Teaching Staff">Non-Teaching Staff</option>
                                <option value="Research Staff">Research Staff</option>
                                <option value="Lab Technician">Lab Technician</option>
                                <option value="Maintenance Worker">Maintenance Worker</option>
                                <option value="Housekeeping Worker">Housekeeping Worker</option>
                                <option value="Administrator">Administrator</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Roll / Employee ID</label>
                            <input type="text" id="cu-id" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;" placeholder="e.g., 21CS001 or EMP204">
                        </div>
                        <div>
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Designation</label>
                            <input type="text" id="cu-designation" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;" placeholder="e.g., Assistant Professor">
                        </div>
                        <div style="grid-column:1/-1;">
                            <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Department</label>
                            <input type="text" id="cu-dept" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;" placeholder="e.g., Computer Science">
                        </div>
                    </div>
                    <div id="cu-error" style="margin-top:12px; font-size:12px; color:#dc2626; display:none;"></div>
                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid #f1f5f9; padding-top:16px;">
                        <button class="quick-action-btn" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
                        <button class="btn-header-primary" style="padding:10px 24px;" onclick="app.handleCreateUser()">Create Account</button>
                    </div>
                </div>
            </div>
        `);
    },

    async handleCreateUser() {
        const name = document.getElementById('cu-name')?.value.trim();
        const email = document.getElementById('cu-email')?.value.trim();
        const password = document.getElementById('cu-password')?.value;
        const role = document.getElementById('cu-role')?.value;
        const userType = document.getElementById('cu-user-type')?.value;
        const idVal = document.getElementById('cu-id')?.value.trim();
        const designation = document.getElementById('cu-designation')?.value.trim();
        const dept = document.getElementById('cu-dept')?.value.trim();
        const errEl = document.getElementById('cu-error');

        if (!name || !email || !password || !role) {
            errEl.textContent = 'Name, email, password and role are required.';
            errEl.style.display = 'block';
            return;
        }

        try {
            await Api.createAdminUser({
                fullName: name, email, password, role,
                userType, rollNumber: idVal, employeeId: idVal,
                designation, department: dept
            });
            document.getElementById('create-user-modal')?.remove();
            this.renderAdminUsers(document.getElementById('view-container'));
        } catch(e) {
            errEl.textContent = e.error || e.message || 'Failed to create user.';
            errEl.style.display = 'block';
        }
    },

    async showEditUserModal(userId) {
        try {
            const data = await Api.getAdminUsers();
            const u = (data.users || []).find(x => x.id === userId);
            if (!u) { alert('User not found.'); return; }

            const modalId = 'edit-user-modal';
            document.getElementById(modalId)?.remove();
            document.body.insertAdjacentHTML('beforeend', `
                <div id="${modalId}" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;">
                    <div style="background:white; max-width:480px; width:100%; border-radius:18px; padding:28px; border:1px solid #e2e8f0; box-shadow:0 20px 40px -10px rgba(0,0,0,0.25);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #f1f5f9; padding-bottom:14px;">
                            <h2 style="font-size:17px; font-weight:800; color:#0f172a;">Edit Account — ${u.fullName}</h2>
                            <button onclick="document.getElementById('${modalId}').remove()" style="border:none; background:none; font-size:22px; cursor:pointer; color:#64748b;">&times;</button>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:12px; font-size:13px;">
                            <div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Full Name</label>
                                <input type="text" id="eu-name" value="${u.fullName}" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;">
                            </div>
                            <div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Department</label>
                                <input type="text" id="eu-dept" value="${u.department || ''}" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;">
                            </div>
                            <div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Designation</label>
                                <input type="text" id="eu-designation" value="${u.designation || ''}" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;">
                            </div>
                            <div>
                                <label style="font-weight:700; color:#475569; display:block; margin-bottom:4px;">Role</label>
                                <select id="eu-role" style="width:100%; padding:10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px;">
                                    <option value="User" ${u.role === 'User' ? 'selected' : ''}>User</option>
                                    <option value="Department Admin" ${u.role === 'Department Admin' ? 'selected' : ''}>Department Admin</option>
                                    <option value="Organization Admin" ${u.role === 'Organization Admin' ? 'selected' : ''}>Organization Admin</option>
                                </select>
                            </div>
                        </div>
                        <div id="eu-error" style="margin-top:10px; font-size:12px; color:#dc2626; display:none;"></div>
                        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid #f1f5f9; padding-top:16px;">
                            <button class="quick-action-btn" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
                            <button class="btn-header-primary" style="padding:10px 24px;" onclick="app.handleUpdateUser(${userId})">Save Changes</button>
                        </div>
                    </div>
                </div>
            `);
        } catch(e) {
            alert('Failed to load user data: ' + (e.message || e.error));
        }
    },

    async handleUpdateUser(userId) {
        const name = document.getElementById('eu-name')?.value.trim();
        const dept = document.getElementById('eu-dept')?.value.trim();
        const designation = document.getElementById('eu-designation')?.value.trim();
        const role = document.getElementById('eu-role')?.value;
        const errEl = document.getElementById('eu-error');
        try {
            await Api.updateAdminUser(userId, { fullName: name, department: dept, designation, role });
            document.getElementById('edit-user-modal')?.remove();
            this.renderAdminUsers(document.getElementById('view-container'));
        } catch(e) {
            errEl.textContent = e.error || e.message || 'Update failed.';
            errEl.style.display = 'block';
        }
    },

    async handleDeactivateUser(userId, userName) {
        if (!confirm(`Deactivate account for ${userName}? They will be unable to log in.`)) return;
        try {
            await Api.deactivateAdminUser(userId);
            this.renderAdminUsers(document.getElementById('view-container'));
        } catch(e) {
            alert('Deactivation failed: ' + (e.error || e.message));
        }
    },

    async handleResetUserPassword(userId, userName) {
        if (!confirm(`Reset password for ${userName}? They will receive a temporary password.`)) return;
        try {
            const res = await Api.resetAdminUserPassword(userId);
            alert(`✅ Password reset for ${userName}.\nTemporary password: ${res.temporaryPassword || 'password123'}`);
        } catch(e) {
            alert('Password reset failed: ' + (e.error || e.message));
        }
    },

    // ==========================================
    // 12. ESCALATION ACTIONS
    // ==========================================
    async handleAcknowledgeComplaint(complaintId) {
        try {
            const res = await Api.acknowledgeComplaint(complaintId);
            alert(`✅ ${res.message || 'Complaint acknowledged successfully.'}`);
            this.renderDashboard(document.getElementById('view-container'));
        } catch(e) {
            alert('Failed to acknowledge: ' + (e.error || e.message || 'Server error'));
        }
    },

    async runEscalationCheck() {
        const btn = event?.target;
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Running...'; }
        try {
            const res = await Api.checkEscalations();
            const msg = `⚡ Escalation Audit Complete.\n` +
                `✅ Newly Escalated: ${res.newlyEscalatedCount || 0}\n` +
                `🔺 Total Active Escalations: ${res.totalActiveEscalations || 0}\n\n` +
                (res.escalated && res.escalated.length > 0
                    ? res.escalated.map(e => `• #${e.complaintId} — ${e.category} (${e.overdueBy || 'overdue'})`).join('\n')
                    : 'No new escalations found.'
                );
            alert(msg);
            this.renderDashboard(document.getElementById('view-container'));
        } catch(e) {
            alert('Escalation check failed: ' + (e.error || e.message || 'Server error'));
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '⚡ Run SLA Escalation Audit'; }
        }
    },

    // ==========================================
    // 13. PASSWORD CHANGE HANDLER
    // ==========================================
    async handleChangePassword() {
        const current = document.getElementById('pwd-current')?.value;
        const newPwd = document.getElementById('pwd-new')?.value;
        const confirm = document.getElementById('pwd-confirm')?.value;
        const banner = document.getElementById('pwd-change-banner');

        const showBanner = (msg, success) => {
            banner.style.background = success ? '#ecfdf5' : '#fef2f2';
            banner.style.color = success ? '#065f46' : '#dc2626';
            banner.style.border = `1px solid ${success ? '#a7f3d0' : '#fca5a5'}`;
            banner.textContent = msg;
            banner.style.display = 'block';
        };

        if (!current || !newPwd || !confirm) { showBanner('All password fields are required.', false); return; }
        if (newPwd !== confirm) { showBanner('New passwords do not match.', false); return; }
        if (newPwd.length < 8) { showBanner('New password must be at least 8 characters.', false); return; }

        try {
            const res = await Api.changePassword({ currentPassword: current, newPassword: newPwd });
            showBanner('✅ ' + (res.message || 'Password changed successfully!'), true);
            document.getElementById('pwd-current').value = '';
            document.getElementById('pwd-new').value = '';
            document.getElementById('pwd-confirm').value = '';
        } catch(e) {
            showBanner('Error: ' + (e.error || e.message || 'Failed to change password.'), false);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
