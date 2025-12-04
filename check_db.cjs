const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Check if table exists
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='duplicate_logs'", (err, rows) => {
        if (err) {
            console.error("Error checking table:", err);
            return;
        }
        console.log("Table exists check:", rows);

        if (rows.length > 0) {
            // Check columns
            db.all("PRAGMA table_info(duplicate_logs)", (err, cols) => {
                console.log("Columns:", cols);
            });

            // Check row count
            db.all("SELECT COUNT(*) as count FROM duplicate_logs", (err, rows) => {
                console.log("Row count:", rows);
            });

            // Show first 5 rows
            db.all("SELECT * FROM duplicate_logs LIMIT 5", (err, rows) => {
                console.log("First 5 rows:", rows);
            });
        }
    });
});
