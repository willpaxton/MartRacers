const socket = io();
window.socket = socket;


let playerId = localStorage.getItem("playerId");

if (!playerId) {
  playerId = crypto.randomUUID();
  localStorage.setItem("playerId", playerId);
}

let username = document.getElementById("hostName").value.trim() || ("Player_" + Math.floor(Math.random() * 1000));
localStorage.setItem("username", username);


socket.onAny((event, data) => {
  console.log("EVENT:", event, data);
});


document.getElementById("startGameBtn").addEventListener("click", () => {
  const numItems = 5; // TODO NEED TO ADD 10 OPTION
    socket.emit("lobby:create", {
    playerId,
    username,
    numItems
  });
});


socket.on("lobby:created", (data) => {
  window.location.replace("/lobby/" + data.lobbyId);
});
