/**
 * TrustVault — Login Page Logic
 */

// ---- Toast notification ----
function showLoginToast(msg, type = '') {
  const el = document.getElementById('login-toast');
  const msgEl = document.getElementById('login-toast-msg');
  msgEl.textContent = msg;
  el.className = 'login-toast show ' + type;
  setTimeout(() => { el.classList.remove('show'); }, 3000);
}

// ---- Toggle password visibility ----
document.getElementById('toggle-password').addEventListener('click', () => {
  const input = document.getElementById('login-password');
  const icon = document.getElementById('icon-eye');
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
  lucide.createIcons();
});

// ---- Login form ----
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');

  // Validate
  let valid = true;
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    document.getElementById('email-error').style.display = 'block';
    document.getElementById('login-email').classList.add('error');
    valid = false;
  } else {
    document.getElementById('email-error').style.display = 'none';
    document.getElementById('login-email').classList.remove('error');
  }
  if (!password || password.length < 6) {
    document.getElementById('password-error').style.display = 'block';
    document.getElementById('login-password').classList.add('error');
    valid = false;
  } else {
    document.getElementById('password-error').style.display = 'none';
    document.getElementById('login-password').classList.remove('error');
  }
  if (!valid) return;

  // Animate button
  btn.classList.add('loading');
  btn.disabled = true;

  // Simulate authentication (demo — accepts any valid input)
  await new Promise(r => setTimeout(r, 1500));

  // Store auth state
  const userId = 'user-' + email.split('@')[0];
  localStorage.setItem('trustvault_user_id', userId);
  localStorage.setItem('trustvault_user_email', email);
  localStorage.setItem('trustvault_logged_in', 'true');
  if (document.getElementById('remember-me').checked) {
    localStorage.setItem('trustvault_remember', email);
  } else {
    localStorage.removeItem('trustvault_remember');
  }

  showLoginToast('Login successful! Redirecting...', 'success');

  // Redirect to main page
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 800);
}

// ---- Forgot password ----
function showForgotPassword() {
  document.getElementById('login-panel').style.display = 'none';
  const fp = document.getElementById('forgot-panel');
  fp.classList.add('active');
  document.getElementById('forgot-step1').style.display = 'block';
  document.getElementById('forgot-step2').style.display = 'none';
  lucide.createIcons();
}

function showLoginPanel() {
  document.getElementById('forgot-panel').classList.remove('active');
  document.getElementById('login-panel').style.display = 'block';
  lucide.createIcons();
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) return;

  const btn = document.getElementById('forgot-btn');
  btn.classList.add('loading');
  btn.disabled = true;

  await new Promise(r => setTimeout(r, 1800));

  btn.classList.remove('loading');
  btn.disabled = false;

  document.getElementById('forgot-sent-email').textContent = email;
  document.getElementById('forgot-step1').style.display = 'none';
  document.getElementById('forgot-step2').style.display = 'block';
  lucide.createIcons();
}

// ---- Demo register ----
function handleDemoRegister(e) {
  e.preventDefault();
  showLoginToast('Registration is handled via KYC verification. Sign in to begin.', '');
}

// ---- Auto-fill remembered email ----
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('trustvault_remember');
  if (saved) {
    document.getElementById('login-email').value = saved;
    document.getElementById('remember-me').checked = true;
  }

  // If already logged in, redirect
  if (localStorage.getItem('trustvault_logged_in') === 'true') {
    window.location.href = 'index.html';
  }
});
