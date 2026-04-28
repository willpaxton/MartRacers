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

  const list = document.getElementById('players-list');
  const countBadge = document.getElementById('player-count');

  list.innerHTML = '';

  if (players.length === 0) {
    list.innerHTML = `
      <li class="players-empty">
        <span>🕐</span>
        Waiting for players…
      </li>`;
  } else {
    players.forEach(player => {
      const li = document.createElement('li');
      li.className = 'player-row' + (player.host ? ' host' : '');
      li.innerHTML = `
        <div class="player-avatar">👤</div>
        <div class="player-info">
          <div class="player-name">${player.username}</div>
          <div class="player-tag">${player.host ? 'Host' : 'Player'}</div>
        </div>
        <div class="player-status"></div>
      `;
      list.appendChild(li);
    });
  }

  if (countBadge) countBadge.textContent = `${players.length} / 2`;

  const me = players.find(p => p.playerId === playerId);
  const amHost = !!me?.host;

  hostControlsEl.style.display = amHost ? 'block' : 'none';
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