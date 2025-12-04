const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Creating duplicate_logs table...");
    db.run(`CREATE TABLE IF NOT EXISTS duplicate_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id TEXT,
        client_code TEXT,
        client_name TEXT,
        due_date TEXT,
        installment_value TEXT,
        message_type TEXT,
        existing_queue_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error("Error creating table:", err);
        } else {
            console.log("Table duplicate_logs created successfully!");
        }
    });
});
