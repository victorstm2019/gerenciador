const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.sqlite');

db.run("DELETE FROM queue_items", function (err) {
    if (err) {
        console.error(err.message);
    } else {
        console.log(`Deleted all ${this.changes} rows from queue_items.`);
    }
});
