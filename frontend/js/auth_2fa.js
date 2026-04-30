/**
 * TrustVault — 2FA Authentication Logic
 * Implements Face Liveness (Primary) and Gesture/Voice (Secondary) factors.
 */

let video, canvas, ctx;
let faceDetector, handsDetector;
let sessionId = null;
let currentStep = 'primary';
let challenges = [];
let currentChallengeIdx = 0;
let attempts = 0;
let isA11yEnabled = false;

// State tracking
let blinkCount = 0;
let lastEar = 1.0;
let headBaseline = null;
let smileDetected = false;

const PHRASE = "my identity is verified";

document.addEventListener('DOMContentLoaded', async () => {
    initUI();
    await startAuth();
});

async function startAuth() {
    try {
        const res = await api.initAuth({ user_id: 'user-demo-001' });
        sessionId = res.session_id;
        challenges = res.challenges;
        
        await initCamera();
        await loadModels();
        updateChallengeUI();
        startFaceDetection();
    } catch (e) {
        console.error("Auth init failed", e);
        showStatus("Initialization failed. Please refresh.");
    }
}

async function initCamera() {
    video = document.getElementById('live-video');
    canvas = document.getElementById('live-canvas');
    ctx = canvas.getContext('2d');
    
    const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: 'user' } 
    });
    video.srcObject = stream;
    await video.play();
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
}

async function loadModels() {
    showStatus("Loading AI Models...");
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';
    await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);
    
    // Init MediaPipe Hands
    handsDetector = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    handsDetector.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    handsDetector.onResults(onHandResults);
    
    showStatus("AI Ready");
}

function startFaceDetection() {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
    
    const loop = async () => {
        if (currentStep !== 'primary') return;
        
        const result = await faceapi.detectSingleFace(video, options)
            .withFaceLandmarks(true)
            .withFaceExpressions();
            
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (result) {
            drawFace(result);
            processChallenges(result);
        } else {
            showInstruction("Look at the camera");
        }
        
        requestAnimationFrame(loop);
    };
    loop();
}

function processChallenges(result) {
    const challenge = challenges[currentChallengeIdx];
    if (!challenge) {
        finishPrimary();
        return;
    }

    const landmarks = result.landmarks;
    const expressions = result.expressions;

    if (challenge === 'blink') {
        showInstruction("Blink your eyes twice");
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const ear = (getEAR(leftEye) + getEAR(rightEye)) / 2;
        
        if (lastEar - ear > 0.1) { // closed
            blinkCount++;
            if (blinkCount >= 2) nextChallenge();
        }
        lastEar = ear;
    } 
    else if (challenge === 'turn') {
        showInstruction("Turn your head left or right");
        const noseX = landmarks.getNose()[3].x;
        if (!headBaseline) headBaseline = noseX;
        if (Math.abs(noseX - headBaseline) > 30) nextChallenge();
    }
    else if (challenge === 'smile') {
        showInstruction("Give us a big smile");
        if (expressions.happy > 0.8) nextChallenge();
    }
}

function nextChallenge() {
    const current = challenges[currentChallengeIdx];
    document.getElementById(`challenge-${current}`).classList.add('completed');
    document.getElementById(`challenge-${current}`).classList.remove('active');
    
    currentChallengeIdx++;
    if (currentChallengeIdx < challenges.length) {
        updateChallengeUI();
        speak(`Next: ${challenges[currentChallengeIdx]}`);
    } else {
        finishPrimary();
    }
}

async function finishPrimary() {
    currentStep = 'selection';
    showStatus("Primary Factor Passed");
    speak("Face verification passed. Please choose a second factor.");
    
    await api.verifyFace({ session_id: sessionId, liveness_score: 0.95 });
    
    document.getElementById('step-primary').style.display = 'none';
    document.getElementById('step-selection').style.display = 'block';
}

async function startSecondary(method) {
    currentStep = 'secondary';
    document.getElementById('step-selection').style.display = 'none';
    document.getElementById('step-secondary').style.display = 'block';
    
    if (method === 'gesture') {
        document.getElementById('voice-ui').style.display = 'none';
        showInstruction("Show an OPEN PALM to the camera");
        speak("Gesture mode. Show an open palm.");
        
        const camera = new Camera(video, {
            onFrame: async () => {
                if (currentStep === 'secondary') {
                    await handsDetector.send({ image: video });
                }
            },
            width: 640,
            height: 480
        });
        camera.start();
    } else {
        document.getElementById('voice-ui').style.display = 'flex';
        showInstruction("Say the phrase clearly");
        speak("Voice mode. Say: My identity is verified.");
        startVoiceRecognition();
    }
}

function onHandResults(results) {
    if (currentStep !== 'secondary') return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        drawConnectors(ctx, results.multiHandLandmarks[0], HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 5});
        drawLandmarks(ctx, results.multiHandLandmarks[0], {color: '#FF0000', lineWidth: 2});
        
        const isPalm = checkPalm(results.multiHandLandmarks[0]);
        if (isPalm) {
            verifySecondary('gesture', true);
        }
    }
}

function checkPalm(landmarks) {
    // Basic logic: all fingers extended
    const tips = [8, 12, 16, 20];
    const bases = [6, 10, 14, 18];
    let extended = 0;
    for (let i = 0; i < 4; i++) {
        if (landmarks[tips[i]].y < landmarks[bases[i]].y) extended++;
    }
    return extended === 4;
}

function startVoiceRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
        showStatus("Speech Recognition not supported");
        return;
    }
    
    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        document.getElementById('voice-status').textContent = `Heard: "${transcript}"`;
        if (transcript.includes(PHRASE)) {
            verifySecondary('voice', true);
        } else {
            speak("Try again. Say: My identity is verified.");
        }
    };
    recognition.start();
}

async function verifySecondary(method, success) {
    if (currentStep === 'success') return;
    
    const res = await api.verifySecondary({
        session_id: sessionId,
        method: method,
        success: success
    });
    
    if (res.status === 'authenticated') {
        currentStep = 'success';
        document.getElementById('step-secondary').style.display = 'none';
        document.getElementById('step-success').style.display = 'block';
        speak("Authentication successful. Welcome back.");
    }
}

// Helpers
function getEAR(eye) {
    const v1 = dist(eye[1], eye[5]);
    const v2 = dist(eye[2], eye[4]);
    const h = dist(eye[0], eye[3]);
    return (v1 + v2) / (2 * h);
}

function dist(p1, p2) {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function showInstruction(text) {
    document.getElementById('instruction').textContent = text;
    const sec = document.getElementById('secondary-instruction');
    if (sec) sec.textContent = text;
}

function showStatus(text) {
    document.getElementById('camera-status').textContent = text;
}

function updateChallengeUI() {
    const challenge = challenges[currentChallengeIdx];
    if (challenge) {
        document.getElementById(`challenge-${challenge}`).classList.add('active');
    }
}

function drawFace(result) {
    const landmarks = result.landmarks;
    const positions = landmarks.positions;
    ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
    for (const pt of positions) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

function toggleA11y(enabled) {
    isA11yEnabled = enabled;
    if (enabled) speak("Voice guidance enabled.");
}

function speak(text) {
    if (!isA11yEnabled) return;
    const msg = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(msg);
}

function initUI() {
    // Add voice bars
    const container = document.getElementById('voice-waves');
    for (let i = 0; i < 15; i++) {
        const bar = document.createElement('div');
        bar.className = 'voice-bar';
        bar.style.width = '4px';
        bar.style.height = `${Math.random() * 20 + 10}px`;
        bar.style.background = 'var(--accent-blue)';
        bar.style.borderRadius = '2px';
        container.appendChild(bar);
    }
}
