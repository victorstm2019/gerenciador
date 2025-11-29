const sqlite3 = require('sqlite3').verbose();

const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Checking for blocked column in users table...');
    db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) {
            console.error('Error getting table info:', err);
            db.close();
            return;
        }

        const hasBlocked = rows.some(row => row.name === 'blocked');
        if (!hasBlocked) {
            console.log('Adding blocked column...');
            db.run("ALTER TABLE users ADD COLUMN blocked INTEGER DEFAULT 0", (err) => {
                if (err) {
                    console.error('Error adding column:', err);
                } else {
                    console.log('Column blocked added successfully.');
                }
                db.close();
            });
        } else {
            console.log('Column blocked already exists.');
            db.close();
        }
    });
});
