// lobbyStore.js
// This file is the "in-memory database" for live lobbies.
// We store lobby state in RAM because it is fast and easy for real-time games.
// SQLite can store long-term stats/results, but live match state should be in memory.

const lobbies = new Map();       // lobbyId (string) -> lobby object
const playerToLobby = new Map(); // playerId (string) -> lobbyId (string)

/**
 * Generates an easy-to-type lobby code like Among Us.
 * - No confusing letters like I/O/1/0
 * - 6 characters keeps it short but still has plenty of combinations
 */
function makeLobbyId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Creates a lobby and registers the creator as Player 1.
 * We also track which socket is in which lobby (socketToLobby) so disconnects are easy to handle.
 *
 * Params:
 * - socketId: socket.io id for this connection
 * - playerId: your game's user id (ties to USERS.userid in DB)
 * - username: display name for UI
 * - numItems: how many items the player needs to scan to win
 */
function createLobby({ numItems }) {
  // Generate a lobby code and ensure it isn't already used
  let lobbyId = makeLobbyId();
  while (lobbies.has(lobbyId)) {
    lobbyId = makeLobbyId();
  }

  // Lobby object = the server’s authoritative truth for this match
  const lobby = {
    lobbyId,
    // If numItems is missing or invalid, default to 5
    numItems: Number(numItems) || 5,

    // waiting: waiting for players
    // in_game: game has started
    // finished: game ended
    status: "waiting",
    createdAt: Date.now(),

    // players array holds up to 2 players for your MVP
    // items/currentIndex/score are stored here for the later scan validation step
    players: []
  };  

  // Save lobby in memory
  lobbies.set(lobbyId, lobby);

  // Save reverse lookup: socket -> lobbyId
  // Used for disconnect handling (auto-forfeit / cleanup)
  //socketToLobby.set(socketId, lobbyId);

  return lobby;
}

/**
 * Adds a second player to an existing lobby.
 * Returns either { lobby } on success or { error: "..." } on failure.
 */
function joinLobby({ lobbyId, playerId, username }) {
  const lobby = lobbies.get(lobbyId);

  let host = false;

  // Validate lobby exists
  if (!lobby) return { error: "Lobby not found." };

  // Validate lobby isn't full (MVP: max 2 players)
  //if (lobby.players.length >= 2) return { error: "Lobby is full." };

  // Validate game hasn't started already
  if (lobby.status !== "waiting") return { error: "Lobby already started." };

  if (lobby.players.length < 1) {
    host = true;
  }

  playerToLobby.set(playerId, lobbyId); // Track which lobby this player is in for easy disconnect handling

  lobby.players.push({
    playerId,
    username,
    host,
    score: 0,
    items: [],
    currentIndex: 0
  });


  // Track socket -> lobby for disconnect cleanup
  //socketToLobby.set(socketId, lobbyId);

  return { lobby };
}

function leaveLobby( playerId ) {
  // Find the lobby that this player is in
  const lobbyId = playerToLobby.get(playerId);
  if (!lobbyId) return { error: "Player not in any lobby." };

  const lobby = lobbies.get(lobbyId);
  if (!lobby) return { error: "Lobby not found." };

  // Remove player from lobby
  lobby.players = lobby.players.filter(p => p.playerId !== playerId);

  // Remove player -> lobby mapping
  playerToLobby.delete(playerId);

  // If the lobby is empty, remove it
  if (lobby.players.length === 0) {
    removeLobby(lobbyId);
  }

  return { lobby };
}

/**
 * Returns the lobby object by lobbyId (invite code).
 */
function getLobby(lobbyId) {
  return lobbies.get(lobbyId);
}

/**
 * Returns lobbyId (invite code) for a given socket connection.
 * This is mainly used when a client disconnects.
 */
// function getLobbyIdBySocket(socketId) {
//   return socketToLobby.get(socketId);
// }

/**
 * Returns lobbyId (invite code) for a given playerId.
 * This is mainly used when a client disconnects.
 */
function getLobbyIdByPlayer(playerId) {
  return playerToLobby.get(playerId);
}


/**
 * Removes a lobby and cleans up any socket -> lobby mappings.
 * MVP approach: once a match ends or someone disconnects, we delete the lobby.
 */
function removeLobby(lobbyId) {
  const lobby = lobbies.get(lobbyId);

  // If lobby exists, remove all socket mappings for its players
  if (lobby) {
    for (const p of lobby.players) {
      playerToLobby.delete(p.playerId);
    }
  }

  // Remove lobby from the lobbies map
  lobbies.delete(lobbyId);
}

function getAllLobbies() {
  return Object.fromEntries(lobbies); // if lobbies is a Map
}

module.exports = {
  createLobby,
  joinLobby,
  leaveLobby,
  getLobby,
  removeLobby,
  getAllLobbies,
  getLobbyIdByPlayer
};