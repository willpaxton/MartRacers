const lobbyId = window.location.pathname.split('/').filter(segment => segment).at(-1);

// Start socket connection
const socket = io();
window.socket = socket;

let playerId = localStorage.getItem("playerId");
// IF no player ID, they should not have gotten this far... kick em
if (!playerId) {
  window.location.replace("/");
}

// Local Variables
let items = [];
let totalItems = 0;
let foundCount = 0;
let scannerActive = false;
let elapsedSecs = 0;
let timerInterval = null;
let selectedItemIndex = null;
const imgOverlay = document.getElementById('img-overlay');
const imgOverlayPhoto = document.getElementById('img-overlay-photo');
const imgOverlayTitle = document.getElementById('img-overlay-title');
const imgOverlaySub = document.getElementById('img-overlay-sub');
const currentItemNameEl = document.getElementById('current-item-name');
const currentItemSubEl = document.getElementById('current-item-sub');
const currentItemImageEl = document.getElementById('current-item-image');
const currentItemImagePlaceholderEl = document.getElementById('current-item-image-placeholder');

// General debugging of events
socket.onAny((event, data) => {
  console.log("EVENT:", event, data);
});

// Attempt to join/rejoin the lobby.
// lobby:not_connected = they were never here, redirect to index
// game:state = update player page info with current game state (items, opponent info, timer, etc)
socket.emit("lobby:rejoin", {
  lobbyId,
  playerId
});

socket.on("lobby:not_connected", () => {
  window.location.replace("/");
});

// Initial setting up page and starting information.
socket.on("game:state", (data) => {
  const raw = data.yourItems || [];

  items = raw.map(item => ({
    name: item.title,
    category: item.category,
    image: item.image,
    found: false
  }));

  totalItems = items.length;

  document.getElementById('total-count').textContent = totalItems;
  document.getElementById('list-pill').textContent = `0 / ${totalItems}`;

  if (data.opponent) {
    document.getElementById("opp-name").textContent = data.opponent.username;
    document.getElementById("opp-prog").textContent = `${data.opponent.score} / ${totalItems} found`;
  }

  renderItemList();
  updateProgress();

  elapsedSecs = Math.floor((Date.now() - data.startedAt) / 1000);
  startTimer();
  if (data.startedAt > Date.now()) {
    startCountdown();
  } else {
    document.getElementById('countdown-overlay').classList.add('hidden');
  }
});


// ----------------------
// COUNTDOWN + TIMER
// ----------------------
// #region Countdown
let countdownStarted = false;
let countdownTimeout = null;

function startCountdown() {
  // Prevent duplicate countdowns from starting
  if (countdownStarted) return;
  countdownStarted = true;

  const overlay = document.getElementById('countdown-overlay');
  const numEl = document.getElementById('countdown-num');

  let count = 3;

  function tick() {
    if (count > 0) {
      numEl.textContent = String(count);
      numEl.classList.remove('go');
      count--;

      countdownTimeout = setTimeout(tick, 1000);
      return;
    }

    // Show GO
    numEl.textContent = 'GO!';
    numEl.classList.add('go');

    countdownTimeout = setTimeout(() => {
      overlay.classList.add('fade-out');

      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 500);
    }, 800);
  }

  tick();
}

function startTimer() {
  elapsedSecs++;
  document.getElementById('elapsed').textContent = formatTime(elapsedSecs);
  timerInterval = setInterval(() => {
    elapsedSecs++;
    document.getElementById('elapsed').textContent = formatTime(elapsedSecs);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
// #endregion


// ----------------------
// UI RENDERING
// ----------------------
// #region Rendering
function renderItemList() {
  const ul = document.getElementById('item-list');
  ul.innerHTML = '';

  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.id = `item-row-${i}`;
    li.className = 'item-row' + (item.found ? ' found' : '');

    li.innerHTML = `
      <div class="item-num">${i + 1}</div>
      <div class="item-info">
        <div class="item-name">${item.name}</div>
        <div class="item-hint">${item.category || ''}</div>
      </div>
      <div class="item-status">${item.found ? '✅' : ''}</div>
    `;

    // Right-side found checkmark
    const status = document.createElement('div');
    status.className = 'item-status';
    status.textContent = item.found ? '✅' : '';

    ul.appendChild(li);
  });
}

function updateProgress() {
  foundCount = items.filter(i => i.found).length;
  const pct = totalItems > 0 ? (foundCount / totalItems) * 100 : 0;

  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('found-count').textContent = foundCount;
  document.getElementById('list-pill').textContent = `${foundCount} / ${totalItems}`;
}

// Animated shake for if the scanned item was incorrect.
function shakeFirstUnfoundRow() {
  const idx = items.findIndex(it => !it.found);
  if (idx === -1) return;

  const row = document.getElementById(`item-row-${idx}`);
  if (!row) return;

  row.classList.add('shake');
  row.addEventListener('animationend', () => row.classList.remove('shake'), { once: true });
}
// #endregion


// ----------------------
// SERVER-DRIVEN ITEM MATCHING
// ----------------------
// #region Socket Events
socket.on("game:scanResult", (data) => {
  if (data.correct) {
    if (data.matchedTitle) {
      const matchedIndex = items.findIndex(it => it.name === data.matchedTitle && !it.found);
      if (matchedIndex !== -1) {
        items[matchedIndex].found = true;

        // If the selected item was just found, move selection to next unfound item
        if (selectedItemIndex === matchedIndex) {
          const nextUnfound = items.findIndex(it => !it.found);
          selectedItemIndex = nextUnfound !== -1 ? nextUnfound : null;
        }
      }
    }

    updateProgress();
    renderItemList();
    // highlightActiveItem();
    showToast(`✅ Found item!`, 'success');
  } else {
    showToast(data.message || '❌ Wrong item', 'error');
    shakeFirstUnfoundRow();
  }
});
// Changed the game over data// 
socket.on("game:finish", (data) => {
  stopTimer();
  stopScanner();

  if (data.winnerPlayerId === playerId) {
    document.getElementById('win-time-display').textContent = `⏱ ${formatTime(elapsedSecs)}`;
    document.getElementById('win-overlay').classList.add('visible');
  } else {
    document.getElementById('win-emoji').textContent = '😔';
    document.getElementById('win-title').textContent = 'YOU LOST';
    document.getElementById('win-sub').textContent   = 'Your opponent found everything first.';
    document.getElementById('win-overlay').classList.add('visible');
  }
});
// #endregion


// ----------------------
// SCANNER / MANUAL UPC
// ----------------------
// #region Scanner
function startScanner() {
  const viewport = document.getElementById('scanner-viewport');
  viewport.classList.add('active');
  document.getElementById('start-scanner').disabled = true;
  document.getElementById('stop-scanner').disabled = false;
  document.getElementById('scanner-status-pill').textContent = 'Scanning…';
  scannerActive = true;

  Quagga.init({
    inputStream: {
      name: 'Live',
      type: 'LiveStream',
      target: viewport,
      constraints: { facingMode: 'environment' }
    },
    decoder: {
      readers: [
        'upc_reader',
        'upc_e_reader',
        'ean_reader',
        'ean_8_reader',
        'code_128_reader'
      ]
    },
    locate: true
  }, err => {
    if (err) {
      setScanStatus('Camera error: ' + err.message, 'error');
      resetScannerUI();
      return;
    }
    Quagga.start();
    setScanStatus('Scanning… point camera at a barcode', '');
  });

  let lastCode = null;
  let lastTime = 0;

  Quagga.onDetected(result => {
    const code = result.codeResult.code;
    const now = Date.now();
    if (code === lastCode && now - lastTime < 2000) return;
    lastCode = code;
    lastTime = now;

    setScanStatus(`Scanned: ${code}`, 'success');

    socket.emit("game:scanUpc", {
      lobbyId,
      playerId,
      upc: code
    });
  });
}

function stopScanner() {
  if (!scannerActive) return;
  Quagga.stop();
  scannerActive = false;
  resetScannerUI();
  setScanStatus('Scanner stopped', '');
}

function resetScannerUI() {
  document.getElementById('scanner-viewport').classList.remove('active');
  document.getElementById('start-scanner').disabled = false;
  document.getElementById('stop-scanner').disabled = true;
  document.getElementById('scanner-status-pill').textContent = 'Ready';
}

function setScanStatus(msg, type) {
  const el = document.getElementById('scan-status');
  el.textContent = msg;
  el.className = type;
}

document.getElementById('toggle-manual').addEventListener('click', () => {
  const sec = document.getElementById('manual-section');
  const visible = sec.classList.toggle('visible');
  document.getElementById('toggle-manual').textContent = visible
    ? '✖ Hide Manual Entry'
    : '✏️ Enter UPC Manually';
});

document.getElementById('submit-upc').addEventListener('click', () => {
  const val = document.getElementById('manual-upc').value.trim();
  if (!val) return;

  socket.emit("game:scanUpc", {
    lobbyId,
    playerId,
    upc: val
  });

  document.getElementById('manual-upc').value = '';
});

document.getElementById('manual-upc').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('submit-upc').click();
});

document.getElementById('start-scanner').addEventListener('click', startScanner);
document.getElementById('stop-scanner').addEventListener('click', stopScanner);

let toastTimeout;

function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    el.className = '';
  }, 2400);
}
// #endregion
