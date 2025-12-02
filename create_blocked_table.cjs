const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.db');

const createTableSQL = `
CREATE TABLE IF NOT EXISTS blocked_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL,
    client_name TEXT,
    client_code TEXT,
    installment_id TEXT,
    reason TEXT,
    block_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`;

db.run(createTableSQL, (err) => {
    if (err) {
        console.error('Error creating table:', err);
    } else {
        console.log('✅ Table blocked_clients created successfully!');
    }
    db.close();
});
