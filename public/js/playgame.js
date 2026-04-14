const socket = io();

const lobbyId = new URLSearchParams(window.location.search).get("lobbyId");

let playerId = localStorage.getItem("playerId");
if (!playerId) {
  playerId = crypto.randomUUID();
  localStorage.setItem("playerId", playerId);
}

// STATE
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

socket.onAny((event, data) => {
  console.log("EVENT:", event, data);
});

function init() {
  if (!lobbyId || !playerId) {
    document.getElementById('current-item-name').textContent = 'Missing game info.';
    document.getElementById('current-item-sub').textContent = 'Go back to the lobby.';
    return;
  }

  socket.emit("game:rejoin", {
    lobbyId,
    playerId
  });
}

socket.on("game:state", (data) => {
  const raw = data.yourItems || [];

  items = raw.map(item => ({
    name: item.title,
    category: item.category,
    upc: item.upc,
    image: item.image,
    found: false
  }));

  selectedItemIndex = items.findIndex(it => !it.found);
  if (selectedItemIndex === -1) selectedItemIndex = null;

  totalItems = items.length;

  document.getElementById('total-count').textContent = totalItems;
  document.getElementById('list-pill').textContent = `0 / ${totalItems}`;

  if (data.opponent) {
    document.getElementById("opp-name").textContent = data.opponent.username;
    document.getElementById("opp-prog").textContent = `${data.opponent.score} / ${totalItems} found`;
  }

  renderItemList();
  updateProgress();
  highlightActiveItem();
  startCountdown();
});

// ----------------------
// COUNTDOWN + TIMER
// ----------------------
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
        startTimer();
      }, 500);
    }, 800);
  }

  tick();
}

function startTimer() {
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

function resetCountdownState() {
  countdownStarted = false;
  if (countdownTimeout) {
    clearTimeout(countdownTimeout);
    countdownTimeout = null;
  }
}

// ----------------------
// UI RENDERING
// ----------------------
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

    main.appendChild(num);
    main.appendChild(thumbEl);
    main.appendChild(info);

    li.appendChild(main);
    li.appendChild(status);

        li.addEventListener('click', (e) => {
      // If they clicked directly on the thumbnail, let image zoom handle it
      if (e.target.classList.contains('item-thumb')) return;

      selectedItemIndex = i;
      renderItemList();
      showItemInScannerCard(items[i]);
    });

    ul.appendChild(li);
  });
}

function highlightActiveItem() {
  const item = items.find(it => !it.found);
  if (!item) return;

  document.getElementById('current-item-name').textContent = item.name;
  document.getElementById('current-item-sub').textContent = item.category || 'Scan an item';
  document.getElementById('current-item-icon').textContent = '📦';
  // If user manually selected an item and it still exists, keep showing that
  if (
    selectedItemIndex !== null &&
    selectedItemIndex >= 0 &&
    selectedItemIndex < items.length
  ) {
    showItemInScannerCard(items[selectedItemIndex]);
    return;
  }

  // Otherwise default to first unfound item
  const firstUnfoundIndex = items.findIndex(it => !it.found);

  if (firstUnfoundIndex === -1) {
    showItemInScannerCard(null);
    return;
  }

  selectedItemIndex = firstUnfoundIndex;
  showItemInScannerCard(items[firstUnfoundIndex]);
}

function updateProgress() {
  foundCount = items.filter(i => i.found).length;
  const pct = totalItems > 0 ? (foundCount / totalItems) * 100 : 0;

  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('found-count').textContent = foundCount;
  document.getElementById('list-pill').textContent = `${foundCount} / ${totalItems}`;
}

// ----------------------
// SERVER-DRIVEN ITEM MATCHING
// ----------------------
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
    highlightActiveItem();
    showToast(`✅ Found item!`, 'success');
  } else {
    showToast(data.message || '❌ Wrong item', 'error');
    shakeFirstUnfoundRow();
  }
});

socket.on("game:finish", (data) => {
  stopTimer();

  if (data.winnerPlayerId === playerId) {
    document.getElementById('win-time-display').textContent = `⏱ ${formatTime(elapsedSecs)}`;
    document.getElementById('win-overlay').classList.add('visible');
  } else {
    showToast('❌ Opponent won!', 'error');
  }
});

function shakeFirstUnfoundRow() {
  const idx = items.findIndex(it => !it.found);
  if (idx === -1) return;

  const row = document.getElementById(`item-row-${idx}`);
  if (!row) return;

  row.classList.add('shake');
  row.addEventListener('animationend', () => row.classList.remove('shake'), { once: true });
}

// ----------------------
// SCANNER / MANUAL UPC
// ----------------------
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

init();