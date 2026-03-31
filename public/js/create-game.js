    const socket = io();
    window.socket = socket;
    window.currentLobbyId = null;
    window.currentItems = [];

    


let playerId = localStorage.getItem("playerId");

if (!playerId) {
  playerId = crypto.randomUUID();
  localStorage.setItem("playerId", playerId);
}





    function showStatus(msg) {
      statusEl.textContent = msg;
    }

    socket.onAny((event, data) => {
      console.log("EVENT:", event, data);
    });

    socket.on("connect", () => {
      showStatus("Connected to server. Socket id: " + socket.id);
    });

    socket.on("disconnect", () => {
      showStatus("Disconnected");
    });

    window.createLobby = () => createHandler();
    window.joinLobby = (code) => joinHandler(code);

    createBtn.addEventListener("click", createHandler);

    joinBtn.addEventListener("click", () => {
      const code = joinCodeEl.value && joinCodeEl.value.trim();
      joinHandler(code);
    });

    manualUpcBtn.addEventListener("click", submitManualUpc);

    manualUpcInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitManualUpc();
      }
    });

    backBtn.addEventListener("click", () => {
      history.pushState({ page: "lobby" }, "", "/");
      lobbyView.style.display = "";
      gameView.style.display = "none";
      window.currentItems = [];
      window.currentLobbyId = null;
    });

    function submitManualUpc() {
      const upc = manualUpcInput.value.trim();

      if (!upc) {
        serverCheckEl.textContent = "Enter a barcode first.";
        serverCheckEl.style.color = "crimson";
        return;
      }

      if (!window.currentLobbyId) {
        serverCheckEl.textContent = "You are not currently in a lobby.";
        serverCheckEl.style.color = "crimson";
        return;
      }

      socket.emit("game:scanUpc", {
        lobbyId: window.currentLobbyId,
        upc
      });

      serverCheckEl.textContent = "📨 Sending manual barcode to server...";
      serverCheckEl.style.color = "#444";
      manualUpcInput.value = "";
    }

    function createHandler() {
      const username = usernameEl.value.trim() || ("Player_" + Math.floor(Math.random() * 1000));
      const numItems = parseInt(numItemsEl.value, 10) || 5;

      showStatus("Creating lobby...");
      socket.emit("lobby:create", {
        playerId: Math.floor(Math.random() * 1000000),
        username,
        numItems
      });
    }

    function joinHandler(code) {
      if (!code) {
        showStatus("Enter a lobby code to join.");
        return;
      }

      const username = usernameEl.value.trim() || ("Player_" + Math.floor(Math.random() * 1000));
      showStatus("Joining lobby " + code + "...");

      socket.emit("lobby:join", {
        lobbyId: code,
        playerId: Math.floor(Math.random() * 1000000),
        username
      });
    }

    function openGameView(lobbyId) {
      window.currentLobbyId = lobbyId;
      history.pushState({ page: "game", lobbyId }, "", "/game");
      lobbyView.style.display = "none";
      gameView.style.display = "";
      gameInfo.textContent = "Lobby: " + lobbyId + " — socket: " + socket.id;
      showStatus("In lobby " + lobbyId);

      if (serverCheckEl) {
        serverCheckEl.textContent = "";
        serverCheckEl.style.color = "";
      }
    }

    socket.on("lobby:created", (data) => {
      openGameView(data.lobbyId);
    });

    socket.on("lobby:joined", (data) => {
      openGameView(data.lobbyId);
    });

    socket.on("lobby:error", (err) => {
      showStatus("Error: " + (err && err.message ? err.message : JSON.stringify(err)));
    });

    function escapeHTML(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function openImageOverlay({ src, title, category }) {
      overlayImg.src = src;
      overlayImg.alt = title || "Item image";
      overlayTitle.textContent = title || "Item";
      overlaySub.textContent = category || "";
      overlay.classList.add("open");
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("open");
        overlayImg.src = "";
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("open")) {
        overlay.classList.remove("open");
        overlayImg.src = "";
      }
    });

    function renderItems(items) {
      const list = itemsListEl;
      list.innerHTML = "";

      items.forEach((it, idx) => {
        const li = document.createElement("li");
        li.className = "itemRow";

        let thumbEl;
        const imgUrl = it.image && String(it.image).trim()
          ? String(it.image).trim()
          : "";

        if (imgUrl) {
          const img = document.createElement("img");
          img.className = "thumb";
          img.loading = "lazy";
          img.decoding = "async";
          img.referrerPolicy = "no-referrer";
          img.src = imgUrl;

          img.onerror = () => {
            const ph = document.createElement("div");
            ph.className = "thumbPlaceholder";
            ph.textContent = "No image";
            img.replaceWith(ph);
          };

          img.addEventListener("click", () => {
            openImageOverlay({
              src: imgUrl,
              title: it.title,
              category: it.category
            });
          });

          thumbEl = img;
        } else {
          const ph = document.createElement("div");
          ph.className = "thumbPlaceholder";
          ph.textContent = "No image";
          thumbEl = ph;
        }

        const textBox = document.createElement("div");
        textBox.className = "itemText";
        textBox.innerHTML = `
          <div class="itemTitle">${idx + 1}. ${escapeHTML(it.title || "Untitled")}</div>
          <div class="itemCat">${escapeHTML(it.category || "")}</div>
        `;

        const actionsBox = document.createElement("div");
        actionsBox.className = "itemActions";

        const skipBtn = document.createElement("button");
        skipBtn.className = "skipBtn";
        skipBtn.textContent = "Skip";
        skipBtn.dataset.index = String(idx);

        skipBtn.addEventListener("click", () => {
          if (!window.currentLobbyId) return;

          socket.emit("game:skipItem", {
            lobbyId: window.currentLobbyId,
            itemIndex: idx
          });

          serverCheckEl.textContent = `⏭️ Requesting replacement for item ${idx + 1}...`;
          serverCheckEl.style.color = "#444";
        });

        actionsBox.appendChild(skipBtn);

        const meta = document.createElement("div");
        meta.className = "itemMeta";

        const left = document.createElement("div");
        left.className = "row";
        left.style.alignItems = "center";
        left.style.flexWrap = "nowrap";
        left.appendChild(thumbEl);
        left.appendChild(textBox);

        meta.appendChild(left);
        meta.appendChild(actionsBox);

        li.appendChild(meta);
        list.appendChild(li);
      });
    }

    socket.on("game:start", (data) => {
      openGameView(data.lobbyId);

      const items = data.yourItems || [];
      window.currentItems = items;

      renderItems(window.currentItems);

      gameInfo.textContent =
        "Lobby: " +
        data.lobbyId +
        " — " +
        (data.numItems || items.length) +
        " items";
    });

    socket.on("game:itemReplaced", (data) => {
      const { itemIndex, newItem } = data || {};

      if (
        typeof itemIndex !== "number" ||
        itemIndex < 0 ||
        !newItem ||
        !Array.isArray(window.currentItems)
      ) {
        return;
      }

      window.currentItems[itemIndex] = newItem;
      renderItems(window.currentItems);

      serverCheckEl.textContent = `✅ Item ${itemIndex + 1} replaced.`;
      serverCheckEl.style.color = "green";
    });

    socket.on("game:scanResult", (data) => {
      if (!serverCheckEl) return;

      if (data.correct) {
        serverCheckEl.textContent = `✅ Correct! Score: ${data.score} | Remaining: ${data.remaining}`;
        serverCheckEl.style.color = "green";
      } else {
        if (data.message) {
          serverCheckEl.textContent = `ℹ️ ${data.message}`;
          serverCheckEl.style.color = "#333";
        } else {
          serverCheckEl.textContent = `❌ Wrong UPC. Hit Start Scan and try again.`;
          serverCheckEl.style.color = "crimson";
        }
      }
    });

    socket.on("game:finish", (data) => {
      if (!serverCheckEl) return;

      const reason = data.reason || "unknown";
      serverCheckEl.textContent = `🏁 Game finished! Winner: ${data.winnerPlayerId} (reason: ${reason})`;
      serverCheckEl.style.color = "#111";
    });

    window.addEventListener("popstate", (ev) => {
      if (ev.state && ev.state.page === "game") {
        lobbyView.style.display = "none";
        gameView.style.display = "";
        window.currentLobbyId = ev.state.lobbyId || window.currentLobbyId;
      } else {
        lobbyView.style.display = "";
        gameView.style.display = "none";
        window.currentLobbyId = null;
      }
    });

    console.info("Use the form to create/join. Socket available as window.socket.");