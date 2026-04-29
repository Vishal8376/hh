/**
 * TrustVault — Accessibility Controller
 */
document.addEventListener('DOMContentLoaded', () => {
  const toolbar = document.querySelector('.a11y-toolbar');
  if (!toolbar) return;

  toolbar.innerHTML = `
    <button class="a11y-btn" id="a11y-contrast" title="High Contrast"><i data-lucide="contrast"></i></button>
    <button class="a11y-btn" id="a11y-text" title="Large Text"><i data-lucide="type"></i></button>
    <button class="a11y-btn" id="a11y-bandwidth" title="Low Bandwidth Mode"><i data-lucide="wifi-off"></i></button>
    <button class="a11y-btn" id="a11y-voice" title="Voice Guidance"><i data-lucide="volume-2"></i></button>
  `;

  document.getElementById('a11y-contrast')?.addEventListener('click', function() {
    document.body.classList.toggle('high-contrast');
    this.classList.toggle('active');
    showToast(document.body.classList.contains('high-contrast') ? 'High contrast enabled' : 'High contrast disabled', 'info');
  });

  document.getElementById('a11y-text')?.addEventListener('click', function() {
    document.body.classList.toggle('large-text');
    this.classList.toggle('active');
    showToast(document.body.classList.contains('large-text') ? 'Large text enabled' : 'Large text disabled', 'info');
  });

  document.getElementById('a11y-bandwidth')?.addEventListener('click', function() {
    document.body.classList.toggle('low-bandwidth');
    this.classList.toggle('active');
    showToast(document.body.classList.contains('low-bandwidth') ? 'Low bandwidth mode enabled' : 'Low bandwidth mode disabled', 'info');
  });

  document.getElementById('a11y-voice')?.addEventListener('click', function() {
    this.classList.toggle('active');
    if (this.classList.contains('active')) {
      speak('Voice guidance enabled. Navigate through the page to hear descriptions.');
    } else {
      speechSynthesis.cancel();
      showToast('Voice guidance disabled', 'info');
    }
  });

  if (window.lucide) lucide.createIcons();
});

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  u.pitch = 1;
  speechSynthesis.speak(u);
}
window.speak = speak;
