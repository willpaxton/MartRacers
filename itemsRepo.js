// itemsRepo.js
// All DB queries related to "items" (barcodes) live here.
// Server uses this to generate each player's random list at game start.

const db = require("./db");

// We pick a random set of barcode items.
// - barcode_number is the UPC (TEXT)
// - title is what we can show on client UI
// We also grab some extra fields in case the frontend wants them later (image, price).
function getRandomBarcodes(limit) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        barcode_number AS upc,
        title,
        category,
        description,
        image,
        price,
        link
      FROM BARCODES
      ORDER BY RANDOM()
      LIMIT ?
    `;

    db.all(sql, [limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}



// Functions to increment player statistics
function playerLostGame(playerId, scanCount) {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE USER_STATS
      SET games_played = games_played + 1
      , items_scanned = items_scanned + ?
      WHERE userid = ?
    `;
    db.run(sql, [scanCount, playerId], function(err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
}

function playerWonGame(playerId, scanCount, time) {
  console.log(`Updating stats for player ${playerId}: scanCount=${scanCount}, time=${time}`);
  return new Promise((resolve, reject) => {
    const requestsql = `
    SELECT best_time FROM USER_STATS WHERE userid = ?
    `;
    db.get(requestsql, [playerId], (err, row) => {
      if (err) return reject(err);
      const bestTime = row ? row.best_time : null;
      const newBestTime = bestTime === null || time < bestTime ? time : bestTime;
      const sql = `
        UPDATE USER_STATS
        SET games_played = games_played + 1
        , games_won = games_won + 1
        , items_scanned = items_scanned + ?
        , best_time = ?
        WHERE userid = ?
      `;
      db.run(sql, [scanCount, newBestTime, playerId], function(err) {
        if (err) return reject(err);
        resolve(this.changes);
      });
    });
  });
}


module.exports = { getRandomBarcodes, playerLostGame, playerWonGame };