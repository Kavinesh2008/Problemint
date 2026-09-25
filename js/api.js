// API Client for PROBLEMINT Backend
const API_BASE = '/api';

const Api = {
    async get(endpoint) {
        try {
            const res = await fetch(`${API_BASE}${endpoint}`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return await res.json();
        } catch (e) {
            console.error('API GET Error:', e);
            throw e;
        }
    },

    async post(endpoint, data) {
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const json = await res.json();
            if (!res.ok) throw json;
            return json;
        } catch (e) {
            console.error('API POST Error:', e);
            throw e;
        }
    },

    async put(endpoint, data) {
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const json = await res.json();
            if (!res.ok) throw json;
            return json;
        } catch (e) {
            console.error('API PUT Error:', e);
            throw e;
        }
    },

    async delete(endpoint) {
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'DELETE'
            });
            const json = await res.json();
            if (!res.ok) throw json;
            return json;
        } catch (e) {
            console.error('API DELETE Error:', e);
            throw e;
        }
    },

    // Specific domain API calls
    getUsers() { return this.get('/users'); },
    getMe() { return this.get('/me'); },
    login(credentials) {
        if (typeof credentials === 'object') return this.post('/login', credentials);
        return this.post('/login', { userId: credentials });
    },
    logout() { return this.post('/logout'); },

    // Settings & Security
    getSettings() { return this.get('/settings'); },
    saveSettings(settingsData) { return this.post('/settings', settingsData); },
    changePassword(pwData) { return this.post('/settings/change-password', pwData); },

    // Org Admin User Management
    getAdminUsers(params = '') { return this.get(`/admin/users${params ? '?' + params : ''}`); },
    createAdminUser(userData) { return this.post('/admin/users', userData); },
    updateAdminUser(id, userData) { return this.put(`/admin/users/${id}`, userData); },
    deactivateAdminUser(id) { return this.delete(`/admin/users/${id}`); },
    resetAdminUserPassword(id, newPassword) { return this.post(`/admin/users/${id}/reset-password`, { newPassword }); },
    bulkImportUsers(usersList) { return this.post('/admin/users/bulk-import', { users: usersList }); },

    // Dashboard & Analytics
    getDashboardStats() { return this.get('/dashboard/stats'); },

    // Complaints & Pre-Submission Troubleshooting
    getComplaints(params = '') { return this.get(`/complaints${params ? '?' + params : ''}`); },
    getComplaintById(id) { return this.get(`/complaints/${id}`); },
    analyzeComplaint(text) { return this.post('/complaints/analyze', { text }); },
    preTroubleshoot(data) { return this.post('/complaints/pre-troubleshoot', data); },
    logSelfServiceResolved(data) { return this.post('/complaints/self-service-resolved', data); },
    getPreResolution(category, location) { return this.post('/complaints/pre-resolution', { category, location }); },
    findSimilar(text, category, location) { return this.post('/complaints/similar', { text, category, location }); },
    createComplaint(complaintData) { return this.post('/complaints', complaintData); },
    acknowledgeComplaint(id) { return this.post(`/complaints/${id}/acknowledge`, {}); },

    // Escalations
    checkEscalations() { return this.post('/admin/escalation-check', {}); },
    getEscalations() { return this.get('/admin/escalations'); },

    // Incidents, Resolutions & Verification
    getIncidents() { return this.get('/incidents'); },
    getIncidentById(id) { return this.get(`/incidents/${id}`); },
    getResolutions() { return this.get('/resolutions'); },
    createResolution(resData) { return this.post('/resolutions', resData); },
    submitVerification(verifData) { return this.post('/verification', verifData); },

    // Knowledge & Prevention
    getKnowledge(params = '') { return this.get(`/knowledge${params ? '?' + params : ''}`); },
    getPrevention() { return this.get('/prevention'); },
    updatePreventionAction(recId, actionData) { return this.post(`/prevention/${recId}/action`, actionData); },

    // Copilot & Notifications
    askCopilot(query) { return this.post('/copilot', { query }); },
    getNotifications() { return this.get('/notifications'); }
};

