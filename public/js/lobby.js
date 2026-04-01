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

socket.emit("lobby:rejoin", {
    playerId,
    lobbyId
});

socket.on("lobby:not_connected", (data) => {
  // POP UP A MODAL ASKING FOR USERNAME TO JOIN THE GAME FOR THE FIRST TIME
  socket.emit("lobby:join", {
    playerId,
    lobbyId,
    username: "temp" // TODO
});
});

socket.on("lobby:connected", (data) => {
    players = data.players; // Update local players list with the one from the server
    document.getElementById("players").textContent = players.map(p => p.username).join(", ");
});

socket.on("lobby:joined", (data) => {
    players = data.players; // Update local players list with the one from the server
    document.getElementById("players").textContent = players.map(p => p.username).join(", ");
});


// TEMP STUFF

document.getElementById("lobbyId").textContent = lobbyId;

