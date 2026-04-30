/**
 * TrustVault — API Client
 */
const API_BASE = 'http://localhost:5000/api';

const api = {
  async get(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  },
  async post(path, body = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  },

  // Identity
  verifyDocument: (data) => api.post('/verify/document', data),
  verifyLiveness: (data) => api.post('/verify/liveness', data),
  deepfakeScore: (data) => api.post('/verify/deepfake-score', data),
  verifyStatus: (id) => api.get(`/verify/status/${id}`),

  // Credentials
  issueCredential: (data) => api.post('/credentials/issue', data),
  getWallet: (userId) => api.get(`/credentials/wallet?user_id=${userId || localStorage.getItem('trustvault_user_id') || 'user-demo-001'}`),
  shareCredential: (data) => api.post('/credentials/share', data),
  revokeCredential: (data) => api.post('/credentials/revoke', data),
  getCredentialTypes: () => api.get('/credentials/types'),

  // Consent
  grantConsent: (data) => api.post('/consent/grant', data),
  revokeConsent: (data) => api.post('/consent/revoke', data),
  getActiveConsents: (userId) => api.get(`/consent/active?user_id=${userId || localStorage.getItem('trustvault_user_id') || 'user-demo-001'}`),
  getConsentLog: (userId) => api.get(`/consent/log?user_id=${userId || localStorage.getItem('trustvault_user_id') || 'user-demo-001'}`),
  getInstitutions: () => api.get('/consent/institutions'),

  // Anomaly
  checkAnomaly: (data) => api.post('/anomaly/check', data),
  getDashboard: () => api.get('/anomaly/dashboard'),
  getAlerts: () => api.get('/anomaly/alerts'),

  // 2FA Auth
  initAuth: (data) => api.post('/auth/init', data),
  verifyFace: (data) => api.post('/auth/verify-face', data),
  verifySecondary: (data) => api.post('/auth/verify-secondary', data),
  getAuthStatus: (sessionId) => api.get(`/auth/status/${sessionId}`),
};

window.api = api;
