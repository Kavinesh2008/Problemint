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
        
        // Close user dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById('header-user-wrapper');
            const dd = document.getElementById('header-user-dropdown');
            if (dd && wrapper && !wrapper.contains(e.target)) {
                dd.classList.add('hidden');
            }
        });

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
            this.showAppLayout();
            window.location.hash = this.getDashboardRoute(this.currentUser);
        } else {
            this.showRoleSelection();
        }
    },
    getDashboardRoute(user) {
        if (user?.role === 'Organization Admin') return '#dashboard';
        if (user?.role === 'Department Admin') return '#staff-dashboard';
        return (user?.user_type || 'Student').trim().toLowerCase() === 'student' ? '#home' : '#staff-dashboard';
    },

    isStaffUser(user = this.currentUser) {
        return user?.role === 'User' && (user?.user_type || 'Student').trim().toLowerCase() !== 'student';
    },

    isOperationalDashboardUser(user = this.currentUser) {
        return user?.role === 'Department Admin' || this.isStaffUser(user);
    },

    navigateToRoute(route) {
        if (window.location.hash === route) this.handleHashChange();
        else window.location.hash = route;
    },

    updatePublicNavForAuth(user) {
        const container = document.getElementById('pub-nav-auth-buttons');
        if (!container) return;
        if (user) {
            container.innerHTML = `
                <button class="pub-signin-btn" onclick="app.goToPortal()">Go to Portal &rarr;</button>
                <button class="pub-cta-btn" onclick="app.handleReportProblemClick()">Report a Problem</button>
            `;
        } else {
            container.innerHTML = `
                <button class="pub-signin-btn" onclick="app.showRoleSelection()">Campus Sign In</button>
                <button class="pub-signin-btn" style="background:transparent; border-color:#cbd5e1; color:#475569;" onclick="app.showRoleSelection(); setTimeout(() => { const card = document.querySelector('.role-card--admin'); if (card) card.scrollIntoView({behavior:'smooth'}); }, 100);">Staff &amp; Admin</button>
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

    demoCredentials: {
        'student':      { email: 'student@college.edu', password: 'student123', label: 'Student User', role: 'User', user_type: 'Student', emoji: '🎓' },
        'teaching':     { email: 'teacher@college.edu', password: 'teacher123', label: 'Prof. Ramesh Kumar', role: 'User', user_type: 'Teaching staff', emoji: '👨‍🏫' },
        'non-teaching': { email: 'staff@college.edu', password: 'staff123', label: 'Anita Sharma', role: 'User', user_type: 'Non-teaching staff', emoji: '🏢' },
        'research':     { email: 'researcher@college.edu', password: 'research123', label: 'Dr. Vikram Rao', role: 'User', user_type: 'Research staff', emoji: '🔬' },
        'lab':          { email: 'labtech@college.edu', password: 'labpass', label: 'Suresh Verma', role: 'User', user_type: 'Lab technician', emoji: '⚗️' },
        'maintenance':  { email: 'maintworker@college.edu', password: 'maintworkerpass', label: 'Raju M.', role: 'User', user_type: 'Maintenance worker', emoji: '🔧' },
        'housekeeping': { email: 'houseworker@college.edu', password: 'houseworkerpass', label: 'Meena Devi', role: 'User', user_type: 'Housekeeping worker', emoji: '🧹' },
        'dept-admin':   { email: 'network.admin@college.edu', password: 'networkpass', label: 'Network Admin', role: 'Department Admin', user_type: 'Department admin', emoji: '🏛️' },
        'org-admin':    { email: 'admin@college.edu', password: 'admin123', label: 'College Admin', role: 'Organization Admin', user_type: 'Organization admin', emoji: '⭐' }
    },

    demoAccounts: [
        { name: 'Kavin M', email: 'student@college.edu', password: 'student123', role: 'Student', roleKey: 'student', department: 'Computer Science' },
        { name: 'Prof. Ramesh Kumar', email: 'teacher@college.edu', password: 'teacher123', role: 'Teaching Staff', roleKey: 'teaching', department: 'Electrical Engineering' },
        { name: 'Anita Sharma', email: 'staff@college.edu', password: 'staff123', role: 'Non-Teaching Staff', roleKey: 'non-teaching', department: 'Administration' },
        { name: 'Dr. Vikram Rao', email: 'researcher@college.edu', password: 'research123', role: 'Research Staff', roleKey: 'research', department: 'Biotech Research' },
        { name: 'Suresh Verma', email: 'labtech@college.edu', password: 'labpass', role: 'Lab Technician', roleKey: 'lab', department: 'Central Laboratory' },
        { name: 'Raju M.', email: 'maintworker@college.edu', password: 'maintworkerpass', role: 'Maintenance Worker', roleKey: 'maintenance', department: 'Water & Maintenance Dept' },
        { name: 'Meena Devi', email: 'houseworker@college.edu', password: 'houseworkerpass', role: 'Housekeeping Staff', roleKey: 'housekeeping', department: 'Housekeeping Dept' },
        { name: 'Network Admin', email: 'network.admin@college.edu', password: 'networkpass', role: 'Department Admin', roleKey: 'dept-admin', department: 'Network Administration' },
        { name: 'Mess Manager', email: 'mess.manager@college.edu', password: 'messpass', role: 'Department Admin', roleKey: 'dept-admin', department: 'Mess / Food Administration' },
        { name: 'Maintenance Admin', email: 'maintenance.admin@college.edu', password: 'maintpass', role: 'Department Admin', roleKey: 'dept-admin', department: 'Water & Maintenance Dept' },
        { name: 'Housekeeping Supervisor', email: 'housekeeping@college.edu', password: 'cleanpass', role: 'Housekeeping Staff', roleKey: 'housekeeping', department: 'Housekeeping Dept' },
        { name: 'Security Officer', email: 'security@college.edu', password: 'secpass', role: 'Department Admin', roleKey: 'dept-admin', department: 'Security & Parking' },
        { name: 'Lift Maintenance Officer', email: 'lift.officer@college.edu', password: 'liftpass', role: 'Department Admin', roleKey: 'dept-admin', department: 'Lift Maintenance Dept' },
        { name: 'College Admin', email: 'admin@college.edu', password: 'admin123', role: 'Institutional Admin', roleKey: 'org-admin', department: 'Central Administration' }
    ],

    async quickLogin(roleKey) {
        const cred = this.demoCredentials[roleKey] || this.demoCredentials['student'];
        try {
            await Api.logout();
        } catch(e) {}

        try {
            const res = await Api.login({ email: cred.email, password: cred.password });
            if (res && res.user) {
                this.isLoggedIn = true;
                this.currentUser = res.user;
                this.selectedRole = { label: cred.label, emoji: cred.emoji, key: roleKey };
                this.showAppLayout();
                this.bindNavigation();
                this.bindCopilot();
                this.bindNotifications();
                this.updateCurrentUserDisplay();

                    const dest = this.getDashboardRoute(res.user);
                this.navigateToRoute(dest);
            }
        } catch(e) {
            console.error('Quick login error:', e);
            alert('Quick sign in failed: ' + (e.error || e.message || 'Server error'));
        }
    },

    prefillAndReport(text) {
        window.location.hash = '#submit-problem';
        setTimeout(() => {
            const input = document.getElementById('user-problem-input');
            if (input && text) {
                input.value = text;
                app.handlePreTroubleshoot();
            }
        }, 150);
    },

    selectRole(roleLabel, emoji, roleKey) {
        this.selectedRole = { label: roleLabel, emoji, key: roleKey };
        document.getElementById('role-selection-view').classList.add('hidden');
        document.getElementById('login-form-view').classList.remove('hidden');

        const emailEl = document.getElementById('auth-email');
        const pwEl = document.getElementById('auth-password');
        const hintEl = document.getElementById('demo-autofill-hint');

        if (emailEl) emailEl.value = '';
        if (pwEl) pwEl.value = '';
        if (hintEl) hintEl.classList.add('hidden');

        const badge = document.getElementById('selected-role-badge');
        const roleEmoji = document.getElementById('selected-role-emoji');
        const roleName = document.getElementById('selected-role-name');
        const loginTitle = document.getElementById('login-title');
        if (badge) badge.classList.remove('hidden');
        if (roleEmoji) roleEmoji.textContent = emoji;
        if (roleName) roleName.textContent = roleLabel + ' Sign In';
        if (loginTitle) loginTitle.textContent = roleLabel + ' Sign In';

        setTimeout(() => {
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
        this.applyRoleNavigationVisibility(this.currentUser?.role || 'User');
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
        const roleKey  = this.selectedRole?.key || '';

        if (!email && !password && !roleKey) {
            errorText.textContent = 'Please choose a role or enter your credentials.';
            errorBanner.classList.remove('hidden');
            return;
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/^[a-zA-Z0-9._-]+$/.test(email)) {
            errorText.textContent = 'Please enter a valid institutional email address.';
            errorBanner.classList.remove('hidden');
            return;
        }

        submitBtn.disabled = true;
        btnText.classList.add('hidden');
        spinner.classList.remove('hidden');
        errorBanner.classList.add('hidden');

        try {
            const res = await Api.login({ email, password, roleKey });
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

                    const dest = this._postLoginHash || this.getDashboardRoute(res.user);
                this._postLoginHash = null;
                this.navigateToRoute(dest);
                sessionStorage.removeItem('entered_notif_seen');
                this.triggerEntranceNotification();
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

    // ---- Auth panel switching ----

    showSignIn() {
        document.getElementById('signin-panel')?.classList.remove('hidden');
        document.getElementById('register-panel')?.classList.add('hidden');
        document.getElementById('forgot-panel')?.classList.add('hidden');
        document.getElementById('auth-error-banner')?.classList.add('hidden');
    },

    showRegister() {
        document.getElementById('signin-panel')?.classList.add('hidden');
        document.getElementById('register-panel')?.classList.remove('hidden');
        document.getElementById('forgot-panel')?.classList.add('hidden');
        document.getElementById('reg-error-banner')?.classList.add('hidden');
        // Pre-fill user_type from selected role
        setTimeout(() => {
            const nameEl = document.getElementById('reg-name');
            if (nameEl) nameEl.focus();
        }, 50);
    },

    showForgotPassword() {
        document.getElementById('signin-panel')?.classList.add('hidden');
        document.getElementById('register-panel')?.classList.add('hidden');
        document.getElementById('forgot-panel')?.classList.remove('hidden');
        document.getElementById('forgot-banner')?.classList.add('hidden');
        document.getElementById('forgot-success')?.classList.add('hidden');
        // Pre-fill email if already typed
        const loginEmail = document.getElementById('auth-email')?.value?.trim();
        const forgotEmail = document.getElementById('forgot-email');
        if (forgotEmail && loginEmail) forgotEmail.value = loginEmail;
        setTimeout(() => {
            const el = document.getElementById('forgot-email');
            if (el) el.focus();
        }, 50);
    },

    toggleRegPassword() {
        const pwInput = document.getElementById('reg-password');
        const showIcon = document.getElementById('reg-pw-show');
        const hideIcon = document.getElementById('reg-pw-hide');
        if (!pwInput) return;
        const isPassword = pwInput.type === 'password';
        pwInput.type = isPassword ? 'text' : 'password';
        showIcon?.classList.toggle('hidden', isPassword);
        hideIcon?.classList.toggle('hidden', !isPassword);
    },

    async handleRegister() {
        const nameEl     = document.getElementById('reg-name');
        const emailEl    = document.getElementById('reg-email');
        const deptEl     = document.getElementById('reg-department');
        const pwEl       = document.getElementById('reg-password');
        const submitBtn  = document.getElementById('reg-submit-btn');
        const btnText    = document.getElementById('reg-btn-text');
        const spinner    = document.getElementById('reg-btn-spinner');
        const errorBanner = document.getElementById('reg-error-banner');
        const errorText   = document.getElementById('reg-error-text');

        if (!nameEl || !emailEl || !pwEl) return;

        const name       = nameEl.value.trim();
        const email      = emailEl.value.trim().toLowerCase();
        const department = deptEl?.value.trim() || 'General Campus';
        const password   = pwEl.value;

        // Map selected role key to user_type label
        const roleMap = {
            'student': 'Student', 'teaching': 'Teaching Staff',
            'non-teaching': 'Non-Teaching Staff', 'research': 'Research Staff',
            'lab': 'Lab Technician', 'maintenance': 'Maintenance Worker',
            'housekeeping': 'Housekeeping Staff', 'dept-admin': 'Staff', 'org-admin': 'Staff'
        };
        const user_type = roleMap[this.selectedRole?.key] || 'Student';

        // Client-side validation
        if (!name || name.length < 2) {
            errorText.textContent = 'Please enter your full name (at least 2 characters).';
            errorBanner.classList.remove('hidden');
            return;
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errorText.textContent = 'Please enter a valid institutional email address.';
            errorBanner.classList.remove('hidden');
            return;
        }
        if (!password) {
            errorText.textContent = 'Please choose a password.';
            errorBanner.classList.remove('hidden');
            return;
        }
        if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
            errorText.textContent = 'Password must be at least 8 characters and include letters and a number (e.g. Campus2026).';
            errorBanner.classList.remove('hidden');
            return;
        }

        submitBtn.disabled = true;
        btnText.classList.add('hidden');
        spinner.classList.remove('hidden');
        errorBanner.classList.add('hidden');

        try {
            const res = await Api.register({ name, email, password, user_type, department, designation: user_type });
            if (res && res.user) {
                this.isLoggedIn = true;
                this.currentUser = res.user;
                this.showAppLayout();
                this.bindNavigation();
                this.bindCopilot();
                this.bindNotifications();
                const dest = this._postLoginHash || this.getDashboardRoute(res.user);
                this._postLoginHash = null;
                this.navigateToRoute(dest);
            } else {
                throw new Error('Unexpected response');
            }
        } catch (err) {
            errorText.textContent = err.error || 'Registration failed. Please try again.';
            errorBanner.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    },

    async handleForgotPassword() {
        const emailEl    = document.getElementById('forgot-email');
        const submitBtn  = document.getElementById('forgot-submit-btn');
        const btnText    = document.getElementById('forgot-btn-text');
        const spinner    = document.getElementById('forgot-btn-spinner');
        const errorBanner = document.getElementById('forgot-banner');
        const errorText   = document.getElementById('forgot-banner-text');
        const successBanner = document.getElementById('forgot-success');

        const email = emailEl?.value?.trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errorText.textContent = 'Please enter a valid institutional email address.';
            errorBanner?.classList.remove('hidden');
            successBanner?.classList.add('hidden');
            return;
        }

        submitBtn.disabled = true;
        btnText.classList.add('hidden');
        spinner.classList.remove('hidden');
        errorBanner?.classList.add('hidden');

        try {
            await Api.forgotPassword(email);
        } catch(e) { /* Always show success for security */ }

        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
        errorBanner?.classList.add('hidden');
        successBanner?.classList.remove('hidden');
    },

    handleGoogleSignIn() {
        const modal = document.getElementById('google-sso-modal');
        const accountList = document.getElementById('demo-account-list');
        if (accountList) {
            accountList.replaceChildren(...this.demoAccounts.map((account, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'google-sso-account';
                button.addEventListener('click', () => this.selectDemoAccount(index));

                const avatar = document.createElement('span');
                avatar.className = 'google-sso-avatar';
                avatar.style.background = account.role === 'Department Admin' ? '#059669' : (account.role === 'Institutional Admin' ? '#1e40af' : '#2563eb');
                avatar.textContent = account.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();

                const info = document.createElement('span');
                info.className = 'google-sso-info';
                const name = document.createElement('span');
                name.className = 'google-sso-name';
                name.textContent = account.name;
                const email = document.createElement('span');
                email.className = 'google-sso-email';
                email.textContent = account.email;
                const meta = document.createElement('span');
                meta.className = 'google-sso-badge';
                meta.textContent = `${account.role} · ${account.department}`;
                info.append(name, email, meta);
                button.append(avatar, info);
                return button;
            }));
        }
        if (modal) {
            modal.classList.remove('hidden');
        }
    },

    closeGoogleModal() {
        const modal = document.getElementById('google-sso-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    async selectDemoAccount(accountIndex) {
        const account = this.demoAccounts[accountIndex];
        if (!account) return;
        this.closeGoogleModal();
        try {
            const res = await Api.login({ email: account.email, password: account.password, roleKey: account.roleKey });
            if (res && res.user) {
                this.isLoggedIn = true;
                this.currentUser = res.user;
                this.showAppLayout();
                this.bindNavigation();
                this.bindCopilot();
                this.bindNotifications();
                this.updateCurrentUserDisplay();

                const dest = this._postLoginHash || this.getDashboardRoute(res.user);
                this._postLoginHash = null;
                this.navigateToRoute(dest);
            } else {
                throw new Error('Demo account sign-in failed');
            }
        } catch(err) {
            console.error('Demo account sign-in error:', err);
            alert('Demo sign-in failed: ' + (err.error || err.message || 'Server error'));
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
        if (!drawer || !toggleBtn || toggleBtn.dataset.copilotBound === 'true') return;
        toggleBtn.dataset.copilotBound = 'true';

        toggleBtn.addEventListener('click', () => {
            drawer.classList.toggle('hidden');
            if (!drawer.classList.contains('hidden') && input) {
                setTimeout(() => input.focus(), 150);
            }
        });
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                drawer.classList.add('hidden');
            });
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                const chat = document.getElementById('copilot-chat-history');
                if (chat) chat.innerHTML = '';
                // Show intro pane again on clear
                const intro = document.getElementById('nexus-intro-pane');
                if (intro) intro.style.display = '';
            });
        }

        const handleSend = async () => {
            const query = input.value.trim();
            if (!query) return;

            // Hide intro pane once user starts chatting
            const intro = document.getElementById('nexus-intro-pane');
            if (intro) intro.style.display = 'none';

            const chat = document.getElementById('copilot-chat-history');
            // User bubble
            const userBubble = document.createElement('div');
            userBubble.className = 'nexus-msg nexus-msg--user';
            userBubble.textContent = query;
            chat.appendChild(userBubble);
            input.value = '';
            chat.scrollTop = chat.scrollHeight;

            // Loading bubble
            const loadingBubble = document.createElement('div');
            loadingBubble.className = 'nexus-msg nexus-msg--ai nexus-msg--loading';
            loadingBubble.innerHTML = `<span class="nexus-typing-dot"></span><span class="nexus-typing-dot"></span><span class="nexus-typing-dot"></span>`;
            chat.appendChild(loadingBubble);
            chat.scrollTop = chat.scrollHeight;

            try {
                const res = await Api.askCopilot(query);
                loadingBubble.remove();

                // Format markdown bold & linebreaks
                let formattedText = res.response
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/`(.*?)`/g, '<code class="nexus-code">$1</code>')
                    .replace(/\n/g, '<br>');

                let actionsHtml = '';
                if (res.suggestedActions && res.suggestedActions.length > 0) {
                    actionsHtml = `<div class="nexus-action-row">${res.suggestedActions.map(a =>
                        `<button class="nexus-action-chip" onclick="window.location.hash='${a.link}'">${a.label}</button>`
                    ).join('')}</div>`;
                }

                const aiBubble = document.createElement('div');
                aiBubble.className = 'nexus-msg nexus-msg--ai';
                aiBubble.innerHTML = `<div class="nexus-ai-label">NEXUS</div><div>${formattedText}</div>${actionsHtml}`;
                chat.appendChild(aiBubble);
                chat.scrollTop = chat.scrollHeight;
            } catch (e) {
                loadingBubble.remove();
                const errBubble = document.createElement('div');
                errBubble.className = 'nexus-msg nexus-msg--error';
                errBubble.textContent = 'Failed to reach NEXUS. Please try again.';
                chat.appendChild(errBubble);
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
        const markRead = dropdown?.querySelector('.mark-read');
        if (!notifBtn || !dropdown) return;

        this.refreshNotificationBadge();
        if (notifBtn.dataset.notificationsBound !== 'true') {
            notifBtn.dataset.notificationsBound = 'true';
            notifBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (dropdown.contains(e.target)) return;
                dropdown.classList.toggle('hidden');
                if (!dropdown.classList.contains('hidden')) {
                    this.loadNotificationsList();
                }
            });
            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target) && !notifBtn.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });
            markRead?.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    await Api.markNotificationsRead();
                    await this.loadNotificationsList();
                } catch (error) {
                    console.error('Unable to mark notifications read:', error);
                }
            });
        }
    },

    async refreshNotificationBadge(notifications) {
        const badge = document.getElementById('notif-badge');
        if (!badge) return;
        try {
            const items = notifications || await Api.getNotifications();
            const unreadCount = items.filter(item => item.unread).length;
            badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
            badge.classList.toggle('hidden', unreadCount === 0);
        } catch (error) {
            badge.classList.add('hidden');
        }
    },

    async loadNotificationsList() {
        const list = document.getElementById('notif-list');
        if (!list) return;
        list.innerHTML = '<div style="padding:12px; font-size:12px; color:#6b7280;">Loading notifications...</div>';
        try {
            const notifs = await Api.getNotifications();
            this.refreshNotificationBadge(notifs);
            if (!notifs || notifs.length === 0) {
                list.textContent = 'No notifications yet.';
                list.classList.add('notif-empty');
                return;
            }
            list.classList.remove('notif-empty');
            list.replaceChildren(...notifs.map(notification => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = `notif-item${notification.unread ? ' is-unread' : ''}`;
                const title = document.createElement('div');
                title.className = 'notif-title';
                title.textContent = notification.title || 'Complaint update';
                const message = document.createElement('div');
                message.className = 'notif-msg';
                message.textContent = notification.message || '';
                const timestamp = document.createElement('div');
                timestamp.className = 'notif-time';
                timestamp.textContent = notification.timestamp || '';
                item.append(title, message, timestamp);
                item.addEventListener('click', async () => {
                    if (notification.unread) {
                        await Api.markNotificationsRead([notification.id]);
                    }
                    if (notification.link) window.location.hash = notification.link;
                    document.getElementById('notif-dropdown')?.classList.add('hidden');
                });
                return item;
            }));
        } catch (e) {
            list.textContent = 'Failed to load notifications.';
            list.classList.add('notif-empty');
        }
    },

    toggleUserDropdown() {
        const dd = document.getElementById('header-user-dropdown');
        if (dd) dd.classList.toggle('hidden');
    },

    closeUserDropdown() {
        const dd = document.getElementById('header-user-dropdown');
        if (dd) dd.classList.add('hidden');
    },

    async updateCurrentUserDisplay() {
        try {
            const me = this.currentUser || await Api.getMe();
            this.currentUser = me;
            if (me) {
                const parts = me.name ? me.name.trim().split(' ') : ['U'];
                const initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
                const roleColor = me.role === 'Organization Admin' ? '#dc2626' : (me.role === 'Department Admin' ? '#059669' : '#0d9488');

                // Top header greeting matching reference UI
                const greetingEl = document.getElementById('top-header-greeting');
                const subGreetingEl = document.getElementById('top-header-sub');
                if (greetingEl) greetingEl.textContent = `Hello, ${me.name.toUpperCase()}`;
                if (subGreetingEl) subGreetingEl.textContent = me.role === 'Organization Admin'
                    ? "Welcome to Problemint Executive Command Center"
                    : (me.role === 'Department Admin'
                        ? `Welcome to ${me.department || 'Department'} Operations`
                        : "Welcome to Problemint Complaint Intelligence Platform");

                // Top header avatar
                const initialsEl = document.getElementById('user-avatar-initials');
                if (initialsEl) initialsEl.textContent = initials;

                // User profile dropdown details
                const dropAvatar = document.getElementById('dropdown-user-avatar');
                const dropName = document.getElementById('dropdown-user-name');
                const dropRole = document.getElementById('dropdown-user-role');
                const dropEmail = document.getElementById('dropdown-user-email');
                if (dropAvatar) dropAvatar.textContent = initials;
                if (dropName) dropName.textContent = me.name;
                if (dropRole) dropRole.textContent = `${me.designation || me.user_type || me.role}${me.department ? ' • ' + me.department : ''}`;
                if (dropEmail) dropEmail.textContent = me.email || '';

                // Sidebar user section
                const sidebarName = document.getElementById('sidebar-user-name');
                const sidebarRole = document.getElementById('sidebar-user-role');
                const sidebarAvatar = document.getElementById('sidebar-user-avatar');
                if (sidebarName) sidebarName.textContent = me.name;
                if (sidebarRole) sidebarRole.textContent = (me.designation || me.user_type || me.role) + (me.department ? ' · ' + me.department : '');
                if (sidebarAvatar) sidebarAvatar.textContent = initials;

                // Update nav-dashboard label dynamically
                const navDashboard = document.getElementById('nav-dashboard');
                if (navDashboard) {
                    const span = navDashboard.querySelector('span');
                    if (span) {
                        span.textContent = me.role === 'Organization Admin' ? 'Command Center' : 'Dept Workspace';
                    }
                }

                this.applyRoleNavigationVisibility(me.role);
            }
        } catch(e) {}
    },

    applyRoleNavigationVisibility(role) {
        // User (Student / Faculty / Staff) sees ONLY these 4 modules:
        const userViews      = ['home', 'submit-problem', 'my-complaints', 'settings'];
        // Department Admin uses the shared operational workspace plus scoped admin modules.
        const deptAdminViews = ['home', 'submit-problem', 'my-complaints', 'incidents', 'prevention-center', 'settings'];
        // Org Admin sees full executive suite:
        const orgAdminViews  = ['dashboard', 'incidents', 'knowledge-base',
                    'my-complaints', 'prevention-center', 'analytics', 'admin-users', 'settings'];

        let allowed = userViews;
        if (role === 'Organization Admin') allowed = orgAdminViews;
        else if (role === 'Department Admin') allowed = deptAdminViews;
        const roleType = (this.currentUser?.user_type || '').trim().toLowerCase();
        const isOperationalWorker = ['lab technician', 'maintenance worker', 'housekeeping worker'].includes(roleType);
        const canViewAssignments = this.isOperationalDashboardUser(this.currentUser);

        document.querySelectorAll('.nav-item').forEach(item => {
            const view = item.getAttribute('data-view');
            if (view) {
                if (allowed.includes(view)) {
                    item.classList.remove('hidden');
                    item.style.setProperty('display', 'flex', 'important');
                } else {
                    item.classList.add('hidden');
                    item.style.setProperty('display', 'none', 'important');
                }
            }
        });

        const assignedTasksNav = document.getElementById('nav-assigned-tasks');
        if (assignedTasksNav) {
            assignedTasksNav.classList.toggle('hidden', !canViewAssignments);
            assignedTasksNav.style.setProperty('display', canViewAssignments ? 'flex' : 'none', 'important');
            const label = assignedTasksNav.querySelector('span');
            if (label) label.textContent = 'My Assigned Tasks';
        }

        const myComplaintsLabel = document.querySelector('#nav-my-complaints span');
        if (myComplaintsLabel) {
            myComplaintsLabel.textContent = role === 'Organization Admin' ? 'All Complaints' : (role === 'Department Admin' ? 'Department Complaints' : (isOperationalWorker ? 'My Reports' : 'My Complaints'));
        }
        const dashboardNav = document.getElementById('nav-home');
        const dashboardLabel = dashboardNav?.querySelector('span');
        if (dashboardNav) dashboardNav.href = this.getDashboardRoute(this.currentUser);
        if (dashboardLabel) {
            const labels = {
                'teaching staff': 'Teaching Dashboard',
                'non-teaching staff': 'Staff Dashboard',
                'research staff': 'Research Dashboard',
                'lab technician': 'Lab Workboard',
                'maintenance worker': 'Maintenance Tasks',
                'housekeeping worker': 'Housekeeping Tasks'
            };
            dashboardLabel.textContent = role === 'User' ? (labels[roleType] || 'Dashboard') : 'Dashboard';
        }

        // Specific element guards
        const adminUsersNav = document.getElementById('nav-item-admin-users');
        if (adminUsersNav) adminUsersNav.style.setProperty('display', role === 'Organization Admin' ? 'flex' : 'none', 'important');

        const analyticsNav = document.getElementById('nav-analytics');
        if (analyticsNav) analyticsNav.style.setProperty('display', role === 'Organization Admin' ? 'flex' : 'none', 'important');

        const knowledgeNav = document.getElementById('nav-knowledge-base');
        if (knowledgeNav) knowledgeNav.style.setProperty('display', role === 'Organization Admin' ? 'flex' : 'none', 'important');

        const incidentsNav = document.getElementById('nav-incidents');
        if (incidentsNav) incidentsNav.style.setProperty('display', (role === 'Department Admin' || role === 'Organization Admin') ? 'flex' : 'none', 'important');

        const preventionNav = document.getElementById('nav-prevention-center');
        if (preventionNav) preventionNav.style.setProperty('display', (role === 'Department Admin' || role === 'Organization Admin') ? 'flex' : 'none', 'important');

        const deptWorkspaceNav = document.getElementById('nav-dashboard');
        if (deptWorkspaceNav) {
            deptWorkspaceNav.style.setProperty('display', role === 'Organization Admin' ? 'flex' : 'none', 'important');
            const span = deptWorkspaceNav.querySelector('span');
            if (span) {
                span.textContent = role === 'Organization Admin' ? 'Executive Overview' : 'Dept Workspace';
            }
        }

        // Update copilot suggestions based on role
        const suggestions = document.getElementById('copilot-suggestions');
        if (suggestions) {
            if (role === 'User' && roleType === 'student') {
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
            } else if (role === 'Organization Admin') {
                suggestions.innerHTML = `
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('How many pending complaints are there?')">Pending complaints →</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('Which department has the most overdue tickets?')">Overdue by dept →</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('Show all escalated complaints')">Escalations →</button>
                `;
            } else if (isOperationalWorker) {
                suggestions.innerHTML = `
                    <button class="quick-action-btn" onclick="window.location.hash='#assigned-tasks'">Open my assigned tasks →</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('How do I update the status of an assigned campus task?')">Update task status →</button>
                `;
            } else {
                suggestions.innerHTML = `
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('How do I report a campus issue?')">Report a campus issue →</button>
                    <button class="quick-action-btn" onclick="app.suggestCopilotQuery('How do I track my complaint?')">Track my report →</button>
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

        if (['problem-intelligence', 'emerging-problems'].includes(hash.split('/')[0])) {
            window.location.hash = this.currentUser?.role === 'Organization Admin' ? '#knowledge-base' : '#dashboard';
            return;
        }

        // 4. Safely redirect removed Knowledge Base to home
        if (hash.split('/')[0] === 'assigned-tasks' && !this.isOperationalDashboardUser()) {
            alert('Access Restricted: Assigned complaints are available to staff accounts only.');
            window.location.hash = '#home';
            return;
        }

        if (hash.split('/')[0] === 'staff-dashboard' && !this.isOperationalDashboardUser()) {
            window.location.hash = this.getDashboardRoute(this.currentUser);
            return;
        }

        if (hash.split('/')[0] === 'dashboard' && this.currentUser?.role === 'Department Admin') {
            window.location.hash = '#staff-dashboard';
            return;
        }

        // 5. Restrict ordinary users from accessing administrator pages
        const isAdmin = this.currentUser?.role === 'Department Admin' || this.currentUser?.role === 'Organization Admin';
        const adminOnlyViews = ['dashboard', 'incidents', 'knowledge-base', 'prevention-center', 'analytics', 'admin-users'];
        if (!isAdmin && adminOnlyViews.includes(hash.split('/')[0])) {
            alert('Access Restricted: This module is only accessible to authorized institutional and department administrators.');
            window.location.hash = '#home';
            return;
        }

        // Restrict non-org-admins from user account management and platform-wide analytics
        if (this.currentUser?.role !== 'Organization Admin' && (hash === 'admin-users' || hash === 'analytics' || hash === 'knowledge-base')) {
            alert('Access Restricted: This executive module is only accessible to Platform Administrators.');
            window.location.hash = '#dashboard';
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
        if (window.Chart) {
            Object.values(Chart.instances || {}).forEach(chart => chart.destroy());
        }
        container.innerHTML = `<div style="padding:40px; text-align:center; color:#6b7280;">Loading view...</div>`;

        // Redirect admins from #home to their dashboard
        const isAdminUser = this.currentUser?.role === 'Department Admin' || this.currentUser?.role === 'Organization Admin';
        if (viewName === 'home' && isAdminUser) {
            window.location.hash = this.getDashboardRoute(this.currentUser);
            return;
        }
        if (viewName === 'home' && (this.currentUser?.user_type || 'Student').trim().toLowerCase() !== 'student') {
            window.location.hash = '#staff-dashboard';
            return;
        }

        switch (viewName) {
            case 'home':
                this.renderUserHome(container);
                break;
            case 'staff-dashboard':
                this.renderRoleDashboard(container);
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
            case 'assigned-tasks':
                this.renderAssignedTasks(container);
                break;
            case 'ai-assistant':
                this.renderAiAssistant(container);
                break;
            case 'incidents':
                if (param) this.renderIncidentDetail(container, param);
                else this.renderIncidents(container);
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
            case 'admin-users':
                this.renderAdminUsers(container);
                break;
            case 'settings':
                this.renderSettings(container);
                break;
            default:
                if (isAdminUser) {
                    this.renderDashboard(container);
                } else {
                    this.renderUserHome(container);
                }
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
    // ==========================================
    // 0. USER HOME VIEW (Problemint Clean Blue Design)
    // ==========================================
    async renderUserHome(container) {
        if ((this.currentUser?.user_type || 'Student').trim().toLowerCase() !== 'student') {
            return this.renderRoleDashboard(container);
        }
        try {
            const me = this.currentUser || await Api.getMe();
            this.currentUser = me;
            const firstName = (me && me.name) ? me.name.split(' ')[0] : 'there';

            // Fetch user's complaints and notifications
            const [complaints, notifs] = await Promise.all([
                Api.getComplaints().catch(() => []),
                Api.getNotifications().catch(() => [])
            ]);

            const activeProblems = complaints.filter(c => c.status !== 'Resolved' && c.status !== 'Closed');
            const pendingVerify = complaints.filter(c => c.status === 'Resolved' && !c.verified);
            const resolvedCount = complaints.filter(c => c.status === 'Resolved' || c.status === 'Closed').length;

            const firstActive = activeProblems.length > 0 ? activeProblems[0] : null;

            // Relevant notifications for right column
            const displayNotifs = (notifs || []).slice(0, 4);

            container.innerHTML = `
                <div class="dash-grid-layout">
                    <!-- LEFT MAIN COLUMN (68%) -->
                    <div class="dash-main-col">
                        <!-- High-Impact Welcome & Quick Action Hero Banner -->
                        <div class="user-hero-banner" style="background: linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%); color: #ffffff; border-radius: 18px; padding: 26px 30px; margin-bottom: 24px; box-shadow: 0 10px 25px rgba(37, 99, 235, 0.22); position: relative; overflow: hidden;">
                            <div style="position: absolute; right: -20px; top: -20px; opacity: 0.12; pointer-events: none;">
                                <svg width="220" height="220" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7L12 12L22 7L12 2Z"/></svg>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; position:relative; z-index:2;">
                                <div style="max-width: 580px;">
                                    <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.18); padding:5px 12px; border-radius:20px; font-size:12px; font-weight:700; letter-spacing:0.4px; text-transform:uppercase; margin-bottom:10px; backdrop-filter:blur(4px);">
                                        <span style="display:inline-block; width:7px; height:7px; background:#93c5fd; border-radius:50%;"></span>
                                        Problemint Live Resolution Hub
                                    </div>
                                    <h2 style="font-size:24px; font-weight:800; margin:0 0 6px; letter-spacing:-0.4px; color:#ffffff;">Welcome back, ${firstName}!</h2>
                                    <p style="font-size:14px; opacity:0.92; margin:0; line-height:1.45; color:#eff6ff;">Report disruptions across campus facilities in seconds. Track live progress, get automated updates, and verify solutions once resolved.</p>
                                </div>
                                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                                    <button onclick="window.location.hash='#submit-problem'" style="background:#ffffff; color:#1d4ed8; font-weight:800; padding:12px 20px; border-radius:12px; border:none; font-size:14px; cursor:pointer; display:flex; align-items:center; gap:8px; box-shadow:0 4px 12px rgba(0,0,0,0.12); transition:transform 0.15s;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">
                                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
                                        Report a Problem
                                    </button>
                                    <button onclick="window.location.hash='#my-complaints'" style="background:rgba(255,255,255,0.15); color:#ffffff; font-weight:700; padding:12px 18px; border-radius:12px; border:1.5px solid rgba(255,255,255,0.35); font-size:14px; cursor:pointer; display:flex; align-items:center; gap:8px; backdrop-filter:blur(4px); transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.25)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">
                                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                                        My Submissions (${complaints.length})
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- 1-Click Fast Category Launcher -->
                        <div style="margin-bottom:24px;">
                            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
                                <h3 style="font-size:17px; font-weight:800; color:#0f172a; margin:0;">What problem do you want to report?</h3>
                                <span style="font-size:12.5px; color:#2563eb; font-weight:700;">1-Click AI Fast Triage</span>
                            </div>
                            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px;">
                                <div class="quick-category-tile" onclick="app.prefillAndReport('Wi-Fi connection is slow or dropping in Block B')" style="background:#ffffff; border:1.5px solid #dbeafe; border-radius:14px; padding:14px 12px; cursor:pointer; transition:all 0.15s; text-align:center;" onmouseover="this.style.borderColor='#2563eb'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(37,99,235,0.1)'" onmouseout="this.style.borderColor='#dbeafe'; this.style.transform='none'; this.style.boxShadow='none'">
                                    <div style="width:38px; height:38px; border-radius:10px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; margin:0 auto 8px; font-size:18px;">📶</div>
                                    <div style="font-size:13px; font-weight:800; color:#0f172a;">Wi-Fi & Internet</div>
                                    <div style="font-size:11px; color:#64748b; margin-top:2px;">Drops, router down</div>
                                </div>
                                <div class="quick-category-tile" onclick="app.prefillAndReport('Power socket / electrical switch loose or sparking in classroom')" style="background:#ffffff; border:1.5px solid #dbeafe; border-radius:14px; padding:14px 12px; cursor:pointer; transition:all 0.15s; text-align:center;" onmouseover="this.style.borderColor='#2563eb'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(37,99,235,0.1)'" onmouseout="this.style.borderColor='#dbeafe'; this.style.transform='none'; this.style.boxShadow='none'">
                                    <div style="width:38px; height:38px; border-radius:10px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; margin:0 auto 8px; font-size:18px;">⚡</div>
                                    <div style="font-size:13px; font-weight:800; color:#0f172a;">Power & Light</div>
                                    <div style="font-size:11px; color:#64748b; margin-top:2px;">Outlets, switches</div>
                                </div>
                                <div class="quick-category-tile" onclick="app.prefillAndReport('Drinking water purifier dispenser empty or tap leaking in restroom')" style="background:#ffffff; border:1.5px solid #dbeafe; border-radius:14px; padding:14px 12px; cursor:pointer; transition:all 0.15s; text-align:center;" onmouseover="this.style.borderColor='#2563eb'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(37,99,235,0.1)'" onmouseout="this.style.borderColor='#dbeafe'; this.style.transform='none'; this.style.boxShadow='none'">
                                    <div style="width:38px; height:38px; border-radius:10px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; margin:0 auto 8px; font-size:18px;">💧</div>
                                    <div style="font-size:13px; font-weight:800; color:#0f172a;">Water & Plumbing</div>
                                    <div style="font-size:11px; color:#64748b; margin-top:2px;">Purifier, leaks</div>
                                </div>
                                <div class="quick-category-tile" onclick="app.prefillAndReport('Lab computer system not booting or projector display failure in Lab 3')" style="background:#ffffff; border:1.5px solid #dbeafe; border-radius:14px; padding:14px 12px; cursor:pointer; transition:all 0.15s; text-align:center;" onmouseover="this.style.borderColor='#2563eb'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(37,99,235,0.1)'" onmouseout="this.style.borderColor='#dbeafe'; this.style.transform='none'; this.style.boxShadow='none'">
                                    <div style="width:38px; height:38px; border-radius:10px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; margin:0 auto 8px; font-size:18px;">💻</div>
                                    <div style="font-size:13px; font-weight:800; color:#0f172a;">Lab & Systems</div>
                                    <div style="font-size:11px; color:#64748b; margin-top:2px;">PCs, projectors</div>
                                </div>
                                <div class="quick-category-tile" onclick="app.prefillAndReport('Classroom hallway trash bin overflow or dust cleaning required')" style="background:#ffffff; border:1.5px solid #dbeafe; border-radius:14px; padding:14px 12px; cursor:pointer; transition:all 0.15s; text-align:center;" onmouseover="this.style.borderColor='#2563eb'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(37,99,235,0.1)'" onmouseout="this.style.borderColor='#dbeafe'; this.style.transform='none'; this.style.boxShadow='none'">
                                    <div style="width:38px; height:38px; border-radius:10px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; margin:0 auto 8px; font-size:18px;">🧹</div>
                                    <div style="font-size:13px; font-weight:800; color:#0f172a;">Sanitation</div>
                                    <div style="font-size:11px; color:#64748b; margin-top:2px;">Cleanliness, bins</div>
                                </div>
                                <div class="quick-category-tile" onclick="window.location.hash='#submit-problem'" style="background:#f8fafc; border:1.5px dashed #bfdbfe; border-radius:14px; padding:14px 12px; cursor:pointer; transition:all 0.15s; text-align:center;" onmouseover="this.style.borderColor='#2563eb'; this.style.background='#eff6ff'" onmouseout="this.style.borderColor='#bfdbfe'; this.style.background='#f8fafc'">
                                    <div style="width:38px; height:38px; border-radius:10px; background:#dbeafe; color:#2563eb; display:flex; align-items:center; justify-content:center; margin:0 auto 8px; font-size:18px;">➕</div>
                                    <div style="font-size:13px; font-weight:800; color:#2563eb;">Custom Report</div>
                                    <div style="font-size:11px; color:#64748b; margin-top:2px;">Any other issue</div>
                                </div>
                            </div>
                        </div>

                        <!-- Active Alert Banner (Only shown if active problem or pending verification exists) -->
                        ${firstActive ? `
                            <div style="background:#eff6ff; border:1.5px solid #bfdbfe; border-radius:14px; padding:16px 20px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                                <div>
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <span style="font-weight:800; font-size:12px; color:#2563eb; background:#dbeafe; padding:2px 8px; border-radius:6px;">#${firstActive.complaintId}</span>
                                        <span style="font-size:14.5px; font-weight:800; color:#0f172a;">${firstActive.complaintText.slice(0, 75)}</span>
                                    </div>
                                    <div style="font-size:12.5px; color:#64748b; margin-top:4px;">
                                        📍 ${firstActive.location} &bull; 🏛️ ${firstActive.department} &bull; Status: <strong style="color:#2563eb;">${firstActive.status}</strong>
                                    </div>
                                </div>
                                <button style="background:#2563eb; color:#ffffff; font-size:12.5px; font-weight:700; padding:8px 16px; border-radius:10px; border:none; cursor:pointer;" onclick="app.viewTicketTimelineModal('${firstActive.complaintId}')">Track Progress &rarr;</button>
                            </div>
                        ` : ''}

                        ${pendingVerify.length > 0 ? `
                            <div style="background:#fefce8; border:1.5px solid #fde047; border-radius:14px; padding:16px 20px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                                <div>
                                    <div style="font-weight:800; font-size:14px; color:#854d0e;">⚠️ Solution Reported — Confirm Fix for #${pendingVerify[0].complaintId}</div>
                                    <div style="font-size:12px; color:#713f12; margin-top:3px;">Staff marked your report resolved. Please confirm whether the issue is completely fixed.</div>
                                </div>
                                <button style="background:#059669; color:#ffffff; font-size:12.5px; font-weight:700; padding:8px 16px; border-radius:10px; border:none; cursor:pointer;" onclick="app.showVerificationModal('${pendingVerify[0].complaintId}')">Confirm Fix &rarr;</button>
                            </div>
                        ` : ''}

                        <!-- Chart Visualization Block (Pure Blue Styling) -->
                        <div class="dash-chart-block">
                            <div class="dash-chart-card">
                                <div class="dash-chart-header">
                                    <div>
                                        <div class="dash-chart-title">Submission Activity</div>
                                        <div class="dash-chart-sub">Last 7 days &bull; Your activity</div>
                                    </div>
                                    <span class="dash-chart-badge" style="background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe;">Live</span>
                                </div>
                                <div class="dash-chart-canvas-wrap">
                                    <canvas id="userActivityChart" height="120"></canvas>
                                </div>
                            </div>
                            <div class="dash-chart-card dash-chart-card--doughnut">
                                <div class="dash-chart-header">
                                    <div>
                                        <div class="dash-chart-title">Status Breakdown</div>
                                        <div class="dash-chart-sub">Your complaint lifecycle</div>
                                    </div>
                                </div>
                                <div class="dash-chart-donut-wrap">
                                    <canvas id="statusDonutChart" width="120" height="120"></canvas>
                                    <div class="dash-donut-legend">
                                        <div class="donut-legend-item"><span class="legend-dot" style="background:#2563eb"></span>Active <strong>${activeProblems.length}</strong></div>
                                        <div class="donut-legend-item"><span class="legend-dot" style="background:#3b82f6"></span>Resolved <strong>${resolvedCount}</strong></div>
                                        <div class="donut-legend-item"><span class="legend-dot" style="background:#93c5fd"></span>Pending Verify <strong>${pendingVerify.length}</strong></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT SIDEBAR COLUMN (32%) -->
                    <div class="dash-side-col">
                        <div class="recent-notifications-card">
                            <div class="recent-notif-title" style="display:flex; justify-content:space-between; align-items:center;">
                                <span>Recent Updates</span>
                                <span style="font-size:11.5px; background:#eff6ff; color:#2563eb; padding:3px 8px; border-radius:10px; font-weight:700;">Live Feed</span>
                            </div>
                            <div class="recent-notif-list">
                                ${displayNotifs.map(n => `
                                    <div class="recent-notif-item" onclick="window.location.hash='${n.link || '#my-complaints'}'" style="cursor:pointer; border-radius:10px; padding:10px 8px; transition:background 0.15s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                                        <div class="recent-notif-icon" style="background:#eff6ff; border:1.5px solid #bfdbfe; color:#2563eb;">
                                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 01-6 0v-1m6 0H9"/></svg>
                                        </div>
                                        <div class="recent-notif-body">
                                            <div class="recent-notif-row">
                                                <div class="recent-notif-heading" style="color:#0f172a; font-weight:700; font-size:13.5px;">${n.title}</div>
                                                <div class="recent-notif-time" style="font-size:11px; color:#94a3b8;">${n.timestamp || 'Recent'}</div>
                                            </div>
                                            <div class="recent-notif-desc" style="font-size:12.5px; color:#64748b; margin-top:2px; line-height:1.4;">${n.message}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            <div class="recent-notif-footer" style="margin-top:16px; padding-top:12px; border-top:1px solid #f1f5f9; text-align:center;">
                                <a href="#my-complaints" style="color:#2563eb; font-weight:700; font-size:13px; text-decoration:none;">View all ticket updates &rarr;</a>
                            </div>
                        </div>

                        <!-- Problemint Quick Assistance Card -->
                        <div style="background:#ffffff; border:1.5px solid #dbeafe; border-radius:16px; padding:18px; margin-top:18px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                            <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                                <div style="width:34px; height:34px; border-radius:10px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; font-size:16px;">💡</div>
                                <div style="font-size:14px; font-weight:800; color:#0f172a;">Need Quick Help?</div>
                            </div>
                            <p style="font-size:12.5px; color:#64748b; line-height:1.45; margin:0 0 12px;">Our NEXUS AI assistant can answer questions, check complaint status, or provide instant safety steps.</p>
                            <button onclick="document.getElementById('copilot-toggle-btn').click()" style="width:100%; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; font-weight:700; font-size:13px; padding:9px; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                                <span>Open NEXUS Assistant</span>
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Init Charts with pure Blue palette after DOM is ready
            setTimeout(() => {
                const actCtx = document.getElementById('userActivityChart');
                if (actCtx && window.Chart) {
                    Chart.getChart(actCtx)?.destroy();
                    new Chart(actCtx, {
                        type: 'line',
                        data: {
                            labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
                            datasets: [{
                                label: 'Complaints',
                                data: complaints.length > 0
                                    ? [0, 0, 0, 0, complaints.length, 0, 0]
                                    : [0, 1, 0, 0, 0, 0, 0],
                                fill: true,
                                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                                borderColor: '#2563eb',
                                borderWidth: 2.5,
                                pointBackgroundColor: '#2563eb',
                                pointRadius: 4,
                                tension: 0.4
                            }]
                        },
                        options: {
                            responsive: true,
                            plugins: { legend: { display: false } },
                            scales: {
                                x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#94a3b8' } },
                                y: { grid: { color: '#f1f5f9' }, ticks: { stepSize: 1, font: { size: 11 }, color: '#94a3b8' }, min: 0 }
                            }
                        }
                    });
                }

                const donutCtx = document.getElementById('statusDonutChart');
                if (donutCtx && window.Chart) {
                    Chart.getChart(donutCtx)?.destroy();
                    const total = complaints.length;
                    new Chart(donutCtx, {
                        type: 'doughnut',
                        data: {
                            labels: ['Active','Resolved','Pending Verify'],
                            datasets: [{
                                data: total > 0
                                    ? [activeProblems.length, resolvedCount, pendingVerify.length]
                                    : [1, 0, 0],
                                backgroundColor: ['#1e40af', '#2563eb', '#93c5fd'],
                                borderWidth: 0,
                                hoverOffset: 6
                            }]
                        },
                        options: {
                            cutout: '68%',
                            plugins: { legend: { display: false }, tooltip: { enabled: true } },
                            animation: { duration: 800 }
                        }
                    });
                }
            }, 80);

        } catch (e) {
            container.innerHTML = `<div style="color:red; padding:20px;">Error loading home: ${e.message}</div>`;
        }
    },

    async renderRoleDashboard(container) {
        try {
            const profile = this.currentUser || await Api.getMe();
            this.currentUser = profile;
            const roleType = (profile.user_type || 'Campus staff').trim();
            const roleKey = roleType.toLowerCase();
            const roleCopy = {
                'department admin': [`${profile.department || 'Department'} Workspace`, 'Review department complaints, monitor response times, and acknowledge incoming work.'],
                'teaching staff': ['Teaching Staff Dashboard', 'Report and track classroom, teaching-facility, network, and campus issues.'],
                'non-teaching staff': ['Staff Operations Dashboard', 'Track the campus issues you report and follow their current status.'],
                'research staff': ['Research Staff Dashboard', 'Track reports affecting your authorised research facilities and campus work.'],
                'lab technician': ['Laboratory Workboard', 'Review and update only laboratory tasks assigned to your account.'],
                'maintenance worker': ['Maintenance Workboard', 'Review campus maintenance tasks assigned to your account.'],
                'housekeeping worker': ['Housekeeping Workboard', 'Review cleaning tasks assigned to your account and record completed work.']
            };
            const [title, description] = roleCopy[roleKey] || ['Campus Staff Dashboard', 'Report campus issues and follow the progress of your submissions.'];
            const operationalWorker = ['lab technician', 'maintenance worker', 'housekeeping worker'].includes(roleKey);
            const departmentAdmin = profile.role === 'Department Admin';
            const [records, notifications] = await Promise.all([
                Api.getComplaints(),
                Api.getNotifications().catch(() => [])
            ]);
            const ownReports = records.filter(record => record.userName === profile.name);
            const assignedComplaints = records.filter(record => record.assignedPerson === profile.name && record.userName !== profile.name);
            const assignedTasks = operationalWorker ? assignedComplaints : [];
            const visibleRecords = departmentAdmin ? records : (operationalWorker ? assignedTasks : ownReports);
            const activeCount = visibleRecords.filter(record => !['Resolved', 'Closed'].includes(record.status)).length;
            const resolvedCount = visibleRecords.filter(record => ['Resolved', 'Closed'].includes(record.status)).length;
            const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
            const recentRows = visibleRecords.slice(0, 4);

            container.innerHTML = `
                <div class="view-header">
                    <div><h1>${escapeHtml(title)}, ${escapeHtml((profile.name || '').split(' ')[0])}</h1><p>${escapeHtml(description)}</p></div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                        <a href="#submit-problem" class="btn-header-primary">+ Report a Problem</a>
                        ${this.isOperationalDashboardUser(profile) ? `<a href="#assigned-tasks" class="quick-action-btn">${departmentAdmin ? 'Open department queue' : (operationalWorker ? 'Open assigned tasks' : 'View assigned complaints')}</a>` : ''}
                    </div>
                </div>
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-label">${departmentAdmin ? 'Department Complaints' : (operationalWorker ? 'Assigned Tasks' : 'My Reports')} <span>📋</span></div><div class="stat-value">${visibleRecords.length}</div></div>
                    <div class="stat-card"><div class="stat-label">${departmentAdmin ? 'Awaiting Acknowledgement' : `Active ${operationalWorker ? 'Work' : 'Reports'}`} <span>⏳</span></div><div class="stat-value">${departmentAdmin ? visibleRecords.filter(record => !record.acknowledgedAt && !['Resolved', 'Closed'].includes(record.status)).length : activeCount}</div></div>
                    ${operationalWorker || departmentAdmin ? '' : `<div class="stat-card"><div class="stat-label">Assigned to Me <span>📥</span></div><div class="stat-value">${assignedComplaints.length}</div></div>`}
                    <div class="stat-card"><div class="stat-label">Completed <span>✓</span></div><div class="stat-value">${resolvedCount}</div></div>
                    <div class="stat-card"><div class="stat-label">Recent Updates <span>🔔</span></div><div class="stat-value">${notifications.length}</div></div>
                </div>
                ${operationalWorker || departmentAdmin ? `
                    <div class="view-header" style="margin-top:24px;"><div><h2>${departmentAdmin ? 'Department Queue' : 'Work Requiring Attention'}</h2><p>${departmentAdmin ? `Only ${escapeHtml(profile.department)} complaints are shown.` : 'Only tasks assigned to your account are shown here.'}</p></div></div>
                    ${recentRows.length ? `<div class="complaint-cards">${recentRows.map(task => `
                        <article class="complaint-card">
                            <div class="complaint-card-header"><span class="complaint-card-id">#${escapeHtml(task.complaintId)}</span><span class="status-badge ${task.status === 'In Progress' ? 'status-in-progress' : 'status-submitted'}">${escapeHtml(task.status)}</span></div>
                            <div class="complaint-card-title">${escapeHtml(task.complaintText)}</div>
                            <div class="complaint-card-meta"><span>📍 <strong>${escapeHtml(task.location)}</strong></span><span>Priority: <strong>${escapeHtml(task.severity)}</strong></span><span>Due: <strong>${escapeHtml(task.acknowledgementDeadline || 'Not set')}</strong></span>${departmentAdmin ? `<span>Reported by: <strong>${escapeHtml(task.userName)}</strong></span>` : ''}</div>
                            <div class="complaint-card-footer"><div style="display:flex;gap:8px;flex-wrap:wrap;">${departmentAdmin && !task.acknowledgedAt && !['Resolved','Closed'].includes(task.status) ? `<button class="btn-header-primary" onclick="app.handleAcknowledgeComplaint('${escapeHtml(task.complaintId)}')">Acknowledge</button>` : ''}<button class="quick-action-btn" onclick="app.viewTicketTimelineModal('${escapeHtml(task.complaintId)}')">View Details &amp; Photos</button></div></div>
                        </article>`).join('')}</div>` : '<div class="card" style="padding:28px;color:#64748b;">No tasks are currently assigned to you.</div>'}
                ` : `
                    <div class="dashboard-grid" style="margin-top:24px;">
                        <section class="card"><div class="card-title">Recent Reports</div>
                            ${recentRows.length ? recentRows.map(record => `<div class="attention-card"><div class="attention-type">${escapeHtml(record.category)}</div><div class="attention-title">${escapeHtml(record.complaintText)}</div><div class="attention-desc">${escapeHtml(record.location)} · ${escapeHtml(record.status)}</div></div>`).join('') : '<div style="padding:18px 0;color:#64748b;">No reports submitted yet.</div>'}
                        </section>
                        <section class="card"><div class="card-title">Recent Notifications</div>
                            ${notifications.length ? notifications.slice(0, 5).map(item => `<div class="attention-card"><div class="attention-type">${escapeHtml(item.title)}</div><div class="attention-desc">${escapeHtml(item.message)}</div><div class="attention-desc">${escapeHtml(item.timestamp)}</div></div>`).join('') : '<div style="padding:18px 0;color:#64748b;">No complaint updates yet.</div>'}
                        </section>
                    </div>
                    <section class="card" style="margin-top:24px;"><div class="card-title">Complaints Assigned to Me</div>
                        ${assignedComplaints.length ? assignedComplaints.slice(0, 5).map(item => `<article class="attention-card"><div class="attention-type">${escapeHtml(item.complaintId)} · ${escapeHtml(item.category)} · ${escapeHtml(item.status)}</div><div class="attention-title">${escapeHtml(item.complaintText)}</div><div class="attention-desc">Reported by ${escapeHtml(item.userName)} · ${escapeHtml(item.location)} · ${escapeHtml(item.department)}</div><button class="quick-action-btn" onclick="app.viewTicketTimelineModal('${escapeHtml(item.complaintId)}')">View complaint details</button></article>`).join('') : '<div style="padding:18px 0;color:#64748b;">No complaints are currently assigned to your account.</div>'}
                    </section>
                `}
            `;
        } catch (error) {
            container.innerHTML = '<div class="card" style="padding:24px;color:#b91c1c;">Unable to load this staff dashboard.</div>';
        }
    },

    async renderAssignedTasks(container) {
        try {
            const profile = this.currentUser || await Api.getMe();
            this.currentUser = profile;
            const records = await Api.getComplaints();
            const departmentAdmin = profile.role === 'Department Admin';
            const tasks = departmentAdmin ? records : records.filter(record => record.assignedPerson === profile.name && record.userName !== profile.name);
            const operationalWorker = ['lab technician', 'maintenance worker', 'housekeeping worker'].includes((profile.user_type || '').trim().toLowerCase());
            const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
            const title = departmentAdmin ? `${profile.department || 'Department'} Queue` : (!operationalWorker ? 'Complaints Assigned to Me' : (profile.user_type === 'Housekeeping worker' ? 'Cleaning / Housekeeping Issues' : (profile.user_type === 'Lab technician' ? 'Lab and Equipment Issues' : 'Maintenance Tasks')));
            container.innerHTML = `
                <div class="view-header"><div><h1>${escapeHtml(title)}</h1><p>${departmentAdmin ? 'Department complaints in your authorized scope. Acknowledge incoming work and inspect evidence.' : (operationalWorker ? 'Assigned work only. Update progress and record what was completed.' : 'Read-only complaints assigned to your account. Your own reports remain under My Complaints.')}</p></div></div>
                ${tasks.length ? `<div class="complaint-cards">${tasks.map(task => `
                    <article class="complaint-card">
                        <div class="complaint-card-header"><span class="complaint-card-id">#${escapeHtml(task.complaintId)}</span><span class="status-badge ${task.status === 'In Progress' ? 'status-in-progress' : (['Resolved','Closed'].includes(task.status) ? 'status-resolved' : 'status-submitted')}">${escapeHtml(task.status)}</span></div>
                        <div class="complaint-card-title">${escapeHtml(task.complaintText)}</div>
                        <div class="complaint-card-meta"><span>📍 <strong>${escapeHtml(task.location)}</strong></span><span>Category: <strong>${escapeHtml(task.category)}</strong></span><span>Priority: <strong>${escapeHtml(task.severity)}</strong></span><span>Due: <strong>${escapeHtml(task.acknowledgementDeadline || 'Not set')}</strong></span></div>
                        <div class="complaint-card-footer"><span>${escapeHtml(task.department)}</span><div style="display:flex;gap:8px;flex-wrap:wrap;">
                            ${(operationalWorker || departmentAdmin) && !task.acknowledgedAt && !['Resolved','Closed'].includes(task.status) ? `<button class="quick-action-btn" onclick="app.handleAcknowledgeComplaint('${escapeHtml(task.complaintId)}')">Acknowledge</button>` : ''}
                            ${operationalWorker && !['Resolved','Closed'].includes(task.status) ? `<button class="quick-action-btn" onclick="app.updateWorkerTask('${escapeHtml(task.complaintId)}','In Progress')">Add Progress Note</button><button class="btn-header-primary" onclick="app.updateWorkerTask('${escapeHtml(task.complaintId)}','Resolved')">Mark Complete</button>` : ''}
                            <button class="quick-action-btn" onclick="app.viewTicketTimelineModal('${escapeHtml(task.complaintId)}')">View Details &amp; Photos</button>
                        </div></div>
                    </article>`).join('')}</div>` : `<div class="card" style="padding:36px 24px;text-align:center;color:#64748b;"><h2 style="color:#1e293b;">${departmentAdmin ? 'No department complaints' : 'No assigned tasks'}</h2><p>${departmentAdmin ? 'New complaints for your department will appear here.' : 'Tasks routed to your account will appear here.'}</p></div>`}
            `;
        } catch (error) {
            container.innerHTML = '<div class="card" style="padding:24px;color:#b91c1c;">Unable to load assigned tasks.</div>';
        }
    },

    async updateWorkerTask(complaintId, status) {
        const note = window.prompt(status === 'Resolved' ? 'Briefly describe the work completed:' : 'Add a short progress note:');
        if (note === null || !note.trim()) return;
        try {
            await Api.updateComplaintStatus(complaintId, { status, note: note.trim() });
            await this.renderAssignedTasks(document.getElementById('view-container'));
        } catch (error) {
            alert(error.error || error.message || 'Unable to update this task.');
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
                            <p>Institutional oversight: Cross-department complaint workload, SLA performance, and campus-wide issue trends</p>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button class="quick-action-btn" onclick="app.runEscalationCheck()" style="background:#fef2f2; border-color:#fca5a5; color:#991b1b; font-weight:700;">⚡ Run SLA Escalation Audit</button>
                            <button class="quick-action-btn" onclick="window.location.hash='#admin-users'">👥 Manage Accounts</button>
                            <button class="quick-action-btn" onclick="app.renderDashboard(document.getElementById('view-container'))">🔄 Refresh</button>
                        </div>
                    </div>
                `;

                roleSpecificContent = '';
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
        if (ctx1 && window.Chart) {
            new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'New Reports',
                        data: [18, 26, 22, 38, 52, 68, 59],
                        borderColor: '#4f46e5',
                        backgroundColor: (ctx) => {
                            const grad = ctx.chart.ctx.createLinearGradient(0,0,0,200);
                            grad.addColorStop(0, 'rgba(79,70,229,0.25)');
                            grad.addColorStop(1, 'rgba(79,70,229,0.0)');
                            return grad;
                        },
                        fill: true,
                        tension: 0.45,
                        borderWidth: 2.5,
                        pointBackgroundColor: '#4f46e5',
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },{
                        label: 'Resolved',
                        data: [14, 20, 19, 30, 45, 60, 52],
                        borderColor: '#10b981',
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.45,
                        borderWidth: 2,
                        borderDash: [5,4],
                        pointRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { position: 'top', labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 11 }, color: '#64748b' } },
                        tooltip: { backgroundColor: '#1e293b', titleColor: '#e2e8f0', bodyColor: '#94a3b8', cornerRadius: 10 }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#94a3b8' } },
                        y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 }, color: '#94a3b8' }, beginAtZero: true }
                    }
                }
            });
        }

        const ctx2 = document.getElementById('categoryChart');
        if (ctx2 && window.Chart) {
            new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: ['Water', 'Wi-Fi', 'Electricity', 'Sanitation', 'Lift', 'Classroom'],
                    datasets: [{
                        label: 'Complaints',
                        data: [35, 28, 20, 15, 12, 8],
                        backgroundColor: ['#818cf8','#34d399','#fbbf24','#f87171','#a78bfa','#22d3ee'],
                        borderRadius: 8,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: { backgroundColor: '#1e293b', titleColor: '#e2e8f0', bodyColor: '#94a3b8', cornerRadius: 10 }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#94a3b8' } },
                        y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, color: '#94a3b8' }, beginAtZero: true }
                    }
                }
            });
        }
    },

    // ==========================================
    // 2. SUBMIT PROBLEM VIEW (Interactive Multi-Issue Stage)
    // ==========================================
    renderSubmitProblem(container) {
        this.pendingAttachments = this.pendingAttachments || [];
        this.selectedCategory = this.selectedCategory || 'Not sure';

        const categories = [
            { id: 'Internet/Wi-Fi', icon: '📶', label: 'Wi-Fi / Internet' },
            { id: 'Electricity', icon: '⚡', label: 'Electricity / Power' },
            { id: 'Water Supply', icon: '💧', label: 'Water Supply' },
            { id: 'Classroom Facilities', icon: '🏫', label: 'Classroom / Desk' },
            { id: 'Laboratory', icon: '🔬', label: 'Laboratory' },
            { id: 'Hostel Food/Mess', icon: '🛏️', label: 'Hostel / Mess' },
            { id: 'Restrooms', icon: '🚻', label: 'Restrooms' },
            { id: 'Sanitization/Cleanliness', icon: '🧹', label: 'Cleanliness' },
            { id: 'General Maintenance', icon: '🔧', label: 'Maintenance' },
            { id: 'Security', icon: '🛡️', label: 'Safety / Security' },
            { id: 'Not sure', icon: '❓', label: 'Not sure (AI Detect)' }
        ];

        const locations = [
            "Block A", "Block B", "Block C", "Hostel Block A", "Hostel Block B",
            "Library", "Central Laboratory", "Cafeteria / Mess", "Main Academic Block",
            "Auditorium", "Campus Parking", "Sports Ground", "Other Location"
        ];

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h1>Report a Campus Problem</h1>
                    <p>Easily report an issue with photographic evidence. Our AI checks for instant solutions and routes directly to the authorized department.</p>
                </div>
            </div>

            <div style="max-width:860px; margin:0 auto; display:flex; flex-direction:column; gap:22px;">
                <!-- Step 1: Category Selection -->
                <div class="card">
                    <label style="font-weight:800; font-size:14px; color:#1e293b; display:block; margin-bottom:4px;">
                        1. What is the problem? <span style="font-weight:400; color:#64748b;">(Tap the closest category)</span>
                    </label>
                    <div class="category-chips-container" id="category-chips-container">
                        ${categories.map(c => `
                            <button type="button" class="category-chip ${this.selectedCategory === c.id ? 'active' : ''}" onclick="app.selectCategoryChip('${c.id}')">
                                <span>${c.icon}</span>
                                <span>${c.label}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Step 2: Location Details -->
                <div class="card">
                    <label style="font-weight:800; font-size:14px; color:#1e293b; display:block; margin-bottom:8px;">
                        2. Where is it happening?
                    </label>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px;">
                        <div>
                            <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Campus Building / Zone</label>
                            <select id="report-location-select" style="width:100%; padding:10px 12px; border-radius:10px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit; background:white;">
                                ${locations.map(loc => `<option value="${loc}">${loc}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="font-size:12px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Floor / Room / Specific Spot <span style="font-weight:400; color:#94a3b8;">(optional)</span></label>
                            <input type="text" id="report-specific-spot" placeholder="e.g. 2nd Floor, Room 204 or Corridor" style="width:100%; padding:10px 12px; border-radius:10px; border:1.5px solid #cbd5e1; font-size:13px; font-family:inherit;">
                        </div>
                    </div>
                </div>

                <!-- Step 3: Photo Evidence (Take or Upload) -->
                <div class="card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <label style="font-weight:800; font-size:14px; color:#1e293b;">
                            3. Attach Photographic Evidence <span style="font-weight:400; color:#64748b;">(Recommended)</span>
                        </label>
                        <span style="font-size:12px; color:#64748b;">PNG, JPG, WEBP up to 16MB</span>
                    </div>
                    <p style="font-size:12.5px; color:#64748b; margin-bottom:14px;">Adding a photo helps maintenance teams identify and fix the issue much faster.</p>

                    <!-- Hidden Inputs for File and Camera -->
                    <input type="file" id="report-camera-input" accept="image/*" capture="environment" class="hidden" onchange="app.handlePhotoFilesSelected(this.files)">
                    <input type="file" id="report-file-input" accept="image/*" multiple class="hidden" onchange="app.handlePhotoFilesSelected(this.files)">

                    <div class="photo-dropzone" id="photo-dropzone" onclick="document.getElementById('report-file-input').click()" ondragover="event.preventDefault(); this.classList.add('dragover');" ondragleave="this.classList.remove('dragover');" ondrop="event.preventDefault(); this.classList.remove('dragover'); app.handlePhotoFilesSelected(event.dataTransfer.files);">
                        <div class="photo-dropzone-icon">
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        </div>
                        <div style="font-weight:700; font-size:14px; color:#1e293b;">Take a photo or drag &amp; drop images here</div>
                        <div style="font-size:12px; color:#64748b; margin-top:2px;">Works directly from your mobile camera or desktop gallery</div>
                        
                        <div class="photo-buttons-row" onclick="event.stopPropagation()">
                            <button type="button" class="btn-photo-action btn-photo-action--camera" onclick="document.getElementById('report-camera-input').click()">
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                Take Photo
                            </button>
                            <button type="button" class="btn-photo-action" onclick="document.getElementById('report-file-input').click()">
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                Browse Files
                            </button>
                        </div>
                    </div>

                    <!-- Photo Preview Grid -->
                    <div id="photo-preview-grid" class="photo-preview-grid ${this.pendingAttachments.length ? '' : 'hidden'}"></div>
                </div>

                <!-- Step 4: Describe the problem -->
                <div class="card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <label style="font-weight:800; font-size:14px; color:#1e293b;">
                            4. Describe what's happening:
                        </label>
                        <span style="font-size:12px; color:#64748b;">Plain language encouraged</span>
                    </div>
                    <textarea id="user-problem-input" rows="4" style="width:100%; padding:14px; border-radius:12px; border:1.5px solid #cbd5e1; outline:none; font-size:14px; line-height:1.5; font-family:inherit;" placeholder="Example: The water tap in the 2nd floor restroom is broken and overflowing onto the corridor floor."></textarea>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; flex-wrap:wrap; gap:12px;">
                        <div style="display:flex; align-items:center; gap:6px; font-size:12px; color:#64748b;">
                            <span>💡 Compound problems (e.g. Wi-Fi down AND water leaking) are automatically detected and split.</span>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button id="btn-pre-check" type="button" class="quick-action-btn" style="padding:10px 18px; font-weight:700;" onclick="app.handlePreTroubleshoot()">
                                🔍 Check for Instant Fixes
                            </button>
                            <button id="btn-direct-submit" type="button" class="btn-header-primary" style="padding:11px 24px; font-weight:700; font-size:14px;" onclick="app.handleDirectSubmit()">
                                🚀 Submit Problem &rarr;
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Step 5: Instant Pre-Check & Self-Help Guidance Panel -->
                <div id="pre-troubleshoot-panel" class="card hidden" style="border:1.5px solid #a5b4fc; background:#fafafa;"></div>

                <!-- Step 6: Multi-Issue Detection & Card Review Stage -->
                <div id="multi-issue-stage-container" class="card hidden" style="border:1.5px solid #cbd5e1;"></div>
            </div>
        `;

        this.renderPhotoPreviews();
    },

    selectCategoryChip(catId) {
        this.selectedCategory = catId;
        document.querySelectorAll('.category-chip').forEach(chip => chip.classList.remove('active'));
        const activeChip = Array.from(document.querySelectorAll('.category-chip')).find(el => el.textContent.includes(catId) || el.getAttribute('onclick')?.includes(catId));
        if (activeChip) activeChip.classList.add('active');
    },

    async handlePhotoFilesSelected(fileList) {
        if (!fileList || !fileList.length) return;
        const validExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'];
        const filesToUpload = [];

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const ext = file.name.split('.').pop().toLowerCase();
            if (!validExtensions.includes(ext)) {
                alert(`File "${file.name}" is not a supported image format. Supported: PNG, JPG, WEBP, GIF, HEIC.`);
                continue;
            }
            if (file.size > 16 * 1024 * 1024) {
                alert(`File "${file.name}" exceeds the 16MB file size limit.`);
                continue;
            }
            filesToUpload.push(file);
        }

        if (!filesToUpload.length) return;

        for (const file of filesToUpload) {
            const previewObj = {
                file,
                name: file.name,
                size: (file.size / 1024).toFixed(1) + ' KB',
                dataUrl: URL.createObjectURL(file),
                status: 'uploading'
            };
            this.pendingAttachments.push(previewObj);
        }
        this.renderPhotoPreviews();

        const formData = new FormData();
        filesToUpload.forEach(f => formData.append('photos', f));

        try {
            const res = await Api.uploadPhotos(formData);
            if (res && res.files) {
                res.files.forEach((serverFile, idx) => {
                    const matchIdx = this.pendingAttachments.length - filesToUpload.length + idx;
                    if (this.pendingAttachments[matchIdx]) {
                        this.pendingAttachments[matchIdx].stored_filename = serverFile.stored_filename;
                        this.pendingAttachments[matchIdx].original_filename = serverFile.original_filename;
                        this.pendingAttachments[matchIdx].url = serverFile.url;
                        this.pendingAttachments[matchIdx].file_size = serverFile.file_size;
                        this.pendingAttachments[matchIdx].mime_type = serverFile.mime_type;
                        this.pendingAttachments[matchIdx].status = 'ready';
                    }
                });
            }
            this.renderPhotoPreviews();
        } catch(err) {
            console.error('Photo upload error:', err);
            alert('Could not upload photo: ' + (err.error || err.message || 'Network error'));
            this.pendingAttachments = this.pendingAttachments.filter(p => p.status === 'ready');
            this.renderPhotoPreviews();
        }
    },

    removePendingPhoto(index) {
        if (this.pendingAttachments[index]) {
            if (this.pendingAttachments[index].dataUrl) {
                URL.revokeObjectURL(this.pendingAttachments[index].dataUrl);
            }
            this.pendingAttachments.splice(index, 1);
            this.renderPhotoPreviews();
        }
    },

    renderPhotoPreviews() {
        const grid = document.getElementById('photo-preview-grid');
        if (!grid) return;
        if (!this.pendingAttachments || !this.pendingAttachments.length) {
            grid.classList.add('hidden');
            grid.innerHTML = '';
            return;
        }
        grid.classList.remove('hidden');
        grid.innerHTML = this.pendingAttachments.map((att, idx) => `
            <div class="photo-preview-item">
                <img src="${att.dataUrl || att.url}" alt="${att.name || att.original_filename}" class="photo-preview-img">
                <button type="button" class="photo-preview-delete" onclick="app.removePendingPhoto(${idx})" title="Remove photo">&times;</button>
                <div class="photo-preview-badge">
                    ${att.status === 'uploading' ? '⏳ Uploading...' : '✓ ' + (att.size || 'Photo')}
                </div>
            </div>
        `).join('');
    },

    async handleDirectSubmit() {
        const text = document.getElementById('user-problem-input')?.value?.trim();
        if (!text) {
            alert('Please describe your problem before submitting.');
            document.getElementById('user-problem-input')?.focus();
            return;
        }

        const submitBtn = document.getElementById('btn-direct-submit');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting Problem...';
        }

        try {
            const analysis = await Api.analyzeComplaint(text);
            if (analysis && analysis.issues && analysis.issues.length > 1) {
                this.currentDetectedIssues = analysis.issues;
                const stageContainer = document.getElementById('multi-issue-stage-container');
                if (stageContainer) {
                    stageContainer.classList.remove('hidden');
                    this.renderMultiIssueReviewBoard(stageContainer);
                    stageContainer.scrollIntoView({ behavior: 'smooth' });
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = '🚀 Submit Problem →';
                }
                return;
            }

            const locationSelect = document.getElementById('report-location-select')?.value || 'Main Academic Block';
            const specificSpot = document.getElementById('report-specific-spot')?.value?.trim();
            const fullLocation = specificSpot ? `${locationSelect} (${specificSpot})` : locationSelect;

            const category = (this.selectedCategory && this.selectedCategory !== 'Not sure') 
                ? this.selectedCategory 
                : (analysis.category || 'General Maintenance');

            const res = await Api.createComplaint({
                complaintText: text,
                category: category,
                location: fullLocation,
                attachments: this.pendingAttachments || []
            });

            this.pendingAttachments = [];
            const inputEl = document.getElementById('user-problem-input');
            if (inputEl) inputEl.value = '';

            this.showForwardedPopupModal(res);
        } catch(err) {
            console.error('Submit error:', err);
            alert('Failed to submit complaint: ' + (err.error || err.message || 'Please check your connection'));
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '🚀 Submit Problem →';
            }
        }
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
                confirmedIssues: issues,
                attachments: this.pendingAttachments || []
            });
            this.pendingAttachments = [];
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
            let complaints = await Api.getComplaints();
            const role = this.currentUser?.role || 'User';
            const isAdmin = role === 'Department Admin' || role === 'Organization Admin';
            const canAcknowledge = isAdmin;

            if (!isAdmin && this.isStaffUser()) {
                complaints = complaints.filter(complaint => complaint.userName === this.currentUser.name);
            }

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
                                                ${(c.hasEvidence || (c.attachments && c.attachments.length > 0)) ? `<span style="background:#eef2ff; color:#4338ca; font-size:10px; font-weight:800; padding:2px 7px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">📷 Photo Attached</span>` : ''}
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

            const isUser = !this.currentUser || this.currentUser.role === 'User';
            const isDeptAdmin = this.currentUser && this.currentUser.role === 'Department Admin';
            const isOrgAdmin = this.currentUser && this.currentUser.role === 'Organization Admin';
            const canManage = isDeptAdmin || isOrgAdmin;

            // Map friendly labels replacing technical jargon
            const friendlyMap = {
                'Submitted': 'Reported by You',
                'AI Categorized': 'Issue Identified',
                'Forwarded': 'Sent to the Responsible Department',
                'Seen': 'Under Review',
                'In Progress': 'Work Started by Department',
                'Action Started': 'Work Started by Department',
                'Pending Parts': 'Waiting for Materials / Parts',
                'Resolved': 'Problem Solved by Department',
                'Closed': 'Verified & Completed'
            };

            const currentFriendly = friendlyMap[data.status] || data.status;

            // Compute stage index (1 to 5)
            let currentStage = 1;
            if (data.status === 'Submitted') currentStage = 1;
            else if (data.status === 'AI Categorized') currentStage = 2;
            else if (data.status === 'Forwarded') currentStage = 3;
            else if (['Seen', 'In Progress', 'Action Started', 'Pending Parts'].includes(data.status)) currentStage = 4;
            else if (['Resolved', 'Closed'].includes(data.status)) currentStage = 5;

            // Format SLA / Expected response time
            let expectedResponseStr = 'Within standard SLA (4-24 hours)';
            let isOverdue = false;
            if (data.acknowledgementDeadline) {
                const deadlineDate = new Date(data.acknowledgementDeadline);
                if (!isNaN(deadlineDate.getTime())) {
                    expectedResponseStr = deadlineDate.toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                    }) + ', ' + deadlineDate.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });
                    if (new Date() > deadlineDate && !data.acknowledgedAt && data.status !== 'Resolved' && data.status !== 'Closed') {
                        isOverdue = true;
                    }
                }
            }

            // Category icons
            const catIcons = {
                'Internet/Wi-Fi': '📶',
                'Water Supply': '🚰',
                'Electricity': '⚡',
                'Restroom': '🚻',
                'Mess/Canteen': '🍲',
                'Hostel': '🏢',
                'Lift/Elevator': '🛗',
                'Classroom/Labs': '🏫'
            };
            const catIcon = catIcons[data.category] || '📌';

            // Non-technical next steps explanation
            let nextStepText = '';
            if (data.status === 'Resolved') {
                nextStepText = `The **${data.department}** team has marked this issue as resolved. Please verify below if your problem has been completely fixed to close the ticket.`;
            } else if (data.status === 'Closed') {
                nextStepText = `This complaint has been verified as solved and is formally closed. Thank you for reporting!`;
            } else if (data.status === 'In Progress' || data.status === 'Action Started') {
                nextStepText = `Technicians from **${data.department}** (${data.assignedPerson}) are actively working on-site at **${data.location}** to solve this issue.`;
            } else if (data.status === 'Pending Parts') {
                nextStepText = `The maintenance team inspected the issue and has ordered replacement components. Repairs will resume as soon as parts arrive.`;
            } else {
                nextStepText = `The **${data.department}** team (${data.assignedPerson}) has received your problem. A staff member will inspect **${data.location}** and provide a live progress update.`;
            }

            const userName = this.currentUser ? this.currentUser.name : 'Student';

            const modalHtml = `
                <div id="${modalId}" class="journey-modal-backdrop">
                    <div class="journey-card-container">
                        <!-- Top Header with Brand Crest & Greeting -->
                        <div class="journey-modal-header">
                            <div class="journey-brand-row">
                                <div class="journey-brand-badge" style="background:#2563eb; color:#ffffff; font-weight:800;">PM</div>
                                <div>
                                    <div class="journey-brand-title">Problemint Resolution Engine</div>
                                    <div class="journey-brand-subtitle">Complaint Progress &amp; Transparency Journey</div>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:12px;">
                                <span style="font-size:13px; font-weight:700; color:#334155;">Hello, ${userName}</span>
                                <button class="journey-modal-close-btn" onclick="document.getElementById('${modalId}').remove()" title="Close">&times;</button>
                            </div>
                        </div>

                        <!-- Scrollable Journey Body -->
                        <div class="journey-body-scroll">

                            <!-- Banner Tag & Status Pill -->
                            <div class="journey-insight-banner">
                                <div class="journey-insight-left">
                                    <span class="journey-pill-tag">✨ Complaint Journey</span>
                                    <span class="journey-ticket-id-tag">#${data.complaintId}</span>
                                    <span style="font-size:12px; color:#64748b;">• Assigned to <strong>${data.assignedPerson} (${data.department})</strong></span>
                                </div>
                                <div>
                                    <span class="journey-status-pill ${data.status === 'Resolved' || data.status === 'Closed' ? 'status-pill-resolved' : (isOverdue ? 'status-pill-pending' : 'status-pill-progress')}">
                                        • ${currentFriendly} ${isOverdue ? ' (Overdue)' : ''}
                                    </span>
                                </div>
                            </div>

                            <!-- Primary "Your Complaint" Card -->
                            <div class="journey-main-card">
                                <div class="journey-main-card-header">
                                    <div class="journey-card-label">Your Complaint Description</div>
                                    <div class="journey-complaint-quote">"${data.complaintText}"</div>
                                </div>

                                <!-- 4-Column Metric Footer (Digri Reference UI Style) -->
                                <div class="journey-metric-grid">
                                    <div class="journey-metric-item">
                                        <div class="journey-metric-label">${catIcon} Category</div>
                                        <div class="journey-metric-value">${data.category}</div>
                                    </div>
                                    <div class="journey-metric-item">
                                        <div class="journey-metric-label">📍 Campus Location</div>
                                        <div class="journey-metric-value">${data.location}</div>
                                    </div>
                                    <div class="journey-metric-item">
                                        <div class="journey-metric-label">⚡ Priority</div>
                                        <div class="journey-metric-value" style="color:${data.severity === 'Critical' ? '#dc2626' : (data.severity === 'High' ? '#ea580c' : '#0d9488')};">
                                            ${data.severity}
                                        </div>
                                    </div>
                                    <div class="journey-metric-item">
                                        <div class="journey-metric-label">🕒 Expected Response By</div>
                                        <div class="journey-metric-value" style="color:${isOverdue ? '#dc2626' : '#1e293b'};">
                                            ${expectedResponseStr}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- What Happens Next? Card -->
                            <div class="journey-next-step-card">
                                <div class="journey-next-step-icon">💡</div>
                                <div>
                                    <div class="journey-next-step-title">What Happens Next?</div>
                                    <div class="journey-next-step-desc">${nextStepText}</div>
                                </div>
                            </div>

                            <!-- 5-Stage Visual Progress Tracker -->
                            <div class="journey-progress-card">
                                <div class="journey-progress-header">
                                    <div class="journey-progress-title">Complaint Progress</div>
                                    <span style="font-size:12px; color:#64748b; font-weight:600;">Reported by You &rarr; Department Resolution</span>
                                </div>

                                <div class="journey-stages-bar">
                                    <div class="journey-stage-step ${currentStage >= 1 ? (currentStage > 1 ? 'completed' : 'active') : ''}">
                                        <div class="journey-stage-circle">${currentStage > 1 ? '✓' : '1'}</div>
                                        <div class="journey-stage-step-title">Reported by You</div>
                                    </div>
                                    <div class="journey-stage-step ${currentStage >= 2 ? (currentStage > 2 ? 'completed' : 'active') : ''}">
                                        <div class="journey-stage-circle">${currentStage > 2 ? '✓' : '2'}</div>
                                        <div class="journey-stage-step-title">Issue Identified</div>
                                    </div>
                                    <div class="journey-stage-step ${currentStage >= 3 ? (currentStage > 3 ? 'completed' : 'active') : ''}">
                                        <div class="journey-stage-circle">${currentStage > 3 ? '✓' : '3'}</div>
                                        <div class="journey-stage-step-title">Sent to Dept</div>
                                    </div>
                                    <div class="journey-stage-step ${currentStage >= 4 ? (currentStage > 4 ? 'completed' : 'active') : ''}">
                                        <div class="journey-stage-circle">${currentStage > 4 ? '✓' : '4'}</div>
                                        <div class="journey-stage-step-title">Work in Progress</div>
                                    </div>
                                    <div class="journey-stage-step ${currentStage >= 5 ? 'completed' : ''}">
                                        <div class="journey-stage-circle">${currentStage >= 5 ? '✓' : '5'}</div>
                                        <div class="journey-stage-step-title">Solved &amp; Verified</div>
                                    </div>
                                </div>

                                <!-- Detailed Human Timeline Events -->
                                <div class="journey-timeline-flow">
                                    ${data.timeline && data.timeline.length > 0 ? data.timeline.map(t => {
                                        const humanStatus = friendlyMap[t.status] || t.status;
                                        return `
                                            <div class="journey-timeline-node ${t.status === 'Resolved' || t.status === 'Closed' ? 'resolved' : ''}">
                                                <div class="journey-timeline-dot"></div>
                                                <div class="journey-timeline-node-title">
                                                    ${humanStatus}
                                                    <span class="journey-timeline-node-time">— updated by ${t.updatedBy} on ${t.timestamp}</span>
                                                </div>
                                                <div class="journey-timeline-node-desc">${t.description}</div>
                                            </div>
                                        `;
                                    }).join('') : '<div style="font-size:12px; color:#64748b; padding-left:14px;">No timeline updates recorded yet.</div>'}
                                </div>
                            </div>

                            <!-- Photographic Evidence Gallery -->
                            ${(data.attachments && data.attachments.length > 0) ? `
                                <div class="journey-gallery-card">
                                    <div style="font-size:14px; font-weight:800; color:#0f172a; margin-bottom:4px;">
                                        📷 Attached Photographic Evidence (${data.attachments.length})
                                    </div>
                                    <div style="font-size:12px; color:#64748b; margin-bottom:12px;">Photographs provided during issue submission to assist technicians. Click image to inspect.</div>
                                    <div class="journey-gallery-grid">
                                        ${data.attachments.map(att => `
                                            <a href="${att.url}" target="_blank" rel="noopener noreferrer" class="journey-gallery-item" title="Click to view full image">
                                                <img src="${att.url}" alt="${att.originalFilename || 'Photo evidence'}" class="journey-gallery-img">
                                                <div class="journey-gallery-name">${att.originalFilename || 'Photo evidence'}</div>
                                            </a>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            <!-- Department Resolution Note -->
                            ${data.resolutionNote ? `
                                <div style="background:#ecfdf5; border:1.5px solid #a7f3d0; padding:18px 22px; border-radius:16px;">
                                    <div style="font-size:13.5px; font-weight:800; color:#065f46; margin-bottom:4px;">Department Resolution Summary</div>
                                    <div style="font-size:13px; color:#047857; line-height:1.5;">${data.resolutionNote}</div>
                                </div>
                            ` : ''}

                            <!-- Department Staff / Administrator Quick Actions -->
                            ${canManage ? `
                                <div class="journey-admin-action-card">
                                    <div class="journey-admin-title">
                                        <span>🛠️ Department Staff Actions (${this.currentUser.department || 'Administrator'})</span>
                                        ${!data.acknowledgedAt ? `
                                            <button class="btn-header-primary" style="padding:6px 14px; font-size:12px; background:#0d9488;" onclick="app.handleAcknowledgeComplaint('${data.complaintId}')">
                                                ✓ Acknowledge Ticket
                                            </button>
                                        ` : '<span style="font-size:12px; font-weight:700; color:#065f46;">✓ Acknowledged</span>'}
                                    </div>
                                    <div class="journey-admin-grid">
                                        <div>
                                            <label style="font-size:11.5px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Update Status:</label>
                                            <select id="journey-update-status-select" class="form-control" style="font-size:13px; padding:8px 12px; border-radius:10px;">
                                                <option value="In Progress" ${data.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                                <option value="Action Started" ${data.status === 'Action Started' ? 'selected' : ''}>Action Started</option>
                                                <option value="Pending Parts" ${data.status === 'Pending Parts' ? 'selected' : ''}>Pending Parts / Materials</option>
                                                <option value="Resolved" ${data.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                                                <option value="Closed" ${data.status === 'Closed' ? 'selected' : ''}>Closed</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size:11.5px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Progress / Resolution Note:</label>
                                            <input type="text" id="journey-update-status-note" class="form-control" style="font-size:13px; padding:8px 12px; border-radius:10px;" placeholder="e.g. Technician deployed, replaced cable...">
                                        </div>
                                        <div>
                                            <button class="btn-header-primary" style="padding:9px 18px; font-size:12.5px; background:#0d9488;" onclick="app.submitStatusUpdateFromJourney('${data.complaintId}')">
                                                Save Status
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}

                            <!-- Is Your Problem Solved? (User Verification) -->
                            ${(isUser || data.status === 'Resolved') ? `
                                <div class="journey-verification-card">
                                    <div class="journey-verification-title">
                                        <span>Is Your Problem Solved?</span>
                                    </div>
                                    <div class="journey-verification-subtitle">
                                        Please confirm whether the responsible department has successfully fixed this campus issue.
                                    </div>
                                    <div class="journey-verification-btns">
                                        <button class="journey-verif-btn verif-btn-solved" onclick="app.submitVerificationResponse('${data.complaintId}', 'Yes')">
                                            ✅ Yes — Fully Solved
                                        </button>
                                        <button class="journey-verif-btn verif-btn-partial" onclick="app.submitVerificationResponse('${data.complaintId}', 'Partial')">
                                            ⚠️ Partially Solved
                                        </button>
                                        <button class="journey-verif-btn verif-btn-unsolved" onclick="app.submitVerificationResponse('${data.complaintId}', 'No')">
                                            ❌ No — Not Solved
                                        </button>
                                    </div>
                                    <div style="margin-top:10px;">
                                        <input type="text" id="verification-feedback-note" class="form-control" style="font-size:12.5px; padding:8px 12px; border-radius:8px;" placeholder="Optional feedback: describe what you observed...">
                                    </div>
                                </div>
                            ` : ''}

                        </div>

                        <!-- Footer -->
                        <div style="background:#ffffff; border-top:1px solid #e2e8f0; padding:14px 24px; display:flex; justify-content:flex-end; align-items:center;">
                            <button class="quick-action-btn" style="padding:8px 20px; font-size:13px;" onclick="document.getElementById('${modalId}').remove()">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
        } catch(e) {
            console.error(e);
            alert('Failed to load complaint progress journey: ' + (e.message || e));
        }
    },

    async submitStatusUpdateFromJourney(complaintId) {
        const selectEl = document.getElementById('journey-update-status-select');
        const noteEl = document.getElementById('journey-update-status-note');
        const status = selectEl ? selectEl.value : 'In Progress';
        const note = noteEl ? noteEl.value.trim() : '';

        try {
            const res = await Api.updateComplaintStatus(complaintId, { status, note });
            alert(res.message || 'Complaint status updated successfully!');
            // Re-render journey modal with fresh data
            this.viewTicketTimelineModal(complaintId);
            // Refresh list behind
            if (this.currentView === 'my-complaints') {
                this.renderMyComplaints(document.getElementById('view-container'));
            } else if (this.currentView === 'department-complaints') {
                this.renderDepartmentComplaints(document.getElementById('view-container'));
            } else if (this.currentView === 'dashboard') {
                this.renderDashboard(document.getElementById('view-container'));
            }
        } catch(e) {
            alert('Failed to update status: ' + (e.error || e.message || 'Unauthorized'));
        }
    },

    showVerificationModal(complaintId) {
        this.viewTicketTimelineModal(complaintId);
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
            document.getElementById('ticket-timeline-modal')?.remove();
            alert(res.message || 'Thank you for verifying!');
            if (this.currentView === 'my-complaints') {
                this.renderMyComplaints(document.getElementById('view-container'));
            } else if (this.currentView === 'dashboard') {
                this.renderDashboard(document.getElementById('view-container'));
            }
        } catch(e) {
            alert('Failed to submit verification: ' + (e.error || e.message));
        }
    },

    async triggerEntranceNotification() {
        if (sessionStorage.getItem('entered_notif_seen')) return;

        try {
            const notifs = await Api.getNotifications();
            if (!notifs || notifs.length === 0) return;

            const toastId = 'entrance-notif-toast';
            if (document.getElementById(toastId)) return;

            const itemsToShow = notifs.slice(0, 3);

            const toastHtml = `
                <div id="${toastId}" class="entrance-notif-toast">
                    <div class="entrance-notif-header">
                        <div class="entrance-notif-title-row">
                            <div class="entrance-notif-bell">🔔</div>
                            <div class="entrance-notif-title">Recent notifications</div>
                        </div>
                        <button class="entrance-notif-close-btn" onclick="app.dismissEntranceNotification()">&times;</button>
                    </div>
                    <div class="entrance-notif-list">
                        ${itemsToShow.map(n => `
                            <div class="entrance-notif-item" onclick="app.dismissEntranceNotification(); window.location.hash='${n.link || '#my-complaints'}';">
                                <div class="entrance-notif-item-icon">📋</div>
                                <div class="entrance-notif-item-content">
                                    <div class="entrance-notif-item-top">
                                        <div class="entrance-notif-item-headline">${n.title}</div>
                                        <div class="entrance-notif-item-time">Recent</div>
                                    </div>
                                    <div class="entrance-notif-item-snippet">${n.message}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="entrance-notif-footer">
                        <a href="#my-complaints" class="entrance-notif-link" onclick="app.dismissEntranceNotification()">View all notifications &rarr;</a>
                        <button class="entrance-notif-dismiss" onclick="app.dismissEntranceNotification()">Dismiss</button>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', toastHtml);

            // Auto dismiss after 14 seconds
            setTimeout(() => {
                this.dismissEntranceNotification();
            }, 14000);
        } catch (e) {
            console.error('Failed to display entrance notification:', e);
        }
    },

    dismissEntranceNotification() {
        sessionStorage.setItem('entered_notif_seen', 'true');
        const toast = document.getElementById('entrance-notif-toast');
        if (toast) {
            toast.style.transition = 'all 0.3s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 300);
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

            if (recs.length === 0) {
                container.innerHTML = `
                    <div class="view-header">
                        <div>
                            <h1>Proactive Prevention Center</h1>
                            <p>Recommendations are based on recorded complaint patterns and reviewed by authorized administrators.</p>
                        </div>
                    </div>
                    <div class="card" style="padding:32px;text-align:center;">
                        <h2 style="margin-bottom:8px;color:#1e293b;">No prevention recommendations yet</h2>
                        <p style="color:#64748b;">Recommendations will appear here when the system has enough complaint history to support them.</p>
                    </div>
                `;
                return;
            }

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
            const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
            const departmentRows = analytics.departmentWorkload || [];
            const categoryRows = analytics.categoryCounts || [];
            const dailyRows = analytics.dailyVolume || [];
            container.innerHTML = `
                <div class="view-header">
                    <div>
                        <h1>Institutional Problem Analytics</h1>
                        <p>Metrics calculated from current complaint, incident, and resolution records.</p>
                    </div>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Total Complaints</div>
                        <div class="stat-value">${analytics.totalComplaints}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Active Complaints</div>
                        <div class="stat-value">${analytics.activeComplaints}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Resolved</div>
                        <div class="stat-value">${analytics.resolvedComplaints}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Verified Resolution Rate</div>
                        <div class="stat-value" style="color:#10b981;">${analytics.resolutionVerificationRate ?? 'N/A'}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Average Resolution Time</div>
                        <div class="stat-value">${analytics.avgResolutionTimeHours ?? 'N/A'} <span style="font-size:12px;color:#6b7280;">${analytics.avgResolutionTimeHours == null ? '' : 'hours'}</span></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Open Critical Incidents</div>
                        <div class="stat-value" style="color:#ef4444;">${analytics.openCriticalIncidents}</div>
                    </div>
                </div>

                ${analytics.totalComplaints === 0 ? '<div class="card" style="padding:24px;color:#64748b;">No complaint records yet. Analytics will populate as users submit and resolve complaints.</div>' : `
                    <div class="dashboard-grid" style="margin-top:24px;">
                        <section class="card"><div class="card-title">Department Workload</div>
                            ${departmentRows.length ? departmentRows.map(row => `<div class="attention-card"><div class="attention-title">${escapeHtml(row.department)}</div><div class="attention-desc">${row.total} total · ${row.active} active</div></div>`).join('') : '<p style="color:#64748b;">No department totals yet.</p>'}
                        </section>
                        <section class="card"><div class="card-title">Complaint Categories</div>
                            ${categoryRows.length ? categoryRows.map(row => `<div class="attention-card"><div class="attention-title">${escapeHtml(row.category)}</div><div class="attention-desc">${row.total} complaint(s)</div></div>`).join('') : '<p style="color:#64748b;">No category totals yet.</p>'}
                        </section>
                        <section class="card"><div class="card-title">Daily Reports · Last 7 Days</div>
                            ${dailyRows.length ? dailyRows.map(row => `<div class="attention-card"><div class="attention-title">${escapeHtml(row.date)}</div><div class="attention-desc">${row.total} report(s)</div></div>`).join('') : '<p style="color:#64748b;">No reports were submitted during the last 7 days.</p>'}
                        </section>
                    </div>
                `}
            `;
        } catch (e) {
            container.innerHTML = `<div class="card" style="padding:24px;color:#b91c1c;">Error loading analytics: ${e.message || e.error || 'Unknown error'}</div>`;
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
            const users = Array.isArray(data) ? data : (data.users || []);

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
                                        <div style="font-weight:700; color:#0f172a; font-size:13px;">${u.fullName || u.name}</div>
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
                                                <button class="quick-action-btn" style="font-size:11px; padding:4px 10px; color:#b45309;" onclick="app.handleResetUserPassword(${u.id}, '${u.fullName || u.name}')">Reset Pwd</button>
                                            ${(u.status || 'Active') === 'Active'
                                                ? `<button class="quick-action-btn" style="font-size:11px; padding:4px 10px; color:#dc2626;" onclick="app.handleDeactivateUser(${u.id}, '${u.fullName || u.name}')">Deactivate</button>`
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
            if (this.currentView === 'assigned-tasks') {
                this.renderAssignedTasks(document.getElementById('view-container'));
            } else {
                this.renderDashboard(document.getElementById('view-container'));
            }
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
