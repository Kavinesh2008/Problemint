#!/usr/bin/env python3
"""
patch_landing_page.py
Fixes landing page display:
1. Updates index.html so hero and CTA buttons call handleReportProblemClick()
2. Adds 'Public Website' item to sidebar
3. Updates app.js init() and handleHashChange() so visiting the site goes directly to Public Landing Page by default
4. Adds updatePublicNavForAuth(), handleReportProblemClick(), and goToPortal()
"""

# 1. Update index.html
html = open('index.html', encoding='utf-8').read()

# Update hero-primary-btn and cta-main-btn onclicks
html = html.replace(
    '<button class="hero-primary-btn" onclick="app.showRoleSelection()">',
    '<button class="hero-primary-btn" onclick="app.handleReportProblemClick()">'
)
html = html.replace(
    '<button class="cta-main-btn" onclick="app.showRoleSelection()">',
    '<button class="cta-main-btn" onclick="app.handleReportProblemClick()">'
)

# Add Public Website nav item to sidebar before #home
old_sidebar_home = '<nav class="nav-menu">\n                <a href="#home" class="nav-item" data-view="home">'
new_sidebar_home = '''<nav class="nav-menu">
                <a href="#" class="nav-item" onclick="app.showPublicHome(); history.replaceState(null, '', window.location.pathname); return false;" style="color:#818cf8; font-weight:600;">
                    <svg class="nav-icon" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
                    <span>Public Website</span>
                </a>
                <a href="#home" class="nav-item" data-view="home">'''

if old_sidebar_home in html:
    html = html.replace(old_sidebar_home, new_sidebar_home, 1)

open('index.html', 'w', encoding='utf-8').write(html)
print("Updated index.html successfully.")

# 2. Update js/app.js
js = open('js/app.js', encoding='utf-8').read()

# Replace init() block
old_init_marker = '    async init() {'
idx_init = js.find(old_init_marker)
idx_show_pub = js.find('    // ---- Layout switching ----')

new_init_block = r'''    async init() {
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

'''

if idx_init != -1 and idx_show_pub != -1:
    js = js[:idx_init] + new_init_block + js[idx_show_pub:]
    print("Updated init() in app.js.")
else:
    print("WARNING: init markers not found in app.js.")

# Add handleReportProblemClick, goToPortal, updatePublicNavForAuth after showPublicHome
old_show_pub = r'''    showPublicHome() {
        document.getElementById('public-home').classList.remove('hidden');
        document.getElementById('auth-layout').classList.add('hidden');
        document.getElementById('app-container').classList.add('hidden');
        window.scrollTo(0, 0);
    },'''

new_show_pub = r'''    showPublicHome() {
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
    },'''

if old_show_pub in js:
    js = js.replace(old_show_pub, new_show_pub, 1)
    print("Added handleReportProblemClick, goToPortal, updatePublicNavForAuth.")
else:
    print("WARNING: showPublicHome not matched.")

# Replace handleHashChange() implementation
old_hash_start = '    handleHashChange() {'
idx_hash_start = js.find(old_hash_start)
old_hash_end_marker = '    updateActiveNav(viewName) {'
idx_hash_end = js.find(old_hash_end_marker)

new_hash_method = r'''    handleHashChange() {
        let hash = window.location.hash.replace('#', '').trim();

        // 1. If hash is empty, or landing, public, about: ALWAYS show the public homepage!
        if (!hash || hash === 'landing' || hash === 'public' || hash === 'about') {
            this.showPublicHome();
            return;
        }

        // 2. If user navigated to login / role selection:
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

        // 3. For any application view (#home, #dashboard, #submit-problem, #my-complaints, etc.):
        if (!this.isLoggedIn) {
            // Not authenticated: save desired destination and prompt role selection
            this._postLoginHash = '#' + hash;
            this.showRoleSelection(this._postLoginHash);
            return;
        }

        // Authenticated: show application layout and view
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
            case 'admin-users':
                this.renderAdminUsers(container);
                break;
            case 'settings':
                this.renderSettings(container);
                break;
            default:
                this.renderDashboard(container);
        }
    },

'''

if idx_hash_start != -1 and idx_hash_end != -1:
    js = js[:idx_hash_start] + new_hash_method + js[idx_hash_end:]
    print("Updated handleHashChange() in app.js.")
else:
    print("WARNING: handleHashChange boundaries not found.")

open('js/app.js', 'w', encoding='utf-8').write(js)
print("Updated js/app.js successfully!")
