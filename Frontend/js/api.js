System.err ? System.err.println(e) : console.error('API GET Error:', e);// API Client for PROBLEMINT Java Backend
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

    // Specific domain API calls
    getUsers() { return this.get('/users'); },
    getMe() { return this.get('/me'); },
    login(credentials) {
        if (typeof credentials === 'object') return this.post('/login', credentials);
        return this.post('/login', { userId: credentials });
    },
    logout() { return this.post('/logout'); },


    getDashboardStats() { return this.get('/dashboard/stats'); },
    getComplaints() { return this.get('/complaints'); },
    getComplaintById(id) { return this.get(`/complaints/${id}`); },
    analyzeComplaint(text) { return this.post('/complaints/analyze', { text }); },
    clarifyComplaint(text) { return this.post('/complaints/clarify', { text }); },
    getPreResolution(category, location) { return this.post('/complaints/pre-resolution', { category, location }); },
    findSimilar(text, category, location) { return this.post('/complaints/similar', { text, category, location }); },
    createComplaint(complaintData) { return this.post('/complaints', complaintData); },
    getIncidents() { return this.get('/incidents'); },
    getIncidentById(id) { return this.get(`/incidents/${id}`); },
    getIncidentRootCause(id) { return this.get(`/incidents/${id}/root-cause`); },
    getResolutions() { return this.get('/resolutions'); },
    createResolution(resData) { return this.post('/resolutions', resData); },
    submitVerification(verifData) { return this.post('/verification', verifData); },
    getKnowledge() { return this.get('/knowledge'); },
    getPrevention() { return this.get('/prevention'); },
    getAnalytics() { return this.get('/analytics'); },
    askCopilot(query) { return this.post('/copilot', { query }); },
    getNotifications() { return this.get('/notifications'); }
};

