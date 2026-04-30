/**
 * archipelago.js
 *
 * Flow:
 *  1. Player fills in AP server, slot name, password → Connect
 *  2. WebSocket opens → we send Connect packet
 *  3. AP responds with Connected (slot_data, checked_locations) + DataPackage
 *  4. We fetch /archipelago/locations from our own server to get barcode→location mapping
 *  5. We build the visible list: locations whose realm is unlocked AND not yet checked
 *  6. Player scans a barcode → LocationChecks sent to AP server
 *  7. AP sends ReceivedItems → new realms unlock, list auto-updates with banner notification
 */

// ─────────────────────────────────────────────
//  REALM DEFINITIONS  (must match APWorld)
// ─────────────────────────────────────────────

const REALM_NAMES = [
  "Realm of the Harvest Table",
  "Realm of the Garden",
  "Realm of the Loyal Hounds",
  "Realm of the Tiny Adventurers",
  "Realm of the Tiny Healers",
  "Realm of the Celebrants",
  "Realm of the Hearth",
  "Realm of the Curious Critters",
  "Realm of the Brews",
  "Realm of the Builders",
  "Realm of the Wellness Wizards",
  "Realm of the Groomed Ones",
  "Realm of Endless Play",
  "Realm of the Sweet Tooth",
  "Realm of the Fashioned Ones",
  "Realm of the Baked Goods",
  "Realm of the Sparking Circuits",
  "Realm of the Creative Spirits",
  "Realm of the Mighty Athletes",
  "Realm of the Forgotten Finds",
  "Realm of the Watchful Eye",
  "Realm of the Wanderers",
];

const SECRET_REALM = "Realm of the Grand Register";

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────

let apSocket        = null;
let apSlotName      = "";
let itemIdToName    = {};           // AP item id → item name
let allLocations    = {};           // AP location id → { id, name, barcode, realm }
let barcodeToLocId  = {};           // barcode string → AP location id
let checkedLocations = new Set();   // location ids already checked
let unlockedRealms   = new Set();   // realm names currently accessible
let locationsLoaded  = false;       // true once /archipelago/locations has been fetched
let dataPackageReady = false;       // true once itemIdToName is populated from DataPackage
let pendingItems     = [];          // ReceivedItems packets queued before DataPackage arrives
let scannerActive    = false;
let searchQuery      = "";
let toastTimeout;
let bannerTimeout;

// ─────────────────────────────────────────────
//  DOM
// ─────────────────────────────────────────────

const connectOverlay   = document.getElementById("connect-overlay");
const connectError     = document.getElementById("connect-error");
const apConnectBtn     = document.getElementById("ap-connect-btn");
const disconnectBtn    = document.getElementById("disconnect-btn");
const apPip            = document.getElementById("ap-pip");
const apSlotDisplay    = document.getElementById("ap-slot-display");
const apGameDisplay    = document.getElementById("ap-game-display");
const itemListEl       = document.getElementById("item-list");
const listPill         = document.getElementById("list-pill");
const foundCountEl     = document.getElementById("found-count");
const totalCountEl     = document.getElementById("total-count");
const progressFill     = document.getElementById("progress-fill");
const itemSearch       = document.getElementById("item-search");
const scanLog          = document.getElementById("scan-log");
const toastEl          = document.getElementById("toast");
const realmBanner      = document.getElementById("realm-banner");
const realmBannerText  = document.getElementById("realm-banner-text");
const realmBannerClose = document.getElementById("realm-banner-close");
const imgOverlay       = document.getElementById("img-overlay");

// ─────────────────────────────────────────────
//  ARCHIPELAGO WEBSOCKET
// ─────────────────────────────────────────────

function connectToAP() {
  const serverUrl = document.getElementById("ap-server").value.trim() || "ws://localhost:38281";
  const slotName  = document.getElementById("ap-slot").value.trim();
  const password  = document.getElementById("ap-password").value.trim();

  if (!slotName) {
    connectError.textContent = "Please enter your slot name.";
    return;
  }

  connectError.textContent = "Connecting…";
  apConnectBtn.disabled = true;

  const url = /^wss?:\/\//.test(serverUrl) ? serverUrl : "ws://" + serverUrl;
  apSocket = new WebSocket(url);

  apSocket.onopen = () => {
    apSocket.send(JSON.stringify([{
      cmd:            "Connect",
      game:           "MarTracers",
      name:           slotName,
      password:       password || "",
      uuid:           crypto.randomUUID(),
      version:        { major: 0, minor: 5, build: 0, class: "Version" },
      items_handling: 0b111,
      tags:           ["AP"],
      slot_data:      true,
    }]));
  };

  apSocket.onmessage = (evt) => {
    let packets;
    try { packets = JSON.parse(evt.data); } catch { return; }
    for (const pkt of packets) handlePacket(pkt);
  };

  apSocket.onerror = () => {
    connectError.textContent = "Connection failed — check the server URL and try again.";
    apConnectBtn.disabled = false;
    setConnected(false);
  };

  apSocket.onclose = () => {
    setConnected(false);
    apConnectBtn.disabled = false;
    if (!connectOverlay.classList.contains("hidden")) return;
    showToast("Disconnected from Archipelago", "error");
    connectOverlay.classList.remove("hidden");
  };
}

// ─────────────────────────────────────────────
//  PACKET HANDLER
// ─────────────────────────────────────────────

function handlePacket(pkt) {
  switch (pkt.cmd) {

    case "Connected": {
      apSlotName = document.getElementById("ap-slot").value.trim();

      // Locations already checked before we joined
      checkedLocations = new Set(pkt.checked_locations || []);

      setConnected(true);
      connectOverlay.classList.add("hidden");
      connectError.textContent  = "";
      apSlotDisplay.textContent = apSlotName;
      apGameDisplay.textContent = "MartRacers · Connected";

      // Ask for the item/location name↔id table first, THEN sync.
      // DataPackage handler will drain any queued ReceivedItems once names are ready.
      apSocket.send(JSON.stringify([{ cmd: "GetDataPackage", games: ["MarTracers"] }]));
      apSocket.send(JSON.stringify([{ cmd: "Sync" }]));
      break;
    }

    case "DataPackage": {
      const gameData = pkt.data && pkt.data.games && pkt.data.games.MarTracers;
      if (!gameData) break;
      for (const [name, id] of Object.entries(gameData.item_name_to_id || {})) {
        itemIdToName[id] = name;
      }
      dataPackageReady = true;

      // Replay any ReceivedItems that arrived before the name table was ready
      if (pendingItems.length > 0) {
        console.log(`[AP] Replaying ${pendingItems.length} queued ReceivedItems packets`);
        for (const queued of pendingItems) handlePacket(queued);
        pendingItems = [];
      }

      fetchLocationData(gameData.location_name_to_id || {});
      break;
    }

    case "ReceivedItems": {
      // If we don't have item names yet, queue this packet for later
      if (!dataPackageReady) {
        pendingItems.push(pkt);
        break;
      }

      const newRealms = [];
      for (const item of (pkt.items || [])) {
        const name = itemIdToName[item.item];
        if (!name) continue;
        if ((REALM_NAMES.includes(name) || name === SECRET_REALM) && !unlockedRealms.has(name)) {
          unlockedRealms.add(name);
          newRealms.push(name);
        }
      }
      // Show banner only for new unlocks after initial load
      if (newRealms.length > 0 && locationsLoaded) {
        showRealmBanner(newRealms);
      }
      // Re-render if locations are ready; otherwise fetchLocationData() will render when done
      if (locationsLoaded) {
        renderItemList();
        updateProgress();
      }
      break;
    }

    case "ConnectionRefused":
      connectError.textContent = "Refused: " + (pkt.errors || []).join(", ");
      apConnectBtn.disabled = false;
      apSocket.close();
      break;

    default:
      break;
  }
}

// ─────────────────────────────────────────────
//  FETCH LOCATION DATA FROM EXPRESS SERVER
// ─────────────────────────────────────────────

async function fetchLocationData(locNameToId) {
  try {
    const resp = await fetch("/archipelago/locations");
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const rows = await resp.json(); // [{ name, barcode, realm }, ...]

    allLocations   = {};
    barcodeToLocId = {};

    for (const row of rows) {
      const id = locNameToId[row.name];
      if (id === undefined) continue;
      allLocations[id]                           = { id, name: row.name, barcode: row.barcode, realm: row.realm };
      barcodeToLocId[String(row.barcode).trim()] = id;
    }

    locationsLoaded = true;
    renderItemList();
    updateProgress();
  } catch (err) {
    console.error("[AP] Failed to load location data:", err);
    showToast("Failed to load item data from server", "error");
  }
}

// ─────────────────────────────────────────────
//  SCAN HANDLING
// ─────────────────────────────────────────────

function handleScan(upc) {
  const clean = String(upc).trim();
  const locId = barcodeToLocId[clean];

  if (locId === undefined) {
    addScanLog("No match for " + clean, "err", clean);
    showToast("❌ No item matched that barcode", "error");
    shakeFirstRow();
    return;
  }

  const loc = allLocations[locId];

  if (checkedLocations.has(locId)) {
    addScanLog("Already scanned: " + loc.name, "err", clean);
    showToast("Already scanned that item!", "error");
    return;
  }

  if (!unlockedRealms.has(loc.realm)) {
    addScanLog(loc.name + " — realm locked", "err", clean);
    showToast("🔒 " + loc.realm + " is not unlocked yet", "error");
    return;
  }

  // Good — send check to AP
  apSocket.send(JSON.stringify([{ cmd: "LocationChecks", locations: [locId] }]));
  checkedLocations.add(locId);

  addScanLog("✅ " + loc.name, "ok", clean);
  showToast("✅ Scanned: " + loc.name, "success");

  // Item disappears from list immediately
  renderItemList();
  updateProgress();
}

// ─────────────────────────────────────────────
//  RENDER ITEM LIST
//  Shows only: unlocked realm + not yet checked + matches search
// ─────────────────────────────────────────────

function renderItemList() {
  itemListEl.innerHTML = "";

  const visible = Object.values(allLocations).filter(loc =>
    unlockedRealms.has(loc.realm) &&
    !checkedLocations.has(loc.id) &&
    (!searchQuery || loc.name.toLowerCase().includes(searchQuery))
  );

  if (visible.length === 0) {
    const li = document.createElement("li");
    li.className = "players-empty";
    li.innerHTML = locationsLoaded ? "<span>🏆</span>No items remaining in your unlocked realms!" : "<span>⏳</span>Loading items…";
    itemListEl.appendChild(li);
    return;
  }

  // Group by realm
  const byRealm = {};
  for (const loc of visible) {
    if (!byRealm[loc.realm]) byRealm[loc.realm] = [];
    byRealm[loc.realm].push(loc);
  }

  function makeScanHandler(barcode) {
    return function(e) { e.stopPropagation(); handleScan(barcode); };
  }
  function makeDetailHandler(locObj) {
    return function() { showItemDetail(locObj); };
  }

  for (const [realm, locs] of Object.entries(byRealm)) {
    const header = document.createElement("li");
    header.className = "realm-header";
    header.textContent = realm;
    itemListEl.appendChild(header);

    for (const loc of locs) {
      const li = document.createElement("li");
      li.className = "item-row";
      li.innerHTML = `
        <div class="item-main">
          <div class="item-num">·</div>
          <div class="item-info">
            <div class="item-name">${escHtml(loc.name)}</div>
          </div>
        </div>
        <button class="item-send-btn" data-upc="${escHtml(loc.barcode)}">Scan ▶</button>
      `;
      li.querySelector(".item-send-btn").addEventListener("click", makeScanHandler(loc.barcode));
      li.addEventListener("click", makeDetailHandler(loc));
      itemListEl.appendChild(li);
    }
  }
}

// ─────────────────────────────────────────────
//  PROGRESS BAR
//  Counts only locations within currently unlocked realms
// ─────────────────────────────────────────────

function updateProgress() {
  const inUnlocked = Object.values(allLocations).filter(l => unlockedRealms.has(l.realm));
  const total      = inUnlocked.length;
  const done       = inUnlocked.filter(l => checkedLocations.has(l.id)).length;
  const pct        = total > 0 ? (done / total) * 100 : 0;

  progressFill.style.width = pct + "%";
  foundCountEl.textContent = done;
  totalCountEl.textContent = total;
  listPill.textContent     = `${total - done} remaining`;
}

// ─────────────────────────────────────────────
//  REALM UNLOCK BANNER
// ─────────────────────────────────────────────

function showRealmBanner(newRealms) {
  realmBannerText.textContent = "🗺 New realm unlocked: " + newRealms.join(" & ");
  realmBanner.classList.add("visible");
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => realmBanner.classList.remove("visible"), 6000);
}

realmBannerClose.addEventListener("click", () => realmBanner.classList.remove("visible"));

// ─────────────────────────────────────────────
//  SCAN LOG
// ─────────────────────────────────────────────

function addScanLog(message, type, upc) {
  const li = document.createElement("li");
  li.className = "scan-log-entry " + type;
  li.innerHTML = `<span>${escHtml(message)}</span><span class="scan-log-upc">${escHtml(upc)}</span>`;
  scanLog.prepend(li);
  while (scanLog.children.length > 20) scanLog.removeChild(scanLog.lastChild);
}

// ─────────────────────────────────────────────
//  CAMERA SCANNER (Quagga)
// ─────────────────────────────────────────────

function startScanner() {
  const viewport = document.getElementById("scanner-viewport");
  viewport.classList.add("active");
  document.getElementById("start-scanner").disabled = true;
  document.getElementById("stop-scanner").disabled  = false;
  document.getElementById("scanner-status-pill").textContent = "Scanning…";
  scannerActive = true;

  Quagga.init({
    inputStream: {
      name: "Live", type: "LiveStream",
      target: viewport,
      constraints: { facingMode: "environment" }
    },
    decoder: { readers: ["upc_reader","upc_e_reader","ean_reader","ean_8_reader","code_128_reader"] },
    locate: true
  }, err => {
    if (err) { setScanStatus("Camera error: " + err.message, "error"); resetScannerUI(); return; }
    Quagga.start();
    setScanStatus("Scanning… point camera at a barcode", "");
  });

  let lastCode = null, lastTime = 0;
  Quagga.onDetected(result => {
    const code = result.codeResult.code;
    const now  = Date.now();
    if (code === lastCode && now - lastTime < 2000) return;
    lastCode = code; lastTime = now;
    setScanStatus("Scanned: " + code, "success");
    handleScan(code);
  });
}

function stopScanner() {
  if (!scannerActive) return;
  Quagga.stop();
  scannerActive = false;
  resetScannerUI();
  setScanStatus("Scanner stopped", "");
}

function resetScannerUI() {
  document.getElementById("scanner-viewport").classList.remove("active");
  document.getElementById("start-scanner").disabled = false;
  document.getElementById("stop-scanner").disabled  = true;
  document.getElementById("scanner-status-pill").textContent = "Ready";
}

function setScanStatus(msg, type) {
  const el = document.getElementById("scan-status");
  el.textContent = msg;
  el.className   = type;
}

// ─────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────

function setConnected(yes) {
  apPip.className             = yes ? "opp-pip" : "opp-pip away";
  disconnectBtn.style.display = yes ? "" : "none";
  if (!yes) {
    apSlotDisplay.textContent = "Not Connected";
    apGameDisplay.textContent = "Archipelago";
  }
}

function shakeFirstRow() {
  const row = itemListEl.querySelector(".item-row");
  if (!row) return;
  row.classList.add("shake");
  row.addEventListener("animationend", () => row.classList.remove("shake"), { once: true });
}

function showToast(msg, type = "") {
  toastEl.textContent = msg;
  toastEl.className   = "show " + type;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toastEl.className = ""; }, 2400);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────
//  ITEM DETAIL POPUP
// ─────────────────────────────────────────────

async function showItemDetail(loc) {
  const photo    = document.getElementById("img-overlay-photo");
  const titleEl  = document.getElementById("img-overlay-title");
  const subEl    = document.getElementById("img-overlay-sub");

  // Show overlay immediately with name while we fetch details
  photo.src       = "";
  photo.style.display = "none";
  titleEl.textContent = loc.name;
  subEl.innerHTML     = `<span class="detail-realm">${escHtml(loc.realm)}</span><br><span class="detail-barcode">Barcode: ${escHtml(loc.barcode)}</span>`;
  imgOverlay.classList.add("open");

  try {
    const resp = await fetch(`/archipelago/item/${encodeURIComponent(loc.barcode)}`);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const data = await resp.json();

    if (data.image) {
      photo.src = data.image;
      photo.style.display = "";
    }

    let sub = `<span class="detail-realm">${escHtml(loc.realm)}</span>`;
    sub += `<br><span class="detail-barcode">Barcode: ${escHtml(loc.barcode)}</span>`;
    if (data.price) sub += `<br><span class="detail-price">💰 ${escHtml(data.price)}</span>`;
    if (data.description) sub += `<br><span class="detail-desc">${escHtml(data.description)}</span>`;
    if (data.link) sub += `<br><a class="detail-link" href="${escHtml(data.link)}" target="_blank" rel="noopener">View product ↗</a>`;
    subEl.innerHTML = sub;
  } catch (err) {
    console.warn("[AP] Could not load item detail:", err);
  }
}

imgOverlay.addEventListener("click", e => { if (e.target === imgOverlay) imgOverlay.classList.remove("open"); });
window.addEventListener("keydown", e => { if (e.key === "Escape") imgOverlay.classList.remove("open"); });

// ─────────────────────────────────────────────
//  EVENT LISTENERS
// ─────────────────────────────────────────────

apConnectBtn.addEventListener("click", connectToAP);
["ap-server", "ap-slot", "ap-password"].forEach(id => {
  document.getElementById(id).addEventListener("keydown", e => { if (e.key === "Enter") connectToAP(); });
});

disconnectBtn.addEventListener("click", () => {
  if (apSocket) apSocket.close();
  connectOverlay.classList.remove("hidden");
  setConnected(false);
  allLocations = {}; barcodeToLocId = {};
  checkedLocations = new Set(); unlockedRealms = new Set();
  locationsLoaded = false; dataPackageReady = false; pendingItems = [];
  itemIdToName = {};
  itemListEl.innerHTML = "";
  updateProgress();
});

document.getElementById("start-scanner").addEventListener("click", startScanner);
document.getElementById("stop-scanner").addEventListener("click",  stopScanner);

document.getElementById("toggle-manual").addEventListener("click", () => {
  const sec     = document.getElementById("manual-section");
  const visible = sec.classList.toggle("visible");
  document.getElementById("toggle-manual").textContent = visible ? "✖ Hide Manual Entry" : "✏️ Enter UPC Manually";
});

document.getElementById("submit-upc").addEventListener("click", () => {
  const val = document.getElementById("manual-upc").value.trim();
  if (!val) return;
  handleScan(val);
  document.getElementById("manual-upc").value = "";
});

document.getElementById("manual-upc").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("submit-upc").click();
});

itemSearch.addEventListener("input", e => {
  searchQuery = e.target.value.trim().toLowerCase();
  renderItemList();
});

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────

setConnected(false);
disconnectBtn.style.display = "none";