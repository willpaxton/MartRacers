const socket = io();
window.socket = socket;


// Generate or retrieve a unique player ID
let playerId = localStorage.getItem("playerId");
if (!playerId) {
  playerId = crypto.randomUUID();
  localStorage.setItem("playerId", playerId);
}


socket.onAny((event, data) => {
  console.log("EVENT:", event, data);
});


// When lobby is created
document.getElementById("createGame").addEventListener("click", () => {
  const numItems = 5; // TODO NEED TO ADD 10 OPTION
    socket.emit("lobby:create", {
    numItems
  });
});

// Redirect to lobby page. if this is the first user to join they will be host.
socket.on("lobby:created", (data) => {
  let username = document.getElementById("name").value.trim();
  localStorage.setItem("username", username);
  window.location.replace("/lobby/" + data.lobbyId);
});
