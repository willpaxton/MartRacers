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

module.exports = { getRandomBarcodes };