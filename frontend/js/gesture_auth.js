/**
 * TrustVault — Hand Gesture Authentication Engine v3.0
 * =====================================================
 * Real-time hand gesture verification with:
 *  - MediaPipe 21-landmark tracking
 *  - Joint-angle finger state detection
 *  - Multi-frame scoring with consistency requirement
 *  - Motion trajectory analysis (linear + circular)
 *  - Temporal anti-spoofing (jitter, freeze, teleport detection)
 *  - Dynamic one-at-a-time challenge sequencer
 */

// ============================================================
//  CONFIGURATION
// ============================================================
const CONFIG = {
  TOTAL_CHALLENGES: 4,          // How many challenges to run
  PASS_REQUIRED: 3,             // Minimum passes to authenticate
  CHALLENGE_DURATION_MS: 4000,  // 4 seconds per challenge
  SCORE_THRESHOLD: 75,          // Similarity score threshold (0-100)
  MIN_FRAMES_FOR_PASS: 8,      // Minimum consecutive good frames needed
  MOTION_BUFFER_SIZE: 40,       // Frames kept for motion trajectory
  SPOOF_FREEZE_LIMIT: 0.0005,  // Max jitter to consider "frozen"
  SPOOF_TELEPORT_LIMIT: 0.18,  // Jump bigger than this = teleport
  INTER_CHALLENGE_DELAY: 1500,  // Pause between challenges (ms)
};

// ============================================================
//  CHALLENGE POOL — randomly sampled per session
// ============================================================
const CHALLENGE_POOL = [
  { type: 'pose',   name: 'palm',        text: '✋ Show Open Palm',               icon: '✋' },
  { type: 'pose',   name: 'fist',        text: '✊ Make a Fist',                  icon: '✊' },
  { type: 'pose',   name: 'index',       text: '☝️ Raise Your Index Finger',      icon: '☝️' },
  { type: 'pose',   name: 'peace',       text: '✌️ Show Peace / Two Fingers',     icon: '✌️' },
  { type: 'motion', name: 'swipe_right', text: '👉 Move Hand Left to Right',      icon: '👉' },
  { type: 'motion', name: 'circle',      text: '⭕ Draw a Circle in the Air',     icon: '⭕' },
];

// ============================================================
//  STATE
// ============================================================
let video, canvas, ctx, mpHands, mpCamera;

// Challenge sequencing
let challenges = [];          // Selected challenges for this session
let currentIdx = -1;          // -1 = not started
let challengeActive = false;
let challengeStartTime = 0;
let timerRAF = null;

// Per-challenge scoring
let goodFrameCount = 0;       // Frames where score > threshold
let totalFrameCount = 0;      // Total frames during this challenge

// Results
const results = [];           // { name, passed, score, frames }

// Motion / trajectory buffer
const motionBuffer = [];      // { x, y, z, t }

// Anti-spoofing
let prevLandmarks = null;     // Previous frame landmarks for diff
let frozenFrames = 0;

// FPS tracking
let fpsFrames = 0;
let fpsLast = performance.now();
let currentFps = 0;

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  video  = document.getElementById('live-video');
  canvas = document.getElementById('overlay-canvas');
  ctx    = canvas.getContext('2d');

  buildProgressDots();
  initMediaPipe();
});

function buildProgressDots() {
  const track = document.getElementById('progress-track');
  track.innerHTML = '';
  for (let i = 0; i < CONFIG.TOTAL_CHALLENGES; i++) {
    const d = document.createElement('div');
    d.className = 'pdot';
    d.id = `pdot-${i}`;
    track.appendChild(d);
  }
}

// ============================================================
//  MEDIAPIPE SETUP
// ============================================================
function initMediaPipe() {
  mpHands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });
  mpHands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.65,
    minTrackingConfidence: 0.6,
  });
  mpHands.onResults(onFrame);

  mpCamera = new Camera(video, {
    onFrame: async () => { await mpHands.send({ image: video }); },
    width: 640,
    height: 480,
  });
  mpCamera.start().then(() => {
    canvas.width = 640;
    canvas.height = 480;
    setInstruction('Show your hand to begin', 'Model loaded — preparing challenges');
    // Generate challenges and start after short delay
    selectChallenges();
    setTimeout(startNextChallenge, 2000);
  });
}

// ============================================================
//  CHALLENGE SEQUENCER
// ============================================================
function selectChallenges() {
  // Shuffle pool and pick TOTAL_CHALLENGES unique ones
  const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5);
  challenges = shuffled.slice(0, CONFIG.TOTAL_CHALLENGES);
}

function startNextChallenge() {
  currentIdx++;
  if (currentIdx >= challenges.length) {
    finishSession();
    return;
  }

  // Reset per-challenge state
  goodFrameCount = 0;
  totalFrameCount = 0;
  motionBuffer.length = 0;
  prevLandmarks = null;
  frozenFrames = 0;

  // UI
  const ch = challenges[currentIdx];
  setInstruction(ch.text, `Challenge ${currentIdx + 1} of ${challenges.length}`);
  document.getElementById(`pdot-${currentIdx}`).classList.add('active');
  updateMetrics(0, 0, 'Waiting', '--');

  // Activate
  challengeActive = true;
  challengeStartTime = performance.now();
  runTimer();
}

// ============================================================
//  TIMER
// ============================================================
function runTimer() {
  if (!challengeActive) return;
  const elapsed = performance.now() - challengeStartTime;
  const pct = Math.max(0, 1 - elapsed / CONFIG.CHALLENGE_DURATION_MS);
  const secs = Math.max(0, ((CONFIG.CHALLENGE_DURATION_MS - elapsed) / 1000)).toFixed(1);

  // Timer bar
  const fill = document.getElementById('timer-fill');
  fill.style.width = `${pct * 100}%`;
  fill.style.background = pct > 0.3 ? 'var(--accent-blue)' : pct > 0.15 ? 'var(--accent-orange)' : 'var(--accent-red)';

  // Countdown ring
  const circ = 2 * Math.PI * 22; // r=22
  document.getElementById('countdown-circle').style.strokeDashoffset = circ * (1 - pct);
  document.getElementById('countdown-circle').style.stroke = pct > 0.3 ? '#3b82f6' : pct > 0.15 ? '#f59e0b' : '#ef4444';
  document.getElementById('countdown-text').textContent = secs;

  // Timeout
  if (elapsed >= CONFIG.CHALLENGE_DURATION_MS) {
    endChallenge(false, 'Too Slow');
    return;
  }
  timerRAF = requestAnimationFrame(runTimer);
}

// ============================================================
//  PER-FRAME CALLBACK — the core loop
// ============================================================
function onFrame(frameResults) {
  // FPS tracking
  fpsFrames++;
  const now = performance.now();
  if (now - fpsLast >= 1000) {
    currentFps = fpsFrames;
    fpsFrames = 0;
    fpsLast = now;
    document.getElementById('fps-badge').textContent = `${currentFps} FPS`;
  }

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!frameResults.multiHandLandmarks || frameResults.multiHandLandmarks.length === 0) {
    // No hand detected
    drawNoHandGuide();
    updateMetrics(0, 0, 'No hand', '--');
    prevLandmarks = null;
    return;
  }

  const lm = frameResults.multiHandLandmarks[0];
  drawHand(lm);

  if (!challengeActive) return;

  totalFrameCount++;

  // ---- Anti-spoofing checks ----
  const spoofResult = runAntiSpoof(lm);
  updateMetric('m-liveness', spoofResult.label, spoofResult.ok ? 'var(--accent-green)' : 'var(--accent-red)');

  if (!spoofResult.ok) {
    // Don't count this frame towards the score
    prevLandmarks = lm;
    return;
  }

  // ---- Gesture analysis ----
  const ch = challenges[currentIdx];
  let score = 0;

  if (ch.type === 'pose') {
    score = evaluatePose(ch.name, lm);
  } else if (ch.type === 'motion') {
    // Push to motion buffer
    const center = palmCenter(lm);
    motionBuffer.push({ x: center.x, y: center.y, z: center.z || 0, t: now });
    if (motionBuffer.length > CONFIG.MOTION_BUFFER_SIZE) motionBuffer.shift();

    score = evaluateMotion(ch.name);
  }

  // ---- Multi-frame scoring ----
  if (score >= CONFIG.SCORE_THRESHOLD) {
    goodFrameCount++;
  } else {
    // Allow small dips — only reset if score drops very low
    if (score < CONFIG.SCORE_THRESHOLD * 0.5) {
      goodFrameCount = Math.max(0, goodFrameCount - 1);
    }
  }

  // Update UI
  updateMetrics(score, goodFrameCount, spoofResult.motionLabel, spoofResult.label);

  // Check pass condition: score above threshold AND enough consistent frames
  if (goodFrameCount >= CONFIG.MIN_FRAMES_FOR_PASS && score >= CONFIG.SCORE_THRESHOLD) {
    endChallenge(true, 'Verified!');
  }

  prevLandmarks = lm;
}

// ============================================================
//  ANTI-SPOOFING
// ============================================================
function runAntiSpoof(lm) {
  if (!prevLandmarks) {
    prevLandmarks = lm;
    return { ok: true, label: 'Checking...', motionLabel: 'Waiting' };
  }

  // 1. Frame-to-frame displacement (per-landmark average)
  let totalDisp = 0;
  for (let i = 0; i < 21; i++) {
    const dx = lm[i].x - prevLandmarks[i].x;
    const dy = lm[i].y - prevLandmarks[i].y;
    totalDisp += Math.sqrt(dx * dx + dy * dy);
  }
  const avgDisp = totalDisp / 21;

  // 2. Freeze detection — identical frames = static image / replay
  if (avgDisp < CONFIG.SPOOF_FREEZE_LIMIT) {
    frozenFrames++;
    if (frozenFrames > 6) {
      return { ok: false, label: '⚠ Static Input', motionLabel: 'Frozen' };
    }
  } else {
    frozenFrames = Math.max(0, frozenFrames - 1);
  }

  // 3. Teleport detection — impossible jumps
  if (avgDisp > CONFIG.SPOOF_TELEPORT_LIMIT) {
    return { ok: false, label: '⚠ Jump Detected', motionLabel: 'Teleport' };
  }

  // Motion quality label
  let motionLabel = 'Natural';
  if (avgDisp < 0.002) motionLabel = 'Very Still';
  else if (avgDisp > 0.08) motionLabel = 'Fast';

  return { ok: true, label: 'Live', motionLabel };
}

// ============================================================
//  POSE CLASSIFIERS — Joint-angle based
// ============================================================

/**
 * Compute the angle (in degrees) at joint B given points A-B-C.
 */
function jointAngle(a, b, c) {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);
  if (magBA * magBC === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

/**
 * Determine if a finger is extended using the angle at the PIP joint.
 * Extended fingers have a straighter (larger) angle at PIP.
 *
 * Finger indices (MediaPipe):
 *   Thumb:  1(CMC) 2(MCP) 3(IP)  4(TIP)
 *   Index:  5(MCP) 6(PIP) 7(DIP) 8(TIP)
 *   Middle: 9(MCP) 10(PIP) 11(DIP) 12(TIP)
 *   Ring:   13(MCP) 14(PIP) 15(DIP) 16(TIP)
 *   Pinky:  17(MCP) 18(PIP) 19(DIP) 20(TIP)
 */
function isFingerExtended(lm, fingerIdx) {
  // fingerIdx: 0=thumb, 1=index, 2=middle, 3=ring, 4=pinky
  const joints = [
    [1, 2, 3, 4],      // thumb
    [5, 6, 7, 8],      // index
    [9, 10, 11, 12],   // middle
    [13, 14, 15, 16],  // ring
    [17, 18, 19, 20],  // pinky
  ];
  const [mcp, pip, dip, tip] = joints[fingerIdx];

  if (fingerIdx === 0) {
    // Thumb: Use distance from tip to index MCP as proxy
    const d = dist2D(lm[tip], lm[5]);
    return d > 0.08; // thumb is "out" when far from index base
  }

  // For fingers: angle at PIP joint (MCP-PIP-DIP)
  const angle = jointAngle(lm[mcp], lm[pip], lm[dip]);
  // Also check tip is above PIP (in normalized coords, lower y = higher on screen)
  const tipAbovePip = lm[tip].y < lm[pip].y;
  return angle > 140 && tipAbovePip;
}

function getFingerStates(lm) {
  return [0, 1, 2, 3, 4].map(i => isFingerExtended(lm, i));
}

function evaluatePose(name, lm) {
  const [thumb, index, middle, ring, pinky] = getFingerStates(lm);

  switch (name) {
    case 'palm': {
      // All 5 fingers extended
      const extended = [thumb, index, middle, ring, pinky].filter(Boolean).length;
      // Also check spread: fingers shouldn't be stacked
      const spread = dist2D(lm[8], lm[20]); // index tip to pinky tip
      const spreadBonus = spread > 0.12 ? 10 : 0;
      return Math.min(100, (extended / 5) * 90 + spreadBonus);
    }

    case 'fist': {
      // All fingers curled — tips close to palm center
      const palmPt = palmCenter(lm);
      let closeness = 0;
      const tips = [8, 12, 16, 20];
      for (const t of tips) {
        const d = dist2D(lm[t], palmPt);
        if (d < 0.08) closeness += 25;       // very close
        else if (d < 0.12) closeness += 15;   // somewhat close
      }
      // Penalise if any finger is clearly extended
      const extendedCount = [index, middle, ring, pinky].filter(Boolean).length;
      return Math.max(0, closeness - extendedCount * 15);
    }

    case 'index': {
      // Only index extended, others curled
      const indexUp = index ? 40 : 0;
      const othersCurled = [middle, ring, pinky].filter(b => !b).length;
      return indexUp + (othersCurled / 3) * 60;
    }

    case 'peace': {
      // Index + middle extended, ring + pinky curled
      const twoUp = (index ? 30 : 0) + (middle ? 30 : 0);
      const twoCurled = (!ring ? 20 : 0) + (!pinky ? 20 : 0);
      return twoUp + twoCurled;
    }

    default:
      return 0;
  }
}

// ============================================================
//  MOTION CLASSIFIERS
// ============================================================
function evaluateMotion(name) {
  if (motionBuffer.length < 15) return 0;

  switch (name) {
    case 'swipe_right': return detectSwipe();
    case 'circle':      return detectCircle();
    default:            return 0;
  }
}

/**
 * Detect left-to-right swipe:
 *  - Significant horizontal displacement
 *  - Limited vertical deviation
 *  - Continuous movement (no pauses)
 */
function detectSwipe() {
  const recent = motionBuffer.slice(-20);
  if (recent.length < 15) return 0;

  // Total horizontal displacement (right = decreasing x in mirrored view)
  const dx = recent[0].x - recent[recent.length - 1].x;
  // Vertical deviation (should be small)
  const ys = recent.map(p => p.y);
  const yRange = Math.max(...ys) - Math.min(...ys);

  // Speed: displacement over time
  const dt = (recent[recent.length - 1].t - recent[0].t) / 1000;
  const speed = Math.abs(dx) / Math.max(dt, 0.001);

  // Scoring
  let score = 0;
  if (Math.abs(dx) > 0.25) score += 50;       // enough horizontal movement
  else if (Math.abs(dx) > 0.15) score += 30;
  if (yRange < 0.12) score += 25;              // limited vertical wobble
  else if (yRange < 0.2) score += 10;
  if (speed > 0.3 && speed < 3.0) score += 25; // reasonable speed

  return Math.min(100, score);
}

/**
 * Detect circular motion:
 *  - Compute centroid of trajectory
 *  - Measure radial distances — low variance = circle
 *  - Require minimum radius (no static hand)
 *  - Check angular coverage (should traverse most of 360°)
 */
function detectCircle() {
  const recent = motionBuffer.slice(-30);
  if (recent.length < 20) return 0;

  // Centroid
  const cx = recent.reduce((s, p) => s + p.x, 0) / recent.length;
  const cy = recent.reduce((s, p) => s + p.y, 0) / recent.length;

  // Radii
  const radii = recent.map(p => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2));
  const meanR = radii.reduce((a, b) => a + b, 0) / radii.length;

  if (meanR < 0.04) return 0; // too small / static

  // Variance of radii — lower = more circular
  const variance = radii.reduce((s, r) => s + (r - meanR) ** 2, 0) / radii.length;
  const cv = Math.sqrt(variance) / meanR; // coefficient of variation

  // Angular coverage: compute angles from centroid, check how many quadrants hit
  const angles = recent.map(p => Math.atan2(p.y - cy, p.x - cx));
  const quadrants = new Set(angles.map(a => Math.floor(((a + Math.PI) / (Math.PI / 2)) % 4)));

  let score = 0;
  if (cv < 0.3) score += 45;         // good circularity
  else if (cv < 0.5) score += 25;
  if (quadrants.size >= 4) score += 35; // full circle coverage
  else if (quadrants.size >= 3) score += 20;
  if (meanR > 0.06) score += 20;     // decent size

  return Math.min(100, score);
}

// ============================================================
//  CHALLENGE FLOW CONTROL
// ============================================================
function endChallenge(passed, feedbackText) {
  if (!challengeActive) return;
  challengeActive = false;
  cancelAnimationFrame(timerRAF);

  // Record result
  const avgScore = totalFrameCount > 0
    ? Math.round((goodFrameCount / totalFrameCount) * 100)
    : 0;
  results.push({
    name: challenges[currentIdx].text,
    passed,
    score: avgScore,
    goodFrames: goodFrameCount,
    totalFrames: totalFrameCount,
  });

  // Update dot
  const dot = document.getElementById(`pdot-${currentIdx}`);
  dot.classList.remove('active');
  dot.classList.add(passed ? 'pass' : 'fail');

  // Feedback overlay
  showFeedback(feedbackText, passed ? 'success' : (feedbackText === 'Too Slow' ? 'warn' : 'error'));

  // Next challenge after delay
  setTimeout(startNextChallenge, CONFIG.INTER_CHALLENGE_DELAY);
}

function finishSession() {
  const passCount = results.filter(r => r.passed).length;
  const authenticated = passCount >= CONFIG.PASS_REQUIRED;
  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
    : 0;

  // Show result modal
  const backdrop = document.getElementById('result-backdrop');
  const icon = document.getElementById('result-icon');
  icon.className = `result-icon ${authenticated ? 'ok' : 'bad'}`;
  icon.innerHTML = authenticated
    ? '<i data-lucide="shield-check" style="width:36px;height:36px;"></i>'
    : '<i data-lucide="shield-x" style="width:36px;height:36px;"></i>';

  document.getElementById('result-title').textContent = authenticated
    ? 'Authentication Successful'
    : 'Authentication Failed';

  document.getElementById('result-stats').innerHTML = `
    <div class="result-stat">
      <div class="num" style="color:var(--accent-green);">${passCount}</div>
      <div class="lbl">Passed</div>
    </div>
    <div class="result-stat">
      <div class="num" style="color:var(--accent-red);">${results.length - passCount}</div>
      <div class="lbl">Failed</div>
    </div>
    <div class="result-stat">
      <div class="num" style="color:var(--accent-blue);">${avgScore}%</div>
      <div class="lbl">Avg Score</div>
    </div>
  `;

  document.getElementById('result-text').textContent = authenticated
    ? `You passed ${passCount} of ${results.length} challenges. Your identity has been verified.`
    : `Only ${passCount} of ${results.length} challenges passed. Minimum ${CONFIG.PASS_REQUIRED} required.`;

  document.getElementById(authenticated ? 'result-btn' : 'retry-btn').style.display = 'inline-flex';
  backdrop.classList.add('show');
  lucide.createIcons();

  // Log to backend
  api.verifySecondary({
    session_id: localStorage.getItem('trustvault_auth_session') || 'gesture-session',
    method: 'gesture',
    success: authenticated,
    details: results,
  }).catch(() => {});
}

// ============================================================
//  DRAWING HELPERS
// ============================================================
function drawHand(lm) {
  // Mirror the canvas to match the mirrored video
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  // Connections
  drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: 'rgba(59,130,246,0.55)', lineWidth: 3 });

  // Landmarks with finger-state coloring
  const states = getFingerStates(lm);
  const fingerTips = [4, 8, 12, 16, 20];
  for (let i = 0; i < 21; i++) {
    const pt = lm[i];
    const isTip = fingerTips.includes(i);
    const fingerGroup = i <= 4 ? 0 : i <= 8 ? 1 : i <= 12 ? 2 : i <= 16 ? 3 : 4;
    const extended = states[fingerGroup];

    ctx.beginPath();
    ctx.arc(pt.x * canvas.width, pt.y * canvas.height, isTip ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = isTip
      ? (extended ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)')
      : 'rgba(255,255,255,0.7)';
    ctx.fill();
  }

  ctx.restore();
}

function drawNoHandGuide() {
  ctx.strokeStyle = 'rgba(239,68,68,0.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, canvas.height / 2, 100, 130, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Show your hand here', canvas.width / 2, canvas.height / 2 + 150);
}

// ============================================================
//  UI HELPERS
// ============================================================
function setInstruction(text, label) {
  document.getElementById('challenge-instruction').textContent = text;
  document.getElementById('challenge-label').textContent = label;
}

function updateMetrics(score, frames, motionText, livenessText) {
  document.getElementById('m-score').textContent = `${Math.round(score)}%`;
  const bar = document.getElementById('m-score-bar');
  bar.style.width = `${Math.round(score)}%`;
  bar.style.background = score >= CONFIG.SCORE_THRESHOLD ? 'var(--accent-green)' : score >= 50 ? 'var(--accent-orange)' : 'var(--accent-red)';

  document.getElementById('m-frames').textContent = `${frames} / ${CONFIG.MIN_FRAMES_FOR_PASS}`;
  document.getElementById('m-motion').textContent = motionText;
}

function updateMetric(id, text, color) {
  const el = document.getElementById(id);
  el.textContent = text;
  if (color) el.style.color = color;
}

function showFeedback(text, type) {
  const overlay = document.getElementById('feedback-overlay');
  const msg = document.getElementById('feedback-msg');
  msg.textContent = text;
  overlay.className = `feedback-overlay ${type} show`;
  setTimeout(() => overlay.classList.remove('show'), 1200);
}

// ============================================================
//  MATH HELPERS
// ============================================================
function dist2D(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function palmCenter(lm) {
  // Average of wrist(0), index MCP(5), middle MCP(9), ring MCP(13), pinky MCP(17)
  const pts = [0, 5, 9, 13, 17];
  const cx = pts.reduce((s, i) => s + lm[i].x, 0) / pts.length;
  const cy = pts.reduce((s, i) => s + lm[i].y, 0) / pts.length;
  const cz = pts.reduce((s, i) => s + (lm[i].z || 0), 0) / pts.length;
  return { x: cx, y: cy, z: cz };
}
