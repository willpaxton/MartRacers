const lobbyId = window.location.pathname.split('/').filter(segment => segment).at(-1); // Get the last non-empty segment as lobbyId

const socket = io();
window.socket = socket;

let players = []; // Local copy of players in this lobby, will be updated from server

let playerId = localStorage.getItem("playerId");
if (!playerId) {
  playerId = crypto.randomUUID();
  localStorage.setItem("playerId", playerId);
}

socket.onAny((event, data) => {
    console.log("EVENT:", event, data);
});

// Check if user disconnected
socket.emit("lobby:rejoin", {
    playerId,
    lobbyId
});

// If not connected, it means this player has never joined this lobby before, so we ask for username and join as a new player
socket.on("lobby:not_connected", (data) => {
  username = localStorage.getItem("username") || ("Player_" + Math.floor(Math.random() * 1000));
  socket.emit("lobby:join", {
    playerId,
    lobbyId,
    username
});
});

// If connected, it means this player has already joined this lobby before, so we just update the players list and UI
socket.on("lobby:connected", (data) => {
    players = data.players; // Update local players list with the one from the server
    document.getElementById("players").textContent = players.map(p => p.username).join(", ");
});

// When a new player joins, update the players list and UI
socket.on("lobby:joined", (data) => {
    players = data.players; // Update local players list with the one from the server
    document.getElementById("players").textContent = players.map(p => p.username).join(", ");
});


// TEMP code to display lobby ID on the page, you can remove this later
document.getElementById("lobbyId").textContent = lobbyId;

