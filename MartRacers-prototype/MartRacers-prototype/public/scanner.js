// public/scanner.js
// Camera barcode scanner (ZXing) that integrates with your Socket.io game.
// Behavior:
// - Start Scan -> opens camera + starts decode loop
// - On first successful decode -> LOCKS, stops camera, emits UPC to server
// - User can press Start Scan again to scan again (wrong UPC or next item)

import { BrowserMultiFormatReader } from "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm";

// Elements are created in test.html gameView
const videoEl = document.getElementById("scannerVideo");
const resultEl = document.getElementById("scanResult");
const statusEl = document.getElementById("scanStatus");
const startBtn = document.getElementById("startScanBtn");
const stopBtn = document.getElementById("stopScanBtn");

let stream = null;   // MediaStream from getUserMedia
let reader = null;   // ZXing reader instance

// Locking/throttling to prevent duplicate scans spamming server
let isLocked = false;   // once true, ignore additional decodes until next Start
let lastSentAt = 0;     // last time we emitted to server (extra safety)

// Convert raw scanned text into a clean UPC-A string
function normalizeToUPCA(raw) {
  const digits = String(raw).replace(/\D/g, "");

  // UPC-A = 12 digits
  if (digits.length === 12) return digits;

  // Sometimes scanners return EAN-13 with a leading 0 for UPC-A
  if (digits.length === 13 && digits.startsWith("0")) return digits.slice(1);

  // Fallback: return digits as-is (helps debugging odd formats)
  return digits;
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("getUserMedia not supported in this browser");
  }

  // Request higher resolution to help decoding accuracy
  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "environment",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });

  videoEl.srcObject = stream;
  videoEl.setAttribute("playsinline", "true");
  await videoEl.play();
}

function stopCamera() {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
  stream = null;
  videoEl.srcObject = null;
}

function stopScanner() {
  if (!reader) return;

  // Different builds expose different stop methods
  try {
    if (typeof reader.stopContinuousDecode === "function") {
      reader.stopContinuousDecode();
    }
  } catch (e) {
    console.warn("[scanner] stopContinuousDecode error:", e);
  }

  try {
    if (typeof reader.reset === "function") {
      reader.reset();
    }
  } catch {
    // ignore
  }

  reader = null;
}

async function startScanner() {
  if (!videoEl) throw new Error("Video element not found");
  if (!stream) throw new Error("Camera stream not started");

  statusEl.textContent = "Scanner started. Point it at a barcode…";

  // 250ms = decode interval; lower = faster but can be noisier
  reader = new BrowserMultiFormatReader(undefined, 250);

  // Local duplicate guard (barcode still in view)
  let last = null;
  let lastAt = 0;

  // decodeFromStream continuously scans frames and calls back when it finds something
  await reader.decodeFromStream(stream, videoEl, (result) => {
    // While scanning, errors are normal; result is what we care about
    if (!result) return;

    // If we already got one scan this session, ignore everything else
    if (isLocked) return;

    const raw = result.getText();
    const upc = normalizeToUPCA(raw);
    if (!upc) return;

    const now = Date.now();

    // Guard against the exact same UPC being detected repeatedly while still on camera
    if (upc === last && now - lastAt < 1500) return;
    last = upc;
    lastAt = now;

    // Extra hard throttle (just in case)
    if (now - lastSentAt < 1000) return;
    lastSentAt = now;

    // LOCK: From this point, we only send once until the user hits Start again
    isLocked = true;

    resultEl.textContent = `UPC: ${upc}`;
    statusEl.textContent = "✅ Scanned! Sending to server…";

    // Stop scanning + camera so it feels like a real app
    stopScanner();
    stopCamera();

    // Integration: lobbyId + socket live on window from test.html
    const lobbyId = window.currentLobbyId;
    if (!lobbyId) {
      statusEl.textContent = "⚠️ Not in a lobby yet.";
      return;
    }

    if (!window.socket) {
      statusEl.textContent = "⚠️ Socket not available.";
      return;
    }

    // Send UPC to server for validation (T/F)
    window.socket.emit("game:scanUpc", { lobbyId, upc });
  });
}

async function startAll() {
  try {
    // Reset lock + throttle for a fresh scan session
    isLocked = false;
    lastSentAt = 0;

    startBtn.disabled = true;
    stopBtn.disabled = true;
    statusEl.textContent = "Starting camera…";
    resultEl.textContent = "UPC: (none yet)";

    await startCamera();
    await startScanner();

    // Once camera is live and scanner is running, enable Stop
    stopBtn.disabled = false;
  } catch (e) {
    console.error(e);
    statusEl.textContent =
      "Failed to start scanner. Allow camera permission. (Mobile usually requires HTTPS.)";
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

function stopAll() {
  // Stop everything and unlock for next scan
  stopScanner();
  stopCamera();

  isLocked = false;
  lastSentAt = 0;

  statusEl.textContent = "Stopped.";
  startBtn.disabled = false;
  stopBtn.disabled = true;
}

// Button hooks
startBtn?.addEventListener("click", startAll);
stopBtn?.addEventListener("click", stopAll);