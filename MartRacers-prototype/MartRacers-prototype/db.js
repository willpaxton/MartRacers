// db.js
// This file creates ONE SQLite connection that the rest of the server can reuse.
// Keeping it in one place prevents multiple DB connections and makes debugging easier.

const sqlite3 = require("sqlite3").verbose();

// Put your DB file in /data and set this path to match.
const DB_PATH = "./data/martracers.db";

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("❌ SQLite connection error:", err.message);
    return;
  }
  console.log("✅ Connected to SQLite DB:", DB_PATH);
});

module.exports = db;