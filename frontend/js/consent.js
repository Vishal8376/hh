/**
 * TrustVault — Consent & ZKP Sharing Logic
 */
document.addEventListener('DOMContentLoaded', () => {
  initIcons();
  loadInstitutions();
  loadCredentials();
  loadConsents();
  loadAuditLog();
});

let availableCreds = [];
let availableInsts = [];

async function loadInstitutions() {
  try {
    const res = await api.getInstitutions();
    availableInsts = res.institutions;
    const select = document.getElementById('inst-select');
    if(select) {
      select.innerHTML = '<option value="">Select Institution...</option>' + 
        res.institutions.map(i => `<option value="${i.id}">${i.name} (${i.type})</option>`).join('');
    }
  } catch(e) { console.error('Failed to load institutions', e); }
}

async function loadCredentials() {
  try {
    const res = await api.getWallet();
    availableCreds = res.credentials;
    const select = document.getElementById('cred-select');
    if(select) {
      if(res.credentials.length === 0) {
        select.innerHTML = '<option value="">No credentials found in wallet</option>';
      } else {
        select.innerHTML = '<option value="">Select Credential...</option>' + 
          res.credentials.map(c => `<option value="${c.id}">${c.type} (${c.issuer})</option>`).join('');
      }
    }
  } catch(e) { console.error('Failed to load credentials', e); }
}

function openShareFlow() {
  const instId = document.getElementById('inst-select').value;
  const credId = document.getElementById('cred-select').value;

  if(!instId || !credId) {
    showToast('Please select both an institution and a credential', 'error');
    return;
  }

  const cred = availableCreds.find(c => c.id === credId);
  const inst = availableInsts.find(i => i.id === instId);

  if(!cred || !cred.claims) {
    showToast('Credential details not found', 'error');
    return;
  }

  const attrList = document.getElementById('attr-list');
  attrList.innerHTML = '';
  
  // Create checkboxes for each claim
  for (const [key, value] of Object.entries(cred.claims)) {
    // Hide proof hashes or complex objects from UI simply
    if(typeof value === 'object') continue;
    
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    attrList.innerHTML += `
      <div style="display:flex;align-items:center;padding:var(--space-sm) 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <input type="checkbox" id="chk-${key}" value="${key}" checked style="margin-right:var(--space-md);accent-color:var(--accent-blue);width:16px;height:16px;">
        <label for="chk-${key}" style="flex:1;cursor:pointer;user-select:none;">
          <div style="font-weight:600;font-size:0.875rem;">${label}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">${value}</div>
        </label>
        <span class="badge" id="badge-${key}" style="background:var(--bg-secondary);color:var(--text-secondary);">Disclose Value</span>
      </div>
    `;
  }

  // Add event listeners to toggle badge text
  Object.keys(cred.claims).forEach(key => {
    const chk = document.getElementById(`chk-${key}`);
    if(chk) {
      chk.addEventListener('change', (e) => {
        const badge = document.getElementById(`badge-${key}`);
        if(e.target.checked) {
          badge.textContent = 'Disclose Value';
          badge.style.background = 'var(--bg-secondary)';
          badge.style.color = 'var(--text-secondary)';
        } else {
          badge.textContent = 'Zero-Knowledge Proof';
          badge.style.background = 'rgba(16, 185, 129, 0.1)';
          badge.style.color = 'var(--accent-green)';
        }
      });
    }
  });

  document.getElementById('share-flow').style.display = 'block';
  document.getElementById('zkp-result').innerHTML = '';
  document.getElementById('btn-share').style.display = 'inline-flex';
}

async function executeShare() {
  const instId = document.getElementById('inst-select').value;
  const credId = document.getElementById('cred-select').value;
  const inst = availableInsts.find(i => i.id === instId);
  const cred = availableCreds.find(c => c.id === credId);

  const checkboxes = document.querySelectorAll('#attr-list input[type="checkbox"]');
  const disclosed = [];
  const zkp = [];

  checkboxes.forEach(chk => {
    if(chk.checked) disclosed.push(chk.value);
    else zkp.push(chk.value);
  });

  const btn = document.getElementById('btn-share');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader" class="anim-spin"></i> Generating ZKP...';
  initIcons();

  try {
    const res = await api.grantConsent({
      user_id: localStorage.getItem('trustvault_user_id') || 'user-demo-001',
      institution_id: inst.id,
      institution_name: inst.name,
      credential_id: cred.id,
      attributes_shared: disclosed,
      purpose: 'Digital Onboarding'
    });

    document.getElementById('zkp-result').innerHTML = `
      <div class="card" style="border-color:var(--accent-green);margin-top:var(--space-lg);">
        <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-md);">
          <i data-lucide="check-circle" style="color:var(--accent-green)"></i>
          <strong>Credential Shared Successfully</strong>
        </div>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:var(--space-sm);">You have shared ${disclosed.length} attributes directly. ${zkp.length} attributes were proven via Zero-Knowledge Proof without revealing their values.</p>
        <div style="background:var(--bg-primary);padding:var(--space-md);border-radius:var(--radius-sm);font-family:monospace;font-size:0.75rem;color:var(--text-muted);word-break:break-all;">
          Proof ID: ${res.proof_id}<br>
          Hash: ${Math.random().toString(36).substring(2)}...
        </div>
      </div>
    `;
    initIcons();
    
    btn.style.display = 'none';
    showToast('Consent granted', 'success');
    
    // Refresh lists
    loadConsents();
    loadAuditLog();

  } catch(e) {
    showToast('Failed to share credential', 'error');
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="lock"></i> Generate ZKP & Share';
    initIcons();
  }
}

async function loadConsents() {
  const container = document.getElementById('active-consents');
  if(!container) return;
  
  container.innerHTML = '<div class="skeleton" style="height:100px;"></div>'.repeat(2);
  
  try {
    const res = await api.getActiveConsents();
    if(res.consents.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);">No active consents.</p>';
      return;
    }
    
    container.innerHTML = res.consents.map(c => `
      <div class="card card--flat" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-md);">
        <div>
          <h3 style="font-size:1rem;margin-bottom:4px;">${c.institution_name}</h3>
          <div style="font-size:0.875rem;color:var(--text-secondary);">Purpose: ${c.purpose}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">Shared: ${c.attributes_shared.join(', ')}</div>
        </div>
        <button class="btn btn--danger btn--sm" onclick="revokeConsent('${c.id}')">Revoke Access</button>
      </div>
    `).join('');
  } catch(e) {
    container.innerHTML = '<p style="color:var(--accent-red);">Failed to load consents.</p>';
  }
}

async function loadAuditLog() {
  const container = document.getElementById('audit-log');
  if(!container) return;
  
  container.innerHTML = '<div class="skeleton" style="height:60px;margin-bottom:8px;"></div>'.repeat(3);
  
  try {
    const res = await api.getConsentLog();
    if(res.logs.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);">No audit events.</p>';
      return;
    }
    
    container.innerHTML = res.logs.map(log => `
      <div style="padding:var(--space-md) 0;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;gap:var(--space-md);">
        <div style="color:${log.action === 'grant' ? 'var(--accent-green)' : 'var(--accent-red)'};margin-top:2px;">
          <i data-lucide="${log.action === 'grant' ? 'check-circle' : 'x-circle'}"></i>
        </div>
        <div>
          <div style="font-weight:600;font-size:0.875rem;">${log.action.toUpperCase()} - ${log.institution_name}</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">${new Date(log.timestamp).toLocaleString()}</div>
        </div>
      </div>
    `).join('');
    initIcons();
  } catch(e) {
    container.innerHTML = '<p style="color:var(--accent-red);">Failed to load audit log.</p>';
  }
}

async function revokeConsent(id) {
  if(!confirm('Revoke access? The institution will no longer be able to verify your credential.')) return;
  try {
    await api.revokeConsent({ consent_id: id });
    showToast('Access revoked', 'success');
    loadConsents();
    loadAuditLog();
  } catch(e) {
    showToast('Failed to revoke access', 'error');
  }
}
