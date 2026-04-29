/**
 * TrustVault — Wallet Page Logic
 */
document.addEventListener('DOMContentLoaded', () => {
  initIcons();
  loadWallet();
});

async function loadWallet() {
  const grid = document.getElementById('cred-grid');
  grid.innerHTML = '<div class="skeleton" style="height:200px;"></div>'.repeat(3);

  try {
    const res = await api.getWallet();
    if (!res.credentials.length) {
      grid.innerHTML = '<div class="card" style="text-align:center;grid-column:1/-1;padding:var(--space-3xl);"><i data-lucide="inbox" style="width:48px;height:48px;color:var(--text-muted);margin:0 auto var(--space-md);display:block;"></i><p style="color:var(--text-secondary);">No credentials yet. <a href="verify.html">Start verification</a></p></div>';
      initIcons();
      return;
    }

    const colors = { 'Aadhaar KYC': '#E65100', 'PAN Verification': '#1565C0', 'Bank KYC': '#2E7D32', 'Video KYC': '#6A1B9A' };
    grid.innerHTML = res.credentials.map(c => {
      const bg = colors[c.type] || c.color || '#424242';
      return `
        <div class="cred-card card" style="background:linear-gradient(135deg,${bg},${bg}cc);" onclick="showCredDetail('${c.id}')">
          <div class="cred-card__header">
            <div class="cred-card__icon"><i data-lucide="${c.icon || 'shield'}"></i></div>
            <span class="cred-card__level">${c.verification_level || 'L1'}</span>
          </div>
          <div class="cred-card__body">
            <div class="cred-card__type">${c.type}</div>
            <div class="cred-card__issuer">${c.issuer}</div>
            <div class="cred-card__hash" style="margin-top:var(--space-sm);">${c.proof_hash ? c.proof_hash.substring(0,28)+'...' : ''}</div>
          </div>
          <div class="cred-card__footer">
            <span>Issued ${c.issued_at ? new Date(c.issued_at).toLocaleDateString() : 'N/A'}</span>
            <span class="badge badge--green">Active</span>
          </div>
        </div>`;
    }).join('');
    initIcons();

    document.getElementById('cred-count').textContent = res.total;
  } catch(e) {
    grid.innerHTML = '<p style="color:var(--accent-red);">Failed to load wallet.</p>';
  }
}

let allCredentials = [];
async function showCredDetail(credId) {
  const res = await api.getWallet();
  const cred = res.credentials.find(c => c.id === credId);
  if (!cred) return;

  const modal = document.getElementById('cred-modal');
  const body = document.getElementById('cred-modal-body');

  let claimsHtml = '';
  if (cred.claims) {
    claimsHtml = Object.entries(cred.claims).map(([k,v]) =>
      `<div class="cred-detail__row"><span class="cred-detail__label">${k.replace(/_/g,' ')}</span><span class="cred-detail__value">${v}</span></div>`
    ).join('');
  }

  body.innerHTML = `
    <div class="cred-detail">
      <div class="cred-detail__row"><span class="cred-detail__label">Credential ID</span><span class="cred-detail__value">${cred.id}</span></div>
      <div class="cred-detail__row"><span class="cred-detail__label">Type</span><span class="cred-detail__value">${cred.type}</span></div>
      <div class="cred-detail__row"><span class="cred-detail__label">Issuer</span><span class="cred-detail__value">${cred.issuer}</span></div>
      <div class="cred-detail__row"><span class="cred-detail__label">Status</span><span class="badge badge--green">${cred.status}</span></div>
      <div class="cred-detail__row"><span class="cred-detail__label">Proof Hash</span><span class="cred-detail__value" style="font-size:0.7rem;">${cred.proof_hash || 'N/A'}</span></div>
      ${claimsHtml}
    </div>
    <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-xl);flex-wrap:wrap;">
      <a href="consent.html" class="btn btn--primary btn--sm"><i data-lucide="share-2"></i> Share</a>
      <button class="btn btn--danger btn--sm" onclick="revokeCred('${cred.id}')"><i data-lucide="x-circle"></i> Revoke</button>
    </div>
  `;
  initIcons();
  modal.classList.add('active');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

async function revokeCred(credId) {
  if (!confirm('Revoke this credential? This cannot be undone.')) return;
  try {
    await api.revokeCredential({ credential_id: credId });
    showToast('Credential revoked', 'success');
    closeModal('cred-modal');
    loadWallet();
  } catch(e) { showToast('Revocation failed', 'error'); }
}
