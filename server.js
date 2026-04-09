// server.js
// Main server entry point.
// - Express hosts a simple HTTP endpoint (helpful for "is server up?")
// - Socket.io handles real-time multiplayer communication
// - Lobby state is stored in memory (Map) for speed during a live match
// - Items are pulled from SQLite at game start
// - Scan validation happens on the server (server is authoritative)

const express = require("express");
const https = require("https");
const http = require("http");
const { Server } = require("socket.io");
const fs = require('fs');


// Path to the SSL certificates
const privateKey
    = fs.readFileSync("security/localhost.key", "utf8");
const certificate
    = fs.readFileSync("security/localhost.crt", "utf8");


// Create HTTPS server options
const credentials = {
    key : privateKey,
    cert : certificate
};




const {
  createLobby,
  joinLobby, 
  leaveLobby,
  getLobby,
  removeLobby,
  getLobbyIdByPlayer
} = require("./lobbyStore");

// DB function that grabs random items from BARCODES table
const { getRandomBarcodes } = require("./itemsRepo");

const app = express();
const server = https.createServer(credentials, app);

// CORS open for MVP so any dev frontend can connect.
// Lock down later once you know where frontend is hosted.
const io = new Server(server, { cors: { origin: "*" } });

//app.get("/", (req, res) => res.redirect("/index")); // Redirect root to index.html
app.use(express.static("public", { extensions: ["html"], 'index': 'index.html' })); // Serve static files from "public" folder, default to .html

app.get('/lobby/:id', (req, res) => {
  // Extract the lobby ID from the URL parameters
  const roomID = req.params.id; 
  if (getLobby(roomID)) {
      res.sendFile(__dirname + '/public/lobby.html');
  } else {
      res.redirect('/'); // Redirect to home if lobby doesn't exist
  }
});

/**
 * Helper: find the lobby + player record for the current socket.
 * This keeps the scan logic clean and avoids repeating the same lookup code.
 */
function getLobbyAndPlayer(lobbyId, playerId, getLobbyFn) {
  const lobby = getLobbyFn(lobbyId);
  if (!lobby) return { error: "Lobby not found." };

  const player = lobby.players.find(p => p.playerId === playerId);
  if (!player) return { error: "Player not in this lobby." };

  return { lobby, player };
}

/**
 * Get a replacement item that is not already in the player's current item list.
 * We try a few times to avoid duplicates.
 */
async function getUniqueReplacementItem(playerItems, itemIndexToReplace) {
  const existingUpcs = new Set(
    playerItems
      .filter((_, idx) => idx !== itemIndexToReplace)
      .map((i) => String(i.upc).trim())
  );

  // Try a few batches to find something unique
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidates = await getRandomBarcodes(10);
    const replacement = candidates.find((item) => {
      const upc = String(item.upc).trim();
      return !existingUpcs.has(upc);
    });

    if (replacement) return replacement;
  }

  return null;
}

// Every time a client connects, socket.io gives them a unique socket.id.
// We'll use socket.id to route messages to the right player.
io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  /**
   * Client wants to create a lobby.
   * Payload: { numItems }
   */
  socket.on("lobby:create", (payload) => {
    const { numItems } = payload || {};

    // Create lobby object in memory
    const lobby = createLobby({ numItems });

    // Tell creator the lobby code
    socket.emit("lobby:created", { lobbyId: lobby.lobbyId });
    console.log("🏠 Lobby created:", lobby.lobbyId);
  });

  /**
   * Client wants to see if they have joined before (e.g. refresh case).
   * not_connected = you have never joined this lobby before, please provide username and join
   * connected = you are already a member of this lobby, welcome back! (handles refresh case)
   * Payload: { lobbyId, playerId }
   */
    socket.on("lobby:rejoin", (payload) => {
    const {lobbyId, playerId } = payload
    const lobby = getLobby(lobbyId);
    if (!lobby) {
      return socket.emit("lobby:error", { message: "Lobby not found." });
    }
    const player = lobby.players.find(p => p.playerId === playerId);

    // player is not in this lobby, they need to join first
    if (!player) {
      return socket.emit("lobby:not_connected", { message: "Player not in this lobby." });
    }

    clearTimeout(player.timeout); // Clear any existing disconnect timeout since they're back

    // user is joining back to a lobby they are already a member of (probably refresh case)
    // Join socket.io room for broadcast
    socket.join(lobbyId);
    socket.playerId = playerId; // Attach playerId to socket for easy lookup on disconnect

    return socket.emit("lobby:connected", {
      lobbyId,
      players: lobby.players.map(p => ({ playerId: p.playerId, username: p.username }))
    });
  });

  /**
   * Client wants to join an existing lobby by code.
   * Payload: { lobbyId, playerId, username }
   */
  socket.on("lobby:join", async (payload) => {
    try {
      const { lobbyId, playerId, username } = payload || {};

      if (!lobbyId || !playerId || !username) {
        return socket.emit("lobby:error", { message: "lobbyId, playerId, username required" });
      }

      // Add player to lobby (in memory)
      const result = joinLobby({ lobbyId, playerId, username });
      if (result.error) return socket.emit("lobby:error", { message: result.error });

      const lobby = result.lobby;

      // Join socket.io room for broadcast
      socket.join(lobbyId);
      socket.playerId = playerId; // Attach playerId to socket for easy lookup on disconnect

      // Broadcast lobby players to both clients
      io.to(lobbyId).emit("lobby:joined", {
        lobbyId,
        players: lobby.players.map(p => ({ playerId: p.playerId, username: p.username }))
      });

      // If we have 2 players, we can start the game automatically.
      // if (lobby.players.length === 2) {
      //   io.to(lobbyId).emit("lobby:ready", {
      //     lobbyId,
      //     players: lobby.players.map(p => ({ playerId: p.playerId, username: p.username }))
      //   });
      // }
    } catch (err) {
      console.error("Join error:", err);
      socket.emit("lobby:error", { message: "Failed to join lobby" });
    }
  });

  socket.on("game:start", async (payload) => {
    lobby.status = "in_game";
    lobby.startedAt = Date.now();

    // IMPORTANT: Each player gets their own random list (your design decision).
    // Pull random barcode items from SQLite
    const items = await getRandomBarcodes(lobby.numItems);

    // Store the full items list on the server (includes UPC)
    // This is the authoritative truth for scan validation later.
    p.items = items;
    p.currentIndex = 0;
    p.score = 0;
    p.collectedUpcs = new Set();

    // Send the client ONLY what they need to play (no UPC).
    // If we send UPC, they can cheat easily.
    io.to(lobbyId).emit("game:start", {
      lobbyId,
      numItems: lobby.numItems,
      yourItems: items.map(i => ({
        title: i.title,
        category: i.category,
        description: i.description,
        image: i.image,
        price: i.price,
        link: i.link
      }))
    });

    console.log("🏁 Game started in lobby:", lobbyId);
  });
  /**
   * Client scanned a barcode and sends UPC to server.
   * Payload: { lobbyId, upc }
   *
   * Server checks if UPC matches ANY item in the player's list.
   * If it matches a not-yet-scanned item, score increases.
   * This makes the list behave like a shopping list rather than a forced order.
   */
  socket.on("game:scanUpc", (payload) => {
    const { lobbyId, playerId, upc } = payload || {};

    if (!lobbyId || !upc) {
      return socket.emit("lobby:error", { message: "lobbyId and upc required" });
    }

    const { lobby, player, error } = getLobbyAndPlayer(lobbyId, playerId, getLobby);
    if (error) return socket.emit("lobby:error", { message: error });

    if (lobby.status !== "in_game") {
      return socket.emit("lobby:error", { message: "Game is not currently running." });
    }

    // If player already finished, ignore scans
    if (player.score >= lobby.numItems) {
      return socket.emit("game:scanResult", {
        lobbyId,
        correct: false,
        score: player.score,
        remaining: 0,
        message: "You already finished."
      });
    }

    // Normalize the scanned UPC
    const scannedUpc = String(upc).trim();

    // Make sure collectedUpcs exists
    if (!player.collectedUpcs) {
      player.collectedUpcs = new Set();
    }

    console.log("📦 ALL PLAYER UPCs:", player.items.map(i => i.upc));
    console.log("🔎 SCANNED UPC:", scannedUpc);

    // Prevent the same item from being counted twice
    if (player.collectedUpcs.has(scannedUpc)) {
      return socket.emit("game:scanResult", {
        lobbyId,
        correct: false,
        score: player.score,
        remaining: lobby.numItems - player.score,
        message: "You already scanned that item."
      });
    }

    // Search for a match anywhere in the player's item list
    const matchedItem = player.items.find((item) => {
      return String(item.upc).trim() === scannedUpc;
    });

    console.log("🎯 MATCHED ITEM:", matchedItem ? matchedItem.title : null);

    // No match anywhere in the list
    if (!matchedItem) {
      return socket.emit("game:scanResult", {
        lobbyId,
        correct: false,
        score: player.score,
        remaining: lobby.numItems - player.score
      });
    }

    // Correct item found and it hasn't been counted yet
    player.collectedUpcs.add(scannedUpc);
    player.score += 1;

    const remaining = lobby.numItems - player.score;

    socket.emit("game:scanResult", {
      lobbyId,
      correct: true,
      score: player.score,
      remaining,
      matchedTitle: matchedItem.title || null
    });

    // Win condition
    if (player.score >= lobby.numItems) {
      lobby.status = "finished";
      lobby.endedAt = Date.now();

      const durationMs = lobby.endedAt - (lobby.startedAt || lobby.endedAt);

      io.to(lobbyId).emit("game:finish", {
        lobbyId,
        winnerPlayerId: player.playerId,
        reason: "completed_items",
        durationMs
      });

      console.log(`🏆 Winner in lobby ${lobbyId}: ${player.playerId} time=${durationMs}ms`);
    }
  });
  /**
   * Client wants to skip one specific item in their list.
   * Payload: { lobbyId, itemIndex }
   *
   * Server replaces that item with a new random barcode item
   * that is not already in the player's current list.
   */
  socket.on("game:skipItem", async (payload) => {
    try {
      const { lobbyId, playerId, itemIndex } = payload || {};

      if (!lobbyId || !playerId || typeof itemIndex !== "number") {
        return socket.emit("lobby:error", { message: "lobbyId, playerId, and itemIndex required" });
      }

      const { lobby, player, error } = getLobbyAndPlayer(lobbyId, playerId, getLobby);
      if (error) return socket.emit("lobby:error", { message: error });

      if (lobby.status !== "in_game") {
        return socket.emit("lobby:error", { message: "Game is not currently running." });
      }

      if (itemIndex < 0 || itemIndex >= player.items.length) {
        return socket.emit("lobby:error", { message: "Invalid item index." });
      }

      const replacement = await getUniqueReplacementItem(player.items, itemIndex);

      if (!replacement) {
        return socket.emit("game:scanResult", {
          lobbyId,
          correct: false,
          score: player.score,
          remaining: lobby.numItems - player.score,
          message: "No replacement item available right now."
        });
      }

      // Replace the item in server memory
      player.items[itemIndex] = replacement;

      // Send only display data back to the client
      socket.emit("game:itemReplaced", {
        itemIndex,
        newItem: {
          title: replacement.title,
          category: replacement.category,
          image: replacement.image,
          price: replacement.price,
          link: replacement.link
        }
      });

      console.log(`⏭️ Replaced item ${itemIndex} for player ${player.playerId} in lobby ${lobbyId}`);
    } catch (err) {
      console.error("Skip item error:", err);
      socket.emit("lobby:error", { message: "Failed to replace item." });
    }
  });
  /**
   * If a socket disconnects, we look up what lobby they were in.
   * If game is active, auto-forfeit: other player wins.
   */
  socket.on("disconnect", () => {
    const lobbyId = getLobbyIdByPlayer(socket.playerId);
    if (!lobbyId) return;

    const lobby = getLobby(lobbyId);
    if (!lobby) return;

    const playerId = socket.playerId;

    console.log("❌ Disconnect:", playerId, "from lobby:", lobbyId);

    const player = lobby.players.find(p => p.playerId === playerId);

    player.timeout = setTimeout(() => {
      leaveLobby(playerId);
      lobby.players = lobby.players.filter(p => p.playerId !== playerId);
      io.to(lobbyId).emit("lobby:joined", {
        lobbyId,
        players: lobby.players.map(p => ({ playerId: p.playerId, username: p.username }))
      });
    }, 5000); // 10 second timeout for players to reconnect


    // // MVP cleanup: remove lobby from memory
    // // (This is fine for now. Later, you may want to keep it for a "results screen" moment.)
    // removeLobby(lobbyId);
  });
});

// DEBUG ONLY - remove before production
app.get("/debug/lobbies", (req, res) => {
  const { getAllLobbies } = require("./lobbyStore");
  const lobbies = getAllLobbies();
  
  const output = {};
  for (const [lobbyId, lobby] of Object.entries(lobbies)) {
    output[lobbyId] = {
      status: lobby.status,
      players: lobby.players.map(p => ({
        playerId: p.playerId,
        username: p.username,
        score: p.score,
        items: p.items?.map(i => ({
          upc: i.upc,
          title: i.title
        }))
      }))
    };
  }
  
  res.json(output);
});

  // // redirect http to https
  // http.createServer((req, res) => {
  //   res.writeHead(301, {
  //       "Location" :
  //           `https://${req.headers.host}${req.url}:3000`
  //   });
  //   res.end();
  // })
  // .listen(3001);

  server.listen(3000, () => console.log("✅ Listening on http://localhost:3000"));

  // repush for testing :D