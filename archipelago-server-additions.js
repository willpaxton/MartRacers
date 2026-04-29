// ============================================================
//  archipelago-server-additions.js
//
//  Add these lines to server.js (see comments below for WHERE).
//  This adds two things:
//    1. GET /archipelago          → serves archipelago.html
//    2. GET /archipelago/locations → returns JSON list of all
//       locations with their barcode and realm, so the client
//       can map scanned barcodes → Archipelago location IDs.
// ============================================================

// ── PUT THESE REQUIRES near the top of server.js ────────────
const sqlite3AP = require("sqlite3").verbose();
const DB_PATH_AP = "./data/martracers.db";

// Open a read-only connection for location lookups
const apDb = new sqlite3AP.Database(DB_PATH_AP, sqlite3AP.OPEN_READONLY, (err) => {
  if (err) console.error("❌ Archipelago DB error:", err.message);
  else     console.log("✅ Archipelago location DB ready");
});

// ── PUT THESE ROUTES after your existing app.get('/game/:id') ─

// Serve the Archipelago page
app.get("/archipelago", (req, res) => {
  res.sendFile(__dirname + "/public/archipelago.html");
});

// Serve archipelago.css (if you put it in a css/ sub-folder, adjust path)
app.get("/css/archipelago.css", (req, res) => {
  res.sendFile(__dirname + "/public/archipelago.css");
});

// Serve archipelago.js
app.get("/js/archipelago.js", (req, res) => {
  res.sendFile(__dirname + "/public/archipelago.js");
});

/**
 * GET /archipelago/locations
 *
 * Returns a JSON array of every scannable location in the game:
 * [
 *   { "name": "Great Value Cupcake Liners…", "barcode": "078742198965", "realm": "Realm of the Baked Goods and Brews" },
 *   ...
 * ]
 *
 * The client uses this to map a scanned barcode → AP location name → location ID
 * (the ID comes from the DataPackage the AP server sends on connect).
 */
app.get("/archipelago/locations", (req, res) => {
  // Category → realm mapping (must match APWorld items.py)
  const REALM_MAP = {
    "Food, Beverages & Tobacco": "Realm of the Baked Goods and Brews",
    "Home & Garden":             "Realm of the Hearth and Garden",
    "Baby & Toddler":            "Realm of the Tiny Adventurers",
    "Animals & Pet Supplies":    "Realm of the Loyal Companions",
    "Health & Beauty":           "Realm of the Wellness Wizards",
    "Arts & Entertainment":      "Realm of the Creative Spirits",
    "Toys & Games":              "Realm of Endless Play",
    "Apparel & Accessories":     "Realm of the Fashioned Ones",
    "Hardware":                  "Realm of the Builders",
    "Electronics":               "Realm of the Sparking Circuits",
    "Sporting Goods":            "Realm of the Mighty Athletes",
    "Cameras & Optics":          "Realm of the Watchful Eye",
    "Luggage & Bags":            "Realm of the Wanderers",
  };
  const DEFAULT_REALM = "Realm of the Forgotten Finds";

  const sql = `
    SELECT barcode_number AS barcode, title, category
    FROM   BARCODES
    WHERE  title IS NOT NULL
      AND  title != '***discontinued***'
    ORDER  BY category, title
  `;

  apDb.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Archipelago locations query error:", err);
      return res.status(500).json({ error: "Database error" });
    }

    // Deduplicate titles exactly the same way locations.py does
    const seen = {};
    const locations = rows.map(row => {
      const topCat = row.category ? row.category.split(" > ")[0] : "";
      const realm  = REALM_MAP[topCat] || DEFAULT_REALM;

      seen[row.title] = (seen[row.title] || 0) + 1;
      const name = seen[row.title] > 1
        ? `${row.title} (${seen[row.title]})`
        : row.title;

      return { name, barcode: row.barcode, realm };
    });

    res.json(locations);
  });
});
