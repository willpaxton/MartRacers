const lobbyId = window.location.pathname.split('/').filter(segment => segment).at(-1);

const socket = io();
window.socket = socket;

let players = [];

let playerId = localStorage.getItem("playerId");
if (!playerId) {
  playerId = crypto.randomUUID();
  localStorage.setItem("playerId", playerId);
}

const playersEl = document.getElementById("players");
const playersListEl = document.getElementById("players-list");
const playerCountEl = document.getElementById("player-count");
const lobbyIdEl = document.getElementById("lobbyId");
const hostControlsEl = document.getElementById("hostControls");
const startGameBtn = document.getElementById("startGameBtn");

socket.onAny((event, data) => {
  console.log("EVENT:", event, data);
});

// Show lobby ID on page
lobbyIdEl.textContent = lobbyId;

// Ask server if this user is already in the lobby (refresh case)
socket.emit("lobby:rejoin", {
  playerId,
  lobbyId
});

/**
 * Render players list and decide whether current user is host.
 */
function renderLobby(playersList) {
  players = playersList || [];

  playersEl.textContent = players.length
    ? players.map(p => p.username + (p.host ? " (Host)" : "")).join(", ")
    : "Waiting for players...";

  playerCountEl.textContent = `${players.length} / 2`;
  playersListEl.innerHTML = players.length
    ? players.map(p => `<li>${p.username}${p.host ? " (Host)" : ""}</li>`).join("")
    : `
      <li class="players-empty">
        <span>🕐</span>
        Waiting for players…
      </li>
    `;

  const me = players.find(p => p.playerId === playerId);
  const amHost = !!me?.host;

  // Only host can see the Start button
  hostControlsEl.style.display = amHost ? "block" : "none";

  // Optional: only enable start if 2+ players are present
  startGameBtn.disabled = players.length < 2;
}

// If player has never joined, create username and join now
socket.on("lobby:not_connected", () => {
  const username = localStorage.getItem("username") || ("Player_" + Math.floor(Math.random() * 1000));
  localStorage.setItem("username", username);

  socket.emit("lobby:join", {
    playerId,
    lobbyId,
    username
  });
});

// Already a member of the lobby (refresh case)
socket.on("lobby:connected", (data) => {
  renderLobby(data.players);
});

// New player joined / players updated
socket.on("lobby:joined", (data) => {
  renderLobby(data.players);
});

// Host clicks Start Game
startGameBtn.addEventListener("click", () => {
  socket.emit("game:start", {
    lobbyId
  });
});

// Server tells everyone to move to the game page
socket.on("game:starting", () => {
  window.location.replace("/game/" + lobbyId);
});

socket.on("lobby:error", (err) => {
  console.error("Lobby error:", err);
  alert(err?.message || "Lobby error.");
});