
const createBtn = document.getElementById("createGameBtn");
const joinBtn = document.getElementById("joinGameBtn");

createBtn.addEventListener("click", () => {
  document.getElementById("scanner-container").style.display = "block";
  startScanner();
});

joinBtn.addEventListener("click", () => {
  alert("Join Game coming soon!");
});
