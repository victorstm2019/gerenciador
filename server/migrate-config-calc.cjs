const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Migrating message_config table...');

db.serialize(() => {
    // Add interest_rate column
    db.run("ALTER TABLE message_config ADD COLUMN interest_rate REAL DEFAULT 0", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column interest_rate already exists');
            } else {
                console.error('Error adding interest_rate column:', err.message);
            }
        } else {
            console.log('Added interest_rate column');
        }
    });

    // Add penalty_rate column
    db.run("ALTER TABLE message_config ADD COLUMN penalty_rate REAL DEFAULT 0", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column penalty_rate already exists');
            } else {
                console.error('Error adding penalty_rate column:', err.message);
            }
        } else {
            console.log('Added penalty_rate column');
        }
    });

    // Add base_value_type column
    db.run("ALTER TABLE message_config ADD COLUMN base_value_type TEXT DEFAULT 'valorbrutoparcela'", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column base_value_type already exists');
            } else {
                console.error('Error adding base_value_type column:', err.message);
            }
        } else {
            console.log('Added base_value_type column');
        }
    });
});

db.close(() => {
    console.log('Migration completed.');
});
