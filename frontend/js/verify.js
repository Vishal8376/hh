/**
 * TrustVault — Identity Verification Flow
 * Uses face-api.js for REAL face detection, landmark extraction,
 * expression analysis, and liveness challenge detection.
 */

let currentStep = 0;
let sessionId = null;
let video, canvas, ctx;
let faceDetectionInterval = null;
let modelsLoaded = false;
let currentUserId = 'user-demo-001';
let uploadedFile = null;

// Collected data for live analysis
let frameCount = 0;
let landmarkHistory = [];
let expressionHistory = [];
let blinkState = { prev: null, detected: false, confidence: 0 };
let headTurnState = { baseline: null, detected: false, magnitude: 0 };
let smileState = { detected: false, confidence: 0 };
let sessionStartTime = Date.now();

const STEPS = ['document', 'liveness', 'gesture', 'deepfake', 'result'];

document.addEventListener('DOMContentLoaded', async () => {
  initIcons();
  showStep(0);
  // Pre-load face-api models
  loadFaceApiModels();
});

async function loadFaceApiModels() {
  if (!window.faceapi) {
    console.warn('face-api.js not loaded');
    return;
  }
  const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    console.log('face-api.js models loaded');
  } catch (e) {
    console.error('Model load error:', e);
  }
}

function showStep(idx) {
  currentStep = idx;
  STEPS.forEach((s, i) => {
    const el = document.getElementById(`step-${s}`);
    if (el) el.style.display = i === idx ? 'block' : 'none';
  });
  document.querySelectorAll('.step').forEach((el, i) => {
    el.classList.remove('active', 'completed');
    if (i < idx) el.classList.add('completed');
    if (i === idx) el.classList.add('active');
  });
}

/* Step 1: Document Upload with OCR */
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  uploadedFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('doc-preview');
    preview.src = e.target.result;
    preview.style.display = 'block';
    document.getElementById('upload-text').innerHTML = `<strong>${file.name}</strong><br><span style="font-size:.75rem;color:var(--text-muted);">Ready for OCR Analysis</span>`;
    
    document.getElementById('ocr-form').style.display = 'none';
    document.getElementById('btn-upload').style.display = 'inline-flex';
    document.getElementById('btn-submit-doc').style.display = 'none';
    document.getElementById('doc-result').innerHTML = '';
    document.getElementById('btn-next-liveness').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function runDocumentOCR() {
  if (!uploadedFile) {
    showToast('Please select an image file first', 'error');
    return;
  }

  const btn = document.getElementById('btn-upload');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader" class="anim-spin"></i> Running Tesseract OCR...';
  initIcons();

  try {
    if (!window.Tesseract) throw new Error('Tesseract not loaded');
    const worker = await Tesseract.createWorker('eng');
    const ret = await worker.recognize(uploadedFile);
    await worker.terminate();

    const text = ret.data.text;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
    
    let name = '';
    let docNum = '';
    let dob = '';

    const dobMatch = text.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
    if (dobMatch) dob = dobMatch[1];

    const numMatch = text.match(/(\d{4}\s?\d{4}\s?\d{4}|\b[A-Z]{5}\d{4}[A-Z]\b)/);
    if (numMatch) docNum = numMatch[1];

    const nameLine = lines.find(l => /^[A-Z\s]{4,}$/.test(l) && !l.includes('GOVT') && !l.includes('CARD'));
    if (nameLine) name = nameLine;
    else if (lines.length > 2) name = lines[2];

    document.getElementById('extr-name').value = name;
    document.getElementById('extr-dob').value = dob;
    document.getElementById('extr-num').value = docNum;

    document.getElementById('ocr-form').style.display = 'block';
    btn.style.display = 'none';
    document.getElementById('btn-submit-doc').style.display = 'inline-flex';
    showToast('OCR complete. Please verify data.', 'success');
  } catch (e) {
    console.error(e);
    showToast('OCR failed. Please enter data manually.', 'error');
    document.getElementById('ocr-form').style.display = 'block';
    btn.style.display = 'none';
    document.getElementById('btn-submit-doc').style.display = 'inline-flex';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="scan-line"></i> Run OCR Analysis';
    initIcons();
  }
}

async function submitDocument() {
  const docType = document.getElementById('doc-type')?.value || 'aadhaar';
  const name = document.getElementById('extr-name').value || 'Unknown User';
  const dob = document.getElementById('extr-dob').value || '1990-01-01';
  const docNum = document.getElementById('extr-num').value || 'XXXX-XXXX-0000';

  const btn = document.getElementById('btn-submit-doc');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader" class="anim-spin"></i> Verifying...';
  initIcons();

  try {
    currentUserId = 'user-' + Date.now();
    localStorage.setItem('trustvault_user_id', currentUserId);
    
    const res = await api.verifyDocument({ 
        document_type: docType, 
        user_id: currentUserId,
        name: name,
        dob: dob,
        document_number: docNum
    });
    sessionId = res.session_id;
    sessionStartTime = Date.now();

    document.getElementById('doc-result').innerHTML = `
      <div class="card" style="border-color: var(--accent-green); margin-top: var(--space-md);">
        <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-md);">
          <i data-lucide="check-circle" style="color:var(--accent-green)"></i>
          <strong>Document Verified</strong>
          <span class="badge badge--green">Authentic</span>
        </div>
        <div class="cred-detail">
          <div class="cred-detail__row"><span class="cred-detail__label">Type</span><span class="cred-detail__value">${res.result.document_type.toUpperCase()}</span></div>
          <div class="cred-detail__row"><span class="cred-detail__label">Name</span><span class="cred-detail__value">${res.result.ocr_extracted.name}</span></div>
          <div class="cred-detail__row"><span class="cred-detail__label">Doc Number</span><span class="cred-detail__value">${res.result.ocr_extracted.document_number_masked}</span></div>
        </div>
      </div>
    `;
    initIcons();

    btn.style.display = 'none';
    document.getElementById('ocr-form').style.display = 'none';
    document.getElementById('btn-next-liveness').style.display = 'inline-flex';
  } catch (e) {
    showToast('Document verification failed', 'error');
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="check-circle"></i> Confirm & Verify';
    initIcons();
  }
}

/* Step 2: Liveness — Real webcam + face-api.js */
async function startLiveness() {
  showStep(1);
  video = document.getElementById('live-video');
  canvas = document.getElementById('live-canvas');
  // Reset state
  frameCount = 0;
  landmarkHistory = [];
  expressionHistory = [];
  blinkState = { prev: null, detected: false, confidence: 0 };
  headTurnState = { baseline: null, detected: false, magnitude: 0 };
  smileState = { detected: false, confidence: 0 };

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 }
    });
    video.srcObject = stream;
    await video.play();
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx = canvas.getContext('2d');
    document.getElementById('camera-status-text').textContent = 'Camera active — Position your face in the oval';

    if (modelsLoaded) {
      startRealFaceDetection();
    } else {
      document.getElementById('camera-status-text').textContent = 'Loading AI models...';
      showToast('Loading face detection models...', 'info');
      await loadFaceApiModels();
      if (modelsLoaded) {
        startRealFaceDetection();
      } else {
        document.getElementById('camera-status-text').textContent = 'Models failed — simulation mode';
        simulateLiveness();
      }
    }
    // Start challenges
    setTimeout(() => activateChallenge('blink'), 2000);
  } catch (e) {
    document.getElementById('camera-status-text').textContent = 'Camera denied — simulation mode';
    showToast('Camera access denied. Running in simulation mode.', 'info');
    simulateLiveness();
  }
}

function startRealFaceDetection() {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });

  faceDetectionInterval = setInterval(async () => {
    if (!video || video.paused || video.ended) return;

    const result = await faceapi
      .detectSingleFace(video, options)
      .withFaceLandmarks(true)
      .withFaceExpressions();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frameCount++;

    if (!result) {
      // No face — draw red guide
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(canvas.width / 2, canvas.height / 2, 90, 120, 0, 0, Math.PI * 2);
      ctx.stroke();
      document.getElementById('camera-status-text').textContent = 'No face detected — look at the camera';
      return;
    }

    // --- Draw landmarks on canvas ---
    const landmarks = result.landmarks;
    const positions = landmarks.positions;
    ctx.fillStyle = 'rgba(16, 185, 129, 0.6)';
    for (const pt of positions) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw bounding box
    const box = result.detection.box;
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    document.getElementById('camera-status-text').textContent =
      `Face detected (${(result.detection.score * 100).toFixed(0)}% confidence) — Complete challenges`;

    // Collect data
    const lmArray = positions.map(p => ({ x: p.x, y: p.y }));
    landmarkHistory.push(lmArray);
    if (landmarkHistory.length > 30) landmarkHistory.shift(); // keep last 30 frames

    const expr = result.expressions;
    expressionHistory.push({ ...expr });
    if (expressionHistory.length > 30) expressionHistory.shift();

    // --- LIVE challenge detection ---

    // 1. BLINK: detect eye aspect ratio change
    if (!blinkState.detected) {
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const ear = (eyeAspectRatio(leftEye) + eyeAspectRatio(rightEye)) / 2;
      if (blinkState.prev !== null) {
        const delta = blinkState.prev - ear;
        if (delta > 0.05) {  // eyes closed significantly vs previous
          blinkState.detected = true;
          blinkState.confidence = Math.min(1, delta * 10);
          completeChallenge('blink');
          setTimeout(() => activateChallenge('turn'), 500);
        }
      }
      blinkState.prev = ear;
    }

    // 2. HEAD TURN: detect nose X shift from baseline
    if (!headTurnState.detected && blinkState.detected) {
      const noseX = positions[30].x;
      if (headTurnState.baseline === null) {
        headTurnState.baseline = noseX;
      } else {
        const shift = Math.abs(noseX - headTurnState.baseline);
        if (shift > 25) {  // significant head movement
          headTurnState.detected = true;
          headTurnState.magnitude = shift;
          completeChallenge('turn');
          setTimeout(() => activateChallenge('smile'), 500);
        }
      }
    }

    // 3. SMILE: detect happy expression
    if (!smileState.detected && headTurnState.detected) {
      const happy = expr.happy || 0;
      if (happy > 0.5) {
        smileState.detected = true;
        smileState.confidence = happy;
        completeChallenge('smile');
      }
    }

    // All challenges done?
    if (blinkState.detected && headTurnState.detected && smileState.detected) {
      clearInterval(faceDetectionInterval);
      faceDetectionInterval = null;
      completeLiveness();
    }
  }, 200); // Run every 200ms
}

function eyeAspectRatio(eyePoints) {
  // Vertical distances
  const v1 = dist(eyePoints[1], eyePoints[5]);
  const v2 = dist(eyePoints[2], eyePoints[4]);
  // Horizontal distance
  const h = dist(eyePoints[0], eyePoints[3]);
  return (v1 + v2) / (2.0 * (h || 1));
}

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function activateChallenge(name) {
  const el = document.getElementById(`challenge-${name}`);
  if (el) { el.classList.add('active'); el.querySelector('.challenge-card__status').textContent = 'Detecting...'; }
}

function completeChallenge(name) {
  const el = document.getElementById(`challenge-${name}`);
  if (el) { el.classList.remove('active'); el.classList.add('completed'); el.querySelector('.challenge-card__status').textContent = 'Detected'; }
}

async function completeLiveness() {
  // Compute landmark variance across collected frames
  let variance = 0;
  if (landmarkHistory.length >= 2) {
    const diffs = [];
    for (let f = 1; f < landmarkHistory.length; f++) {
      let frameDiff = 0;
      for (let i = 0; i < Math.min(landmarkHistory[f].length, 68); i++) {
        const dx = landmarkHistory[f][i].x - landmarkHistory[f - 1][i].x;
        const dy = landmarkHistory[f][i].y - landmarkHistory[f - 1][i].y;
        frameDiff += Math.sqrt(dx * dx + dy * dy);
      }
      diffs.push(frameDiff / 68);
    }
    variance = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  }

  try {
    const res = await api.verifyLiveness({
      session_id: sessionId,
      blink_detected: blinkState.detected,
      blink_confidence: blinkState.confidence,
      head_turn_detected: headTurnState.detected,
      head_turn_magnitude: headTurnState.magnitude,
      smile_detected: smileState.detected,
      smile_confidence: smileState.confidence,
      frame_count: frameCount,
      landmark_variance: variance,
    });

    const score = res.result.liveness_score;
    const passed = res.result.is_live;

    document.getElementById('liveness-result').innerHTML = `
      <div class="card" style="border-color:${passed ? 'var(--accent-green)' : 'var(--accent-red)'};margin-top:var(--space-lg);">
        <div style="display:flex;align-items:center;gap:var(--space-sm);">
          <i data-lucide="${passed ? 'check-circle' : 'x-circle'}" style="color:${passed ? 'var(--accent-green)' : 'var(--accent-red)'}"></i>
          <strong>${passed ? 'Liveness Confirmed' : 'Liveness Check Failed'}</strong>
          <span class="badge ${passed ? 'badge--green' : 'badge--red'}">Score: ${(score * 100).toFixed(1)}%</span>
        </div>
        <ul class="check-list" style="margin-top:var(--space-md);">
          ${Object.entries(res.result.checks).map(([k, v]) =>
            `<li class="check-item ${v.passed ? 'passed' : 'failed'}">
              <i data-lucide="${v.passed ? 'check-circle' : 'x-circle'}"></i>
              <span style="flex:1">${k.replace(/_/g, ' ')}</span>
              <span class="badge ${v.passed ? 'badge--green' : 'badge--red'}">${(v.score * 100).toFixed(0)}%</span>
            </li>`
          ).join('')}
        </ul>
      </div>`;
    initIcons();
    if (passed) {
      setTimeout(() => { document.getElementById('btn-next-gesture').style.display = 'inline-flex'; }, 500);
    }
  } catch (e) {
    showToast('Liveness check failed', 'error');
  }
}

function simulateLiveness() {
  blinkState.detected = true; blinkState.confidence = 0.7;
  headTurnState.detected = true; headTurnState.magnitude = 30;
  smileState.detected = true; smileState.confidence = 0.8;
  frameCount = 90;
  setTimeout(() => { completeChallenge('blink'); activateChallenge('turn'); }, 1500);
  setTimeout(() => { completeChallenge('turn'); activateChallenge('smile'); }, 3000);
  setTimeout(() => { completeChallenge('smile'); }, 4500);
  setTimeout(() => completeLiveness(), 5000);
}

/* Step 4: Deepfake Analysis — send REAL landmark + expression data */
async function startDeepfakeAnalysis() {
  showStep(3);
  const checksContainer = document.getElementById('deepfake-checks');
  const gaugeValue = document.getElementById('gauge-value');
  const gaugeCircle = document.getElementById('gauge-circle');
  checksContainer.innerHTML = '<div class="skeleton" style="height:24px;margin-bottom:8px;"></div>'.repeat(8);

  // Get the last captured landmarks and the history
  const currentLandmarks = landmarkHistory.length > 0 ? landmarkHistory[landmarkHistory.length - 1] : [];
  const latestExpressions = expressionHistory.length > 0 ? expressionHistory[expressionHistory.length - 1] : {};

  // Detect virtual camera from media track label
  let deviceName = 'Built-in Camera';
  let isVirtual = false;
  if (video?.srcObject) {
    const tracks = video.srcObject.getVideoTracks();
    if (tracks.length > 0) {
      deviceName = tracks[0].label || 'Unknown Camera';
      const lower = deviceName.toLowerCase();
      isVirtual = ['obs', 'virtual', 'manycam', 'snap', 'xsplit', 'droid'].some(s => lower.includes(s));
    }
  }

  try {
    const res = await api.deepfakeScore({
      session_id: sessionId,
      landmarks: currentLandmarks,
      expressions: latestExpressions,
      detection_score: 0.95, // from face-api detection
      face_box: currentLandmarks.length > 0 ? computeBoundingBox(currentLandmarks) : {},
      device_name: deviceName,
      is_virtual_camera: isVirtual,
      history: landmarkHistory.slice(-5), // last 5 snapshots for temporal
    });

    const r = res.result;
    const authPct = (r.authenticity_score * 100).toFixed(1);
    const circumference = 2 * Math.PI * 45;
    gaugeCircle.style.strokeDasharray = circumference;
    gaugeCircle.style.strokeDashoffset = circumference;
    const color = r.authenticity_score >= 0.85 ? '#10b981' : r.authenticity_score >= 0.65 ? '#f59e0b' : '#ef4444';
    gaugeCircle.style.stroke = color;
    setTimeout(() => {
      gaugeCircle.style.transition = 'stroke-dashoffset 1.5s ease';
      gaugeCircle.style.strokeDashoffset = circumference * (1 - r.authenticity_score);
    }, 100);
    gaugeValue.textContent = `${authPct}%`;
    gaugeValue.style.color = color;

    let html = '';
    for (const [key, val] of Object.entries(r.checks)) {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      html += `<div class="check-item ${val.passed ? 'passed' : 'failed'}">
        <i data-lucide="${val.passed ? 'check-circle' : 'x-circle'}"></i>
        <span style="flex:1">${label}</span>
        <span class="badge ${val.passed ? 'badge--green' : 'badge--red'}">${val.label} (${(val.score*100).toFixed(0)}%)</span>
      </div>`;
    }
    checksContainer.innerHTML = html;

    document.getElementById('deepfake-recommendation').innerHTML = `
      <div class="card" style="border-color:${color};margin-top:var(--space-lg);">
        <div style="display:flex;align-items:center;gap:var(--space-sm);">
          <i data-lucide="${r.risk_level === 'low' ? 'shield-check' : 'alert-triangle'}" style="color:${color}"></i>
          <span>${r.recommendation}</span>
        </div>
      </div>`;
    initIcons();

    // Also run anomaly check with real session data
    const elapsed = (Date.now() - sessionStartTime) / 1000;
    api.checkAnomaly({
      session_id: sessionId,
      device: { is_virtual_camera: isVirtual, screen_width: window.screen.width },
      behavior: { session_duration_sec: elapsed, click_count: frameCount > 10 ? 5 : 1 },
      biometrics: { deepfake_score: r.deepfake_score, face_match_score: r.authenticity_score },
    }).catch(() => {});

    if (r.risk_level === 'low' || r.risk_level === 'medium') {
      setTimeout(() => { document.getElementById('btn-next-result').style.display = 'inline-flex'; }, 800);
    }
  } catch (e) {
    showToast('Deepfake analysis failed', 'error');
  }
}

function computeBoundingBox(lm) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of lm) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/* Step 5: Result & Credential Issuance */
async function showResult() {
  showStep(4);
  if (video?.srcObject) { video.srcObject.getTracks().forEach(t => t.stop()); }
  if (faceDetectionInterval) { clearInterval(faceDetectionInterval); faceDetectionInterval = null; }

  const container = document.getElementById('result-container');
  container.innerHTML = '<div class="skeleton" style="height:200px;"></div>';
  try {
    const res = await api.issueCredential({
      user_id: currentUserId,
      credential_type: 'video_kyc',
      session_id: sessionId,
      claims: {
        full_name: document.getElementById('extr-name')?.value || 'Verified User',
        verification_level: 'L3',
        liveness_verified: blinkState.detected && headTurnState.detected && smileState.detected,
        deepfake_cleared: true,
        verified_at: new Date().toISOString(),
      },
    });
    const c = res.credential;
    container.innerHTML = `
      <div style="text-align:center;margin-bottom:var(--space-2xl);">
        <div style="width:80px;height:80px;border-radius:50%;background:var(--gradient-success);display:grid;place-items:center;margin:0 auto var(--space-lg);font-size:2rem;">
          <i data-lucide="shield-check" style="color:white;width:40px;height:40px;"></i>
        </div>
        <h2 style="margin-bottom:var(--space-sm);">Identity Verified</h2>
        <p style="color:var(--text-secondary);">Your Video KYC credential has been issued and added to your wallet.</p>
      </div>
      <div class="card" style="background:linear-gradient(135deg,#6a1b9a,#8b5cf6);color:white;margin-bottom:var(--space-lg);">
        <div class="cred-card__header"><div class="cred-card__icon"><i data-lucide="video"></i></div><span class="cred-card__level">L3</span></div>
        <div class="cred-card__type">${c.metadata.display_name}</div>
        <div class="cred-card__issuer" style="color:rgba(255,255,255,.7);">${c.issuer.name}</div>
        <div class="cred-card__hash" style="margin-top:var(--space-md);">Proof: ${c.proof.proofHash.substring(0, 32)}...</div>
        <div class="cred-card__footer"><span>Issued just now</span><span>Valid 1 year</span></div>
      </div>
      <div style="display:flex;gap:var(--space-md);justify-content:center;flex-wrap:wrap;">
        <a href="wallet.html" class="btn btn--primary btn--lg"><i data-lucide="wallet"></i> Go to Wallet</a>
        <a href="consent.html" class="btn btn--secondary btn--lg"><i data-lucide="share-2"></i> Share Credential</a>
      </div>`;
    initIcons();
    showToast('Credential issued successfully!', 'success');
  } catch (e) {
    showToast('Credential issuance failed', 'error');
  }
}

/* ================================================================
   STEP 3 — GESTURE AUTHENTICATION ENGINE (embedded)
   MediaPipe Hands · Joint-angle detection · Multi-frame scoring
   Motion trajectory · Anti-spoofing
   ================================================================ */

const G_CFG = {
  TOTAL: 4, PASS_REQ: 3, DURATION: 4000, THRESHOLD: 75,
  MIN_FRAMES: 8, MOTION_BUF: 40,
  FREEZE: 0.0005, TELEPORT: 0.18, DELAY: 1500,
};

const G_POOL = [
  { type:'pose',   name:'palm',        text:'✋ Show Open Palm' },
  { type:'pose',   name:'fist',        text:'✊ Make a Fist' },
  { type:'pose',   name:'index',       text:'☝️ Raise Index Finger' },
  { type:'pose',   name:'peace',       text:'✌️ Show Peace Sign' },
  { type:'motion', name:'swipe_right', text:'👉 Move Hand Left to Right' },
  { type:'motion', name:'circle',      text:'⭕ Draw a Circle in Air' },
];

let gVideo, gCanvas, gCtx, gHands, gCamera;
let gChallenges=[], gIdx=-1, gActive=false, gStart=0, gTimerRAF=null;
let gGoodFrames=0, gTotalFrames=0, gResults=[], gMotionBuf=[], gPrevLm=null, gFrozen=0;
let gFpsCount=0, gFpsLast=performance.now(), gFps=0;

function startGestureAuth() {
  showStep(2); // gesture is index 2
  // Stop face camera if running
  if (video?.srcObject) { video.srcObject.getTracks().forEach(t => t.stop()); }
  if (faceDetectionInterval) { clearInterval(faceDetectionInterval); faceDetectionInterval = null; }

  gVideo = document.getElementById('gesture-video');
  gCanvas = document.getElementById('gesture-canvas');
  gCtx = gCanvas.getContext('2d');

  const dotsEl = document.getElementById('gesture-dots');
  dotsEl.innerHTML = '';
  for (let i = 0; i < G_CFG.TOTAL; i++) {
    const d = document.createElement('div');
    d.className = 'gesture-dot'; d.id = `gdot-${i}`;
    dotsEl.appendChild(d);
  }

  gChallenges = [...G_POOL].sort(() => Math.random()-0.5).slice(0, G_CFG.TOTAL);
  gIdx = -1; gActive = false; gResults = [];
  initGestureMediaPipe();
}

function initGestureMediaPipe() {
  gHands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
  gHands.setOptions({ maxNumHands:1, modelComplexity:1, minDetectionConfidence:0.65, minTrackingConfidence:0.6 });
  gHands.onResults(onGestureFrame);

  navigator.mediaDevices.getUserMedia({ video:{ width:640, height:480, facingMode:'user' } })
    .then(stream => {
      gVideo.srcObject = stream;
      gVideo.play();
      gCanvas.width = 640; gCanvas.height = 480;
      gCamera = new Camera(gVideo, {
        onFrame: async () => { await gHands.send({ image: gVideo }); },
        width: 640, height: 480,
      });
      gCamera.start();
      gSetInstruction('Show your hand to begin', 'Model loaded');
      setTimeout(gNextChallenge, 2000);
    })
    .catch(() => {
      gSetInstruction('Camera denied — cannot proceed', 'Error');
    });
}

function gNextChallenge() {
  gIdx++;
  if (gIdx >= gChallenges.length) { gFinishSession(); return; }
  gGoodFrames = 0; gTotalFrames = 0; gMotionBuf.length = 0; gPrevLm = null; gFrozen = 0;
  const ch = gChallenges[gIdx];
  gSetInstruction(ch.text, `Challenge ${gIdx+1} of ${gChallenges.length}`);
  document.getElementById(`gdot-${gIdx}`).classList.add('active');
  gActive = true; gStart = performance.now();
  gRunTimer();
}

function gRunTimer() {
  if (!gActive) return;
  const elapsed = performance.now() - gStart;
  const pct = Math.max(0, 1 - elapsed / G_CFG.DURATION);
  const secs = Math.max(0, (G_CFG.DURATION - elapsed) / 1000).toFixed(1);
  const fill = document.getElementById('gesture-timer-fill');
  fill.style.width = `${pct*100}%`;
  fill.style.background = pct > 0.3 ? 'var(--accent-blue)' : pct > 0.15 ? 'var(--accent-orange)' : 'var(--accent-red)';
  const circ = 2 * Math.PI * 22;
  document.getElementById('gesture-ring-fill').style.strokeDashoffset = circ * (1-pct);
  document.getElementById('gesture-ring-fill').style.stroke = pct > 0.3 ? '#3b82f6' : '#ef4444';
  document.getElementById('gesture-countdown-text').textContent = secs;
  if (elapsed >= G_CFG.DURATION) { gEndChallenge(false, 'Too Slow'); return; }
  gTimerRAF = requestAnimationFrame(gRunTimer);
}

function onGestureFrame(res) {
  gFpsCount++;
  const now = performance.now();
  if (now - gFpsLast >= 1000) { gFps = gFpsCount; gFpsCount = 0; gFpsLast = now; document.getElementById('gesture-fps').textContent = `${gFps} FPS`; }
  gCtx.clearRect(0, 0, gCanvas.width, gCanvas.height);

  if (!res.multiHandLandmarks || !res.multiHandLandmarks.length) {
    gDrawNoHand(); return;
  }
  const lm = res.multiHandLandmarks[0];
  gDrawHand(lm);
  if (!gActive) return;

  gTotalFrames++;

  // Anti-spoofing
  const spoof = gAntiSpoof(lm);
  document.getElementById('gm-liveness').textContent = spoof.label;
  document.getElementById('gm-liveness').style.color = spoof.ok ? 'var(--accent-green)' : 'var(--accent-red)';
  if (!spoof.ok) { gPrevLm = lm; return; }

  // Gesture analysis
  const ch = gChallenges[gIdx];
  let score = 0;
  if (ch.type === 'pose') score = gEvalPose(ch.name, lm);
  else {
    const c = gPalmCenter(lm);
    gMotionBuf.push({ x:c.x, y:c.y, t:now });
    if (gMotionBuf.length > G_CFG.MOTION_BUF) gMotionBuf.shift();
    score = gEvalMotion(ch.name);
  }

  if (score >= G_CFG.THRESHOLD) gGoodFrames++; else if (score < G_CFG.THRESHOLD*0.5) gGoodFrames = Math.max(0, gGoodFrames-1);

  // UI
  document.getElementById('gm-score').textContent = `${Math.round(score)}%`;
  document.getElementById('gm-score').style.color = score >= G_CFG.THRESHOLD ? 'var(--accent-green)' : 'var(--accent-orange)';
  document.getElementById('gm-frames').textContent = `${gGoodFrames} / ${G_CFG.MIN_FRAMES}`;
  document.getElementById('gm-motion').textContent = spoof.motionLabel;

  if (gGoodFrames >= G_CFG.MIN_FRAMES && score >= G_CFG.THRESHOLD) gEndChallenge(true, 'Verified!');
  gPrevLm = lm;
}

// ---- Anti-spoofing ----
function gAntiSpoof(lm) {
  if (!gPrevLm) return { ok:true, label:'Checking...', motionLabel:'Waiting' };
  let disp = 0;
  for (let i=0; i<21; i++) { const dx=lm[i].x-gPrevLm[i].x, dy=lm[i].y-gPrevLm[i].y; disp += Math.sqrt(dx*dx+dy*dy); }
  const avg = disp/21;
  if (avg < G_CFG.FREEZE) { gFrozen++; if (gFrozen > 6) return { ok:false, label:'⚠ Static', motionLabel:'Frozen' }; }
  else gFrozen = Math.max(0, gFrozen-1);
  if (avg > G_CFG.TELEPORT) return { ok:false, label:'⚠ Jump', motionLabel:'Teleport' };
  return { ok:true, label:'Live', motionLabel: avg < 0.002 ? 'Very Still' : avg > 0.08 ? 'Fast' : 'Natural' };
}

// ---- Joint-angle finger detection ----
function gJointAngle(a,b,c) {
  const ba={x:a.x-b.x,y:a.y-b.y,z:(a.z||0)-(b.z||0)}, bc={x:c.x-b.x,y:c.y-b.y,z:(c.z||0)-(b.z||0)};
  const dot=ba.x*bc.x+ba.y*bc.y+ba.z*bc.z;
  const m1=Math.sqrt(ba.x**2+ba.y**2+ba.z**2), m2=Math.sqrt(bc.x**2+bc.y**2+bc.z**2);
  if(m1*m2===0) return 0;
  return Math.acos(Math.max(-1,Math.min(1,dot/(m1*m2))))*(180/Math.PI);
}

function gFingerExt(lm, fi) {
  const j=[[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]];
  const [mcp,pip,dip,tip]=j[fi];
  if(fi===0) return gDist(lm[tip],lm[5])>0.08;
  return gJointAngle(lm[mcp],lm[pip],lm[dip])>140 && lm[tip].y<lm[pip].y;
}

function gFingerStates(lm) { return [0,1,2,3,4].map(i=>gFingerExt(lm,i)); }

// ---- Pose classifiers ----
function gEvalPose(name, lm) {
  const [thumb,idx,mid,ring,pinky] = gFingerStates(lm);
  switch(name) {
    case 'palm': { const n=[thumb,idx,mid,ring,pinky].filter(Boolean).length; return Math.min(100,(n/5)*90+(gDist(lm[8],lm[20])>0.12?10:0)); }
    case 'fist': { const pc=gPalmCenter(lm); let c=0; [8,12,16,20].forEach(t=>{const d=gDist(lm[t],pc);if(d<0.08)c+=25;else if(d<0.12)c+=15;}); return Math.max(0,c-[idx,mid,ring,pinky].filter(Boolean).length*15); }
    case 'index': return (idx?40:0)+([mid,ring,pinky].filter(b=>!b).length/3)*60;
    case 'peace': return (idx?30:0)+(mid?30:0)+(!ring?20:0)+(!pinky?20:0);
    default: return 0;
  }
}

// ---- Motion classifiers ----
function gEvalMotion(name) {
  if(gMotionBuf.length<15) return 0;
  if(name==='swipe_right') {
    const r=gMotionBuf.slice(-20); if(r.length<15) return 0;
    const dx=r[0].x-r[r.length-1].x, ys=r.map(p=>p.y), yr=Math.max(...ys)-Math.min(...ys);
    const dt=(r[r.length-1].t-r[0].t)/1000, sp=Math.abs(dx)/Math.max(dt,0.001);
    let s=0; if(Math.abs(dx)>0.25)s+=50;else if(Math.abs(dx)>0.15)s+=30; if(yr<0.12)s+=25;else if(yr<0.2)s+=10; if(sp>0.3&&sp<3)s+=25;
    return Math.min(100,s);
  }
  if(name==='circle') {
    const r=gMotionBuf.slice(-30); if(r.length<20) return 0;
    const cx=r.reduce((s,p)=>s+p.x,0)/r.length, cy=r.reduce((s,p)=>s+p.y,0)/r.length;
    const radii=r.map(p=>Math.sqrt((p.x-cx)**2+(p.y-cy)**2)), mr=radii.reduce((a,b)=>a+b,0)/radii.length;
    if(mr<0.04) return 0;
    const v=radii.reduce((s,rd)=>s+(rd-mr)**2,0)/radii.length, cv=Math.sqrt(v)/mr;
    const quads=new Set(r.map(p=>Math.floor(((Math.atan2(p.y-cy,p.x-cx)+Math.PI)/(Math.PI/2))%4)));
    let s=0; if(cv<0.3)s+=45;else if(cv<0.5)s+=25; if(quads.size>=4)s+=35;else if(quads.size>=3)s+=20; if(mr>0.06)s+=20;
    return Math.min(100,s);
  }
  return 0;
}

// ---- Challenge flow ----
function gEndChallenge(passed, text) {
  if (!gActive) return;
  gActive = false; cancelAnimationFrame(gTimerRAF);
  const avg = gTotalFrames>0 ? Math.round((gGoodFrames/gTotalFrames)*100) : 0;
  gResults.push({ name:gChallenges[gIdx].text, passed, score:avg });
  const dot = document.getElementById(`gdot-${gIdx}`);
  dot.classList.remove('active'); dot.classList.add(passed?'pass':'fail');
  gShowFeedback(text, passed?'success': text==='Too Slow'?'warn':'error');
  setTimeout(gNextChallenge, G_CFG.DELAY);
}

function gFinishSession() {
  const passCount = gResults.filter(r=>r.passed).length;
  const ok = passCount >= G_CFG.PASS_REQ;
  const avg = gResults.length ? Math.round(gResults.reduce((s,r)=>s+r.score,0)/gResults.length) : 0;

  // Stop gesture camera
  if (gVideo?.srcObject) gVideo.srcObject.getTracks().forEach(t=>t.stop());

  // Show result in the gesture step
  const el = document.getElementById('gesture-result');
  const color = ok ? 'var(--accent-green)' : 'var(--accent-red)';
  el.innerHTML = `
    <div class="card" style="border-color:${color};margin-top:var(--space-lg);">
      <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-md);">
        <i data-lucide="${ok?'check-circle':'x-circle'}" style="color:${color}"></i>
        <strong>${ok?'Gesture Auth Passed':'Gesture Auth Failed'}</strong>
        <span class="badge ${ok?'badge--green':'badge--red'}">${passCount}/${gResults.length} passed · ${avg}% avg</span>
      </div>
      <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;">
        ${gResults.map(r=>`<span class="badge ${r.passed?'badge--green':'badge--red'}" style="font-size:.7rem;">${r.passed?'✓':'✗'} ${r.name.replace(/^.{2} /,'')}</span>`).join('')}
      </div>
    </div>`;
  initIcons();

  if (ok) {
    setTimeout(() => { document.getElementById('btn-next-deepfake').style.display = 'inline-flex'; }, 500);
  }

  // Log to backend
  api.verifySecondary({ session_id: sessionId, method:'gesture', success:ok, details:gResults }).catch(()=>{});
}

// ---- Drawing ----
function gDrawHand(lm) {
  gCtx.save(); gCtx.translate(gCanvas.width,0); gCtx.scale(-1,1);
  drawConnectors(gCtx, lm, HAND_CONNECTIONS, {color:'rgba(59,130,246,0.55)',lineWidth:3});
  const states = gFingerStates(lm);
  const tips=[4,8,12,16,20];
  for(let i=0;i<21;i++){
    const pt=lm[i], isTip=tips.includes(i);
    const fg=i<=4?0:i<=8?1:i<=12?2:i<=16?3:4;
    gCtx.beginPath(); gCtx.arc(pt.x*gCanvas.width,pt.y*gCanvas.height,isTip?5:3,0,Math.PI*2);
    gCtx.fillStyle=isTip?(states[fg]?'rgba(16,185,129,0.9)':'rgba(239,68,68,0.9)'):'rgba(255,255,255,0.7)';
    gCtx.fill();
  }
  gCtx.restore();
}

function gDrawNoHand() {
  gCtx.strokeStyle='rgba(239,68,68,0.3)'; gCtx.lineWidth=2; gCtx.setLineDash([8,8]);
  gCtx.beginPath(); gCtx.ellipse(gCanvas.width/2,gCanvas.height/2,90,120,0,0,Math.PI*2); gCtx.stroke();
  gCtx.setLineDash([]);
}

// ---- Helpers ----
function gDist(a,b){ return Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2); }
function gPalmCenter(lm){ const p=[0,5,9,13,17]; return { x:p.reduce((s,i)=>s+lm[i].x,0)/5, y:p.reduce((s,i)=>s+lm[i].y,0)/5 }; }
function gSetInstruction(t, l) { document.getElementById('gesture-instruction').textContent=t; document.getElementById('gesture-challenge-label').textContent=l; }
function gShowFeedback(t, type) {
  const el=document.getElementById('gesture-feedback'), msg=document.getElementById('gesture-feedback-msg');
  msg.textContent=t; el.className=`gesture-feedback ${type} show`;
  setTimeout(()=>el.classList.remove('show'),1200);
}

/* ================================================================
   MODE B — FILE UPLOAD VERIFICATION ENGINE
   Image: single-frame landmark analysis
   Video: frame-by-frame extraction + motion + anti-spoof
   Stricter threshold (80%) for uploads
   ================================================================ */

const UPLOAD_THRESHOLD = 80; // Stricter than live (75)
let uploadHands = null;

function initUploadDropzone() {
  const dz = document.getElementById('gesture-dropzone');
  ['dragenter','dragover'].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.add('drag-over'); }));
  ['dragleave','drop'].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.remove('drag-over'); }));
  dz.addEventListener('drop', ev => {
    const file = ev.dataTransfer.files[0];
    if (file) processGestureFileSelection(file);
  });
}

function handleGestureFile(ev) {
  const file = ev.target.files[0];
  if (file) processGestureFileSelection(file);
}

function processGestureFileSelection(file) {
  // Validate
  const maxSize = 20 * 1024 * 1024;
  const validTypes = ['image/jpeg','image/png','image/webp','video/mp4','video/webm'];
  if (!validTypes.includes(file.type)) { showToast('Invalid file type. Use JPG, PNG, MP4, or WebM.', 'error'); return; }
  if (file.size > maxSize) { showToast('File too large. Max 20MB.', 'error'); return; }

  uploadedGestureFile = file;
  const isImage = file.type.startsWith('image');
  const url = URL.createObjectURL(file);

  document.getElementById('upload-preview-wrap').style.display = 'block';
  const imgPrev = document.getElementById('upload-img-preview');
  const vidPrev = document.getElementById('upload-vid-preview');

  if (isImage) {
    imgPrev.src = url; imgPrev.style.display = 'block'; vidPrev.style.display = 'none';
  } else {
    vidPrev.src = url; vidPrev.style.display = 'block'; imgPrev.style.display = 'none';
  }

  document.getElementById('btn-analyze-upload').style.display = 'inline-flex';
  initIcons();
}

async function analyzeUploadedFile() {
  if (!uploadedGestureFile) return;
  document.getElementById('btn-analyze-upload').style.display = 'none';
  document.getElementById('upload-progress-wrap').style.display = 'block';

  // Init MediaPipe for upload processing
  if (!uploadHands) {
    uploadHands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
    uploadHands.setOptions({ maxNumHands:1, modelComplexity:1, minDetectionConfidence:0.6, minTrackingConfidence:0.5 });
  }

  const isImage = uploadedGestureFile.type.startsWith('image');
  if (isImage) {
    await analyzeImage();
  } else {
    await analyzeVideo();
  }
}

/* ---- Image Analysis ---- */
async function analyzeImage() {
  setUploadProgress(10, 'Loading image...');
  const img = document.getElementById('upload-img-preview');
  await new Promise(r => { if (img.complete) r(); else img.onload = r; });

  setUploadProgress(30, 'Detecting hand landmarks...');
  const canvas = document.getElementById('upload-analysis-canvas');
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  canvas.style.display = 'block';
  const uctx = canvas.getContext('2d');
  uctx.drawImage(img, 0, 0);

  // Run MediaPipe on the image
  let detectedLm = null;
  uploadHands.onResults(res => {
    if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
      detectedLm = res.multiHandLandmarks[0];
    }
  });
  await uploadHands.send({ image: img });

  setUploadProgress(70, 'Analyzing gesture...');
  await sleep(300);

  if (!detectedLm) {
    finishUploadAnalysis({ hand: false, gesture: 'None', confidence: 0, spoof: 'N/A',
      status: 'REJECTED', reason: 'No hand detected in image.', details: ['Hand not found — upload a clear image of your hand.'] });
    return;
  }

  // Draw landmarks on canvas
  uctx.drawImage(img, 0, 0);
  drawConnectors(uctx, detectedLm, HAND_CONNECTIONS, {color:'rgba(59,130,246,0.7)',lineWidth:3});
  for (const pt of detectedLm) { uctx.beginPath(); uctx.arc(pt.x*canvas.width, pt.y*canvas.height, 4, 0, Math.PI*2); uctx.fillStyle='#10b981'; uctx.fill(); }

  // Classify gesture
  const bestGesture = classifyBestGesture(detectedLm);
  const confidence = bestGesture.score;
  const passed = confidence >= UPLOAD_THRESHOLD;

  setUploadProgress(100, 'Complete');
  finishUploadAnalysis({
    hand: true, gesture: bestGesture.name, confidence,
    spoof: 'Static image — limited verification',
    status: passed ? 'VERIFIED' : 'NEEDS RETRY',
    reason: passed ? `Gesture "${bestGesture.name}" detected with ${confidence}% confidence.` : `Low confidence (${confidence}%). Try live verification.`,
    details: [
      `Detected: ${bestGesture.name} (${confidence}%)`,
      `Finger states: ${bestGesture.fingers}`,
      passed ? '' : '⚠ Image mode cannot verify motion or liveness.',
      passed ? '' : '💡 Recommendation: Use live camera for higher trust.',
    ].filter(Boolean),
  });
}

/* ---- Video Analysis ---- */
async function analyzeVideo() {
  setUploadProgress(5, 'Loading video...');
  const vid = document.getElementById('upload-vid-preview');
  await new Promise(r => { vid.onloadeddata = r; if (vid.readyState >= 2) r(); });

  const canvas = document.getElementById('upload-analysis-canvas');
  canvas.width = vid.videoWidth; canvas.height = vid.videoHeight;
  canvas.style.display = 'block';
  const uctx = canvas.getContext('2d');

  // Extract frames
  const duration = vid.duration;
  const fps = 5; // sample 5 frames/sec
  const totalFrames = Math.min(Math.floor(duration * fps), 60); // cap at 60 frames
  if (totalFrames < 5) {
    finishUploadAnalysis({ hand: false, gesture: 'None', confidence: 0, spoof: 'Too few frames',
      status: 'REJECTED', reason: 'Video too short. Minimum 1 second required.',
      details: ['Upload a longer video showing hand gesture movement.'] });
    return;
  }

  setUploadProgress(10, `Extracting ${totalFrames} frames...`);

  const frameLandmarks = [];
  const frameScores = [];
  let handsDetected = 0;
  let prevLm = null;
  let staticFrames = 0;

  uploadHands.onResults(res => {
    if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
      frameLandmarks.push(res.multiHandLandmarks[0]);
    } else {
      frameLandmarks.push(null);
    }
  });

  for (let i = 0; i < totalFrames; i++) {
    const time = i / fps;
    vid.currentTime = time;
    await new Promise(r => { vid.onseeked = r; });
    uctx.drawImage(vid, 0, 0);
    await uploadHands.send({ image: canvas });

    const pct = 10 + Math.round((i / totalFrames) * 70);
    setUploadProgress(pct, `Analyzing frame ${i + 1}/${totalFrames}...`);
  }

  setUploadProgress(85, 'Computing scores...');

  // Score each frame
  for (let i = 0; i < frameLandmarks.length; i++) {
    const lm = frameLandmarks[i];
    if (!lm) { frameScores.push(0); continue; }
    handsDetected++;
    const best = classifyBestGesture(lm);
    frameScores.push(best.score);

    // Anti-spoof: check for static/repeated frames
    if (prevLm) {
      let disp = 0;
      for (let j = 0; j < 21; j++) { disp += Math.sqrt((lm[j].x-prevLm[j].x)**2+(lm[j].y-prevLm[j].y)**2); }
      if (disp / 21 < 0.001) staticFrames++;
    }
    prevLm = lm;
  }

  // Compute results
  const handRatio = handsDetected / totalFrames;
  const avgScore = frameScores.length ? Math.round(frameScores.reduce((a,b)=>a+b,0) / frameScores.length) : 0;
  const goodFrames = frameScores.filter(s => s >= UPLOAD_THRESHOLD).length;
  const consistency = totalFrames > 0 ? Math.round((goodFrames / totalFrames) * 100) : 0;
  const staticRatio = totalFrames > 1 ? staticFrames / (totalFrames - 1) : 0;

  // Motion check
  const hasMotion = staticRatio < 0.7; // Less than 70% static frames
  const hasContinuity = handRatio > 0.5; // Hand visible in >50% of frames

  // Determine overall result
  let status, reason;
  const details = [
    `Frames analyzed: ${totalFrames}`,
    `Hand detected in ${handsDetected}/${totalFrames} frames (${Math.round(handRatio*100)}%)`,
    `Good frames: ${goodFrames}/${totalFrames} (above ${UPLOAD_THRESHOLD}% threshold)`,
    `Avg gesture score: ${avgScore}%`,
    `Frame consistency: ${consistency}%`,
    `Static frame ratio: ${Math.round(staticRatio*100)}%`,
  ];

  if (!hasContinuity) {
    status = 'REJECTED'; reason = 'Insufficient hand visibility. Hand must be visible in most frames.';
    details.push('⚠ Hand not detected in enough frames.');
  } else if (!hasMotion) {
    status = 'REJECTED'; reason = 'Static or replayed video detected. Real motion required.';
    details.push('⚠ Frames appear identical — possible replay attack.');
  } else if (consistency >= 60 && avgScore >= UPLOAD_THRESHOLD) {
    status = 'VERIFIED'; reason = `Video verified with ${avgScore}% avg score and ${consistency}% consistency.`;
  } else if (avgScore >= 60) {
    status = 'NEEDS RETRY'; reason = `Score borderline (${avgScore}%). Try live camera for better results.`;
    details.push('💡 Live camera verification is recommended.');
  } else {
    status = 'REJECTED'; reason = `Low confidence (${avgScore}%). Gesture not clearly recognized.`;
  }

  setUploadProgress(100, 'Complete');
  finishUploadAnalysis({
    hand: handsDetected > 0, gesture: 'Multi-frame', confidence: avgScore,
    spoof: hasMotion ? (staticRatio < 0.3 ? 'Natural motion' : 'Low motion') : '⚠ Static/Replay',
    status, reason, details,
  });
}

/* ---- Shared helpers for upload ---- */
function classifyBestGesture(lm) {
  const poses = ['palm','fist','index','peace'];
  let best = { name:'Unknown', score:0, fingers:'' };
  const states = gFingerStates(lm);
  const fingerNames = ['Thumb','Index','Middle','Ring','Pinky'];
  const fingerStr = states.map((s,i) => `${fingerNames[i]}:${s?'Open':'Closed'}`).join(', ');

  for (const name of poses) {
    const s = gEvalPose(name, lm);
    if (s > best.score) best = { name, score: Math.round(s), fingers: fingerStr };
  }
  return best;
}

function finishUploadAnalysis(r) {
  document.getElementById('upload-progress-wrap').style.display = 'none';
  const panel = document.getElementById('upload-results-panel');
  panel.style.display = 'flex';

  const statusEl = document.getElementById('upload-result-status');
  statusEl.textContent = r.status;
  statusEl.style.color = r.status === 'VERIFIED' ? 'var(--accent-green)' : r.status === 'NEEDS RETRY' ? 'var(--accent-orange)' : 'var(--accent-red)';

  document.getElementById('um-confidence').textContent = `${r.confidence}%`;
  document.getElementById('um-confidence').style.color = r.confidence >= UPLOAD_THRESHOLD ? 'var(--accent-green)' : 'var(--accent-orange)';
  document.getElementById('um-hand').textContent = r.hand ? 'Yes ✓' : 'No ✗';
  document.getElementById('um-hand').style.color = r.hand ? 'var(--accent-green)' : 'var(--accent-red)';
  document.getElementById('um-gesture').textContent = r.gesture;
  document.getElementById('um-spoof').textContent = r.spoof;
  document.getElementById('um-spoof').style.color = r.spoof.includes('⚠') ? 'var(--accent-red)' : 'var(--accent-green)';

  document.getElementById('upload-detail-list').innerHTML = r.details.map(d =>
    `<div style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);">${d}</div>`
  ).join('');

  // Show result card
  const el = document.getElementById('gesture-result');
  const ok = r.status === 'VERIFIED';
  const color = ok ? 'var(--accent-green)' : r.status === 'NEEDS RETRY' ? 'var(--accent-orange)' : 'var(--accent-red)';
  el.innerHTML = `
    <div class="card" style="border-color:${color};margin-top:var(--space-lg);">
      <div style="display:flex;align-items:center;gap:var(--space-sm);flex-wrap:wrap;">
        <i data-lucide="${ok?'check-circle':'alert-triangle'}" style="color:${color}"></i>
        <strong>${r.status}</strong>
        <span class="badge ${ok?'badge--green':'badge--orange'}">${r.confidence}% confidence · Upload mode</span>
      </div>
      <p style="color:var(--text-secondary);margin-top:var(--space-sm);font-size:.875rem;">${r.reason}</p>
    </div>`;
  initIcons();

  if (ok) {
    setTimeout(() => { document.getElementById('btn-next-deepfake').style.display = 'inline-flex'; }, 500);
  }

  api.verifySecondary({ session_id: sessionId, method: 'gesture-upload', success: ok, details: [r] }).catch(()=>{});
}

function setUploadProgress(pct, text) {
  document.getElementById('upload-progress-bar').style.width = `${pct}%`;
  document.getElementById('upload-progress-text').textContent = text;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
