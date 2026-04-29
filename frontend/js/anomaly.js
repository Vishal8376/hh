/**
 * TrustVault — Anomaly Detection Dashboard
 */
document.addEventListener('DOMContentLoaded', () => {
  initIcons();
  loadDashboard();
  loadAlerts();
});

async function loadDashboard() {
  try {
    const data = await api.getDashboard();
    const s = data.summary;
    document.getElementById('stat-total').textContent = s.total_verifications_24h.toLocaleString();
    document.getElementById('stat-flagged').textContent = s.total_flagged_24h;
    document.getElementById('stat-blocked').textContent = s.total_blocked_24h;
    document.getElementById('stat-pass').textContent = (s.pass_rate * 100).toFixed(1) + '%';

    renderChart(data.hourly_data);
    renderThreats(data.threat_distribution);
    renderRiskGauge(s.avg_risk_score);
  } catch(e) {
    showToast('Dashboard load failed', 'error');
  }
}

function renderChart(hourly) {
  const ctx = document.getElementById('main-chart');
  if (!ctx || !window.Chart) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: hourly.map(h => h.hour),
      datasets: [
        { label: 'Verifications', data: hourly.map(h => h.total_verifications), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.1)', fill: true, tension: 0.4 },
        { label: 'Flagged', data: hourly.map(h => h.flagged), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.1)', fill: true, tension: 0.4 },
        { label: 'Blocked', data: hourly.map(h => h.blocked), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.1)', fill: true, tension: 0.4 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } } },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,.05)' } },
        y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,.05)' } }
      }
    }
  });
}

function renderThreats(dist) {
  const container = document.getElementById('threat-bars');
  if (!container) return;
  const max = Math.max(...Object.values(dist), 1);
  const colors = { deepfake_attempts: '#ef4444', synthetic_identity: '#f59e0b', injection_attacks: '#ec4899', behavioral_anomalies: '#8b5cf6', credential_misuse: '#06b6d4', velocity_violations: '#10b981' };
  container.innerHTML = Object.entries(dist).map(([k,v]) => {
    const pct = (v / max * 100).toFixed(0);
    const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `<div class="threat-bar"><span class="threat-bar__label">${label}</span><div class="threat-bar__track"><div class="threat-bar__fill" style="width:${pct}%;background:${colors[k]||'#3b82f6'}"></div></div><span class="threat-bar__count">${v}</span></div>`;
  }).join('');
}

function renderRiskGauge(score) {
  const el = document.getElementById('risk-gauge-value');
  const circle = document.getElementById('risk-gauge-circle');
  if (!el || !circle) return;
  const pct = (score * 100).toFixed(1);
  const color = score < 0.2 ? '#10b981' : score < 0.5 ? '#f59e0b' : '#ef4444';
  el.textContent = pct + '%';
  el.style.color = color;
  const c = 2 * Math.PI * 80;
  circle.style.strokeDasharray = c;
  circle.style.stroke = color;
  setTimeout(() => { circle.style.transition = 'stroke-dashoffset 1.5s ease'; circle.style.strokeDashoffset = c * (1 - score); }, 200);
}

async function loadAlerts() {
  const feed = document.getElementById('alert-feed');
  try {
    const res = await api.getAlerts();
    const icons = { deepfake_attempt: 'scan-face', synthetic_identity: 'user-x', injection_attack: 'shield-alert', behavioral_anomaly: 'activity', credential_reuse: 'copy' };
    const colors = { critical: 'var(--accent-red)', high: 'var(--accent-orange)', medium: 'var(--accent-purple)', low: 'var(--accent-blue)' };
    feed.innerHTML = res.alerts.map(a => `
      <div class="alert-item alert-item--${a.severity}">
        <div class="alert-item__icon" style="background:${colors[a.severity]}22;color:${colors[a.severity]}"><i data-lucide="${icons[a.event_type]||'alert-triangle'}"></i></div>
        <div class="alert-item__content">
          <div class="alert-item__title"><span class="badge badge--${a.severity==='critical'?'red':a.severity==='high'?'orange':a.severity==='medium'?'purple':'blue'}">${a.severity}</span> ${a.event_type.replace(/_/g,' ')}</div>
          <div class="alert-item__desc">${a.description}</div>
          <div class="alert-item__time">${new Date(a.detected_at).toLocaleString()}</div>
        </div>
      </div>
    `).join('');
    initIcons();
  } catch(e) { feed.innerHTML = '<p style="color:var(--accent-red)">Failed to load alerts.</p>'; }
}
