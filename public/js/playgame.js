

// STATE
let items         = [];
let totalItems    = 0;
let foundCount    = 0;
let scannerActive = false;
let elapsedSecs   = 0;
let timerInterval = null;

function init() {
  // Pull item list from sessionStorage (set by create-game.js)
  const stored = sessionStorage.getItem('gameItems');

  if (!stored) {
    document.getElementById('current-item-name').textContent = 'No items loaded.';
    document.getElementById('current-item-sub').textContent  = 'Go back and generate a game first.';
    console.error('playgame.js: no gameItems found in sessionStorage.');
    return;
  }

  const raw = JSON.parse(stored);

  items      = raw.map(item => ({ ...item, found: false }));
  totalItems = items.length;

  document.getElementById('total-count').textContent = totalItems;
  document.getElementById('list-pill').textContent   = `0 / ${totalItems}`;

  renderItemList();
  updateProgress();
  highlightActiveItem();
}

// 
//  COUNTDOWN  3… 2… 1… GO! This is the timer!
// 
function startCountdown() {
  const overlay = document.getElementById('countdown-overlay');
  const numEl   = document.getElementById('countdown-num');
  let count = 3;

  const tick = () => {
    if (count > 0) {
      numEl.textContent = count;
      numEl.classList.remove('go');
      count--;
      setTimeout(tick, 1000);
    } else {
      numEl.textContent = 'GO!';
      numEl.classList.add('go');
      setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.classList.add('hidden'), 500);
        startTimer();
      }, 800);
    }
  };

  tick();
}

// 
//  this is for the Timer!!!
// 
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

 
function renderItemList() {
  const ul        = document.getElementById('item-list');
  const activeIdx = getNextIndex();
  ul.innerHTML    = '';

  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.id    = `item-row-${i}`;
    li.className = 'item-row' +
      (item.found                      ? ' found'  : '') +
      (!item.found && i === activeIdx  ? ' active' : '');

    li.innerHTML = `
      <div class="item-num">${i + 1}</div>
      <div class="item-info">
        <div class="item-name">${item.emoji ? item.emoji + ' ' : ''}${item.name}</div>
        <div class="item-hint">${item.category || ''}</div>
      </div>
      <div class="item-status">${item.found ? '✅' : ''}</div>
    `;
    ul.appendChild(li);
  });
}


function getNextIndex() {
  return items.findIndex(it => !it.found);
}


function highlightActiveItem() {
  const idx = getNextIndex();
  if (idx === -1) return;
  const item = items[idx];
  document.getElementById('current-item-name').textContent = `${item.emoji || '📦'} ${item.name}`;
  document.getElementById('current-item-sub').textContent  = item.category || 'Scan the barcode';
  document.getElementById('current-item-icon').textContent = item.emoji || '📦';
}


function updateProgress() {
  foundCount = items.filter(i => i.found).length;
  const pct  = totalItems > 0 ? (foundCount / totalItems) * 100 : 0;

  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('found-count').textContent   = foundCount;
  document.getElementById('list-pill').textContent     = `${foundCount} / ${totalItems}`;
}

// 
//  MARK ITEM FOUND
// 
function markFound(upc) {
  const scannedIdx = items.findIndex(it => it.upc === upc && !it.found);
  const activeIdx  = getNextIndex();

  // UPC not on the list at all
  if (scannedIdx === -1) {
    showToast('❌ Item not on your list!', 'error');
    shakeActiveRow();
    return;
  }

  
  if (scannedIdx !== activeIdx) {
    showToast('⚠️ Scan items in order!', 'error');
    shakeActiveRow();
    return;
  }

  // Correct scan!
  items[scannedIdx].found = true;
  updateProgress();
  renderItemList();
  highlightActiveItem();
  showToast(`✅ Found: ${items[scannedIdx].name}`, 'success');

  if (foundCount === totalItems) {
    setTimeout(triggerWin, 600);
  }
}

function shakeActiveRow() {
  const idx = getNextIndex();
  if (idx === -1) return;
  const row = document.getElementById(`item-row-${idx}`);
  if (!row) return;
  row.classList.add('shake');
  row.addEventListener('animationend', () => row.classList.remove('shake'), { once: true });
}

// 
//  WIN SCREEN
// 
function triggerWin() {
  stopTimer();
  stopScanner();
  document.getElementById('win-time-display').textContent = `⏱ ${formatTime(elapsedSecs)}`;
  document.getElementById('win-overlay').classList.add('visible');
}

// 
//   BARCODE SCANNER
// 
function startScanner() {
  const viewport = document.getElementById('scanner-viewport');
  viewport.classList.add('active');
  document.getElementById('start-scanner').disabled = true;
  document.getElementById('stop-scanner').disabled  = false;
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
    const now  = Date.now();
    if (code === lastCode && now - lastTime < 2000) return;
    lastCode = code;
    lastTime = now;

    setScanStatus(`Scanned: ${code}`, 'success');
    markFound(code);
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
  document.getElementById('stop-scanner').disabled  = true;
  document.getElementById('scanner-status-pill').textContent = 'Ready';
}

function setScanStatus(msg, type) {
  const el       = document.getElementById('scan-status');
  el.textContent = msg;
  el.className   = type;
}


document.getElementById('toggle-manual').addEventListener('click', () => {
  const sec     = document.getElementById('manual-section');
  const visible = sec.classList.toggle('visible');
  document.getElementById('toggle-manual').textContent = visible
    ? '✖ Hide Manual Entry'
    : '✏️ Enter UPC Manually';
});

document.getElementById('submit-upc').addEventListener('click', () => {
  const val = document.getElementById('manual-upc').value.trim();
  if (!val) return;
  markFound(val);
  document.getElementById('manual-upc').value = '';
});

document.getElementById('manual-upc').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('submit-upc').click();
});


document.getElementById('start-scanner').addEventListener('click', startScanner);
document.getElementById('stop-scanner').addEventListener('click', stopScanner);


let toastTimeout;

function showToast(msg, type = '') {
  const el       = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `show ${type}`;
  clearTimeout(toastTimeout);
  toastTimeout   = setTimeout(() => { el.className = ''; }, 2400);
}


init();
startCountdown();