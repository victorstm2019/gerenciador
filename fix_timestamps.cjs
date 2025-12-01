const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.sqlite');

db.run("UPDATE queue_items SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL", function (err) {
    if (err) {
        console.error(err.message);
    } else {
        console.log(`Updated ${this.changes} rows with missing timestamps.`);
    }
});
