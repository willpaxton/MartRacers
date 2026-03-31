// server.js
// Main server entry point.
// - Express hosts a simple HTTP endpoint (helpful for "is server up?")
// - Socket.io handles real-time multiplayer communication
// - Lobby state is stored in memory (Map) for speed during a live match
// - Items are pulled from SQLite at game start
// - Scan validation happens on the server (server is authoritative)

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const {
  createLobby,
  joinLobby, 
  getLobby,
  getLobbyIdBySocket,
  removeLobby
} = require("./lobbyStore");

// DB function that grabs random items from BARCODES table
const { getRandomBarcodes, playerLostGame, playerWonGame } = require("./itemsRepo");

const app = express();
const server = http.createServer(app);

// CORS open for MVP so any dev frontend can connect.
// Lock down later once you know where frontend is hosted.
const io = new Server(server, { cors: { origin: "*" } });

app.get("/", (req, res) => res.send("MartRacers server running ✅"));
app.use(express.static("public"));
/**
 * Helper: find the lobby + player record for the current socket.
 * This keeps the scan logic clean and avoids repeating the same lookup code.
 */
function getLobbyAndPlayer(lobbyId, socketId, getLobbyFn) {
  const lobby = getLobbyFn(lobbyId);
  if (!lobby) return { error: "Lobby not found." };

  const player = lobby.players.find(p => p.socketId === socketId);
  if (!player) return { error: "Player not in this lobby." };

  return { lobby, player };
}

/**
 * Get a replacement item that is not already in the player's current item list
 * and has not already been scanned by that player.
 */
async function getUniqueReplacementItem(playerItems, itemIndexToReplace, collectedUpcs = new Set()) {
  const existingUpcs = new Set(
    playerItems
      .filter((_, idx) => idx !== itemIndexToReplace)
      .map((i) => String(i.upc).trim())
  );

  const excludedUpcs = new Set([
    ...existingUpcs,
    ...Array.from(collectedUpcs).map((u) => String(u).trim())
  ]);

  // Try a few batches to find something unique
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidates = await getRandomBarcodes(10);

    const replacement = candidates.find((item) => {
      const upc = String(item.upc).trim();
      return !excludedUpcs.has(upc);
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
   * Payload: { playerId, username, numItems }
   */
  socket.on("lobby:create", (payload) => {
    const { playerId, username, numItems } = payload || {};

    // Basic validation. MVP only.
    if (!playerId || !username) {
      return socket.emit("lobby:error", { message: "playerId and username required" });
    }

    // Create lobby object in memory
    const lobby = createLobby({ socketId: socket.id, playerId, username, numItems });

    // Put this socket in a socket.io "room" named after the lobbyId
    // This allows io.to(lobbyId).emit(...) to broadcast to both players at once.
    socket.join(lobby.lobbyId);

    // Tell creator the lobby code
    socket.emit("lobby:created", { lobbyId: lobby.lobbyId });

    // Tell creator who's in the lobby (currently just them)
    socket.emit("lobby:joined", {
      lobbyId: lobby.lobbyId,
      players: lobby.players.map(p => ({ playerId: p.playerId, username: p.username }))
    });

    console.log("🏠 Lobby created:", lobby.lobbyId);
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
      const result = joinLobby({ lobbyId, socketId: socket.id, playerId, username });
      if (result.error) return socket.emit("lobby:error", { message: result.error });

      const lobby = result.lobby;

      // Join socket.io room for broadcast
      socket.join(lobbyId);

      // Broadcast lobby players to both clients
      io.to(lobbyId).emit("lobby:joined", {
        lobbyId,
        players: lobby.players.map(p => ({ playerId: p.playerId, username: p.username }))
      });

      // If we have 2 players, we can start the game automatically.
      if (lobby.players.length === 2) {
        io.to(lobbyId).emit("lobby:ready", {
          lobbyId,
          players: lobby.players.map(p => ({ playerId: p.playerId, username: p.username }))
        });

        // -----------------------------------------
        // Countdown support
        // -----------------------------------------
        const countdownSeconds = 3;
        const countdownMs = countdownSeconds * 1000;

        // Game is not live yet — countdown phase first
        lobby.status = "countdown";
        lobby.startedAt = Date.now() + countdownMs;

        // After countdown expires, officially mark game as live
        setTimeout(() => {
          const latestLobby = getLobby(lobbyId);
          if (!latestLobby) return;

          if (latestLobby.status === "countdown") {
            latestLobby.status = "in_game";
            console.log("⏱️ Countdown finished. Game is now live in lobby:", lobbyId);
          }
        }, countdownMs);

        // Each player gets their own random list
        for (const p of lobby.players) {
          const items = await getRandomBarcodes(lobby.numItems);

          // Store the full items list on the server (includes UPC)
          p.items = items;
          p.currentIndex = 0;
          p.score = 0;
          p.collectedUpcs = new Set();

          // Send the client only the display fields + countdown metadata
          io.to(p.socketId).emit("game:start", {
            lobbyId,
            numItems: lobby.numItems,
            countdownSeconds,
            gameStartAt: lobby.startedAt,
            yourItems: items.map(i => ({
              title: i.title,
              category: i.category,
              description: i.description,
              image: i.image,
              price: i.price,
              link: i.link
            }))
          });
        }

        console.log("🏁 Game countdown started in lobby:", lobbyId);
      }
    } catch (err) {
      console.error("Join/start error:", err);
      socket.emit("lobby:error", { message: "Failed to join/start lobby" });
    }
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
    const { lobbyId, upc } = payload || {};

    if (!lobbyId || !upc) {
      return socket.emit("lobby:error", { message: "lobbyId and upc required" });
    }

    const { lobby, player, error } = getLobbyAndPlayer(lobbyId, socket.id, getLobby);
    if (error) return socket.emit("lobby:error", { message: error });

    // If countdown is still happening, do not allow scans yet
    if (lobby.status === "countdown") {
      const msLeft = Math.max(0, lobby.startedAt - Date.now());

      return socket.emit("game:scanResult", {
        lobbyId,
        correct: false,
        score: player.score,
        remaining: lobby.numItems - player.score,
        message: `Game starts in ${Math.ceil(msLeft / 1000)}...`
      });
    }

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
      const { lobbyId, itemIndex } = payload || {};

      if (!lobbyId || typeof itemIndex !== "number") {
        return socket.emit("lobby:error", { message: "lobbyId and itemIndex required" });
      }

      const { lobby, player, error } = getLobbyAndPlayer(lobbyId, socket.id, getLobby);
      if (error) return socket.emit("lobby:error", { message: error });

      if (lobby.status !== "in_game") {
        return socket.emit("lobby:error", { message: "Game is not currently running." });
      }

      if (itemIndex < 0 || itemIndex >= player.items.length) {
        return socket.emit("lobby:error", { message: "Invalid item index." });
      }

    const replacement = await getUniqueReplacementItem(
      player.items,
      itemIndex,
    player.collectedUpcs || new Set()
    );
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
    const lobbyId = getLobbyIdBySocket(socket.id);
    if (!lobbyId) return;

    const lobby = getLobby(lobbyId);
    if (!lobby) return;

    console.log("❌ Disconnect:", socket.id, "from lobby:", lobbyId);

    if (lobby.status === "in_game" && lobby.players.length === 2) {
      const winner = lobby.players.find(p => p.socketId !== socket.id);
      if (winner) {
        io.to(lobbyId).emit("game:finish", {
          lobbyId,
          winnerPlayerId: winner.playerId,
          reason: "opponent_disconnect"
        });
      }
    }

    // MVP cleanup: remove lobby from memory
    // (This is fine for now. Later, you may want to keep it for a "results screen" moment.)
    removeLobby(lobbyId);
  });
});

server.listen(3000, () => console.log("✅ Listening on http://localhost:3000"));