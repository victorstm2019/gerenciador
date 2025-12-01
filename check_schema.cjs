const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.sqlite');

db.all("PRAGMA table_info(queue_items)", [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log("Queue Items Schema:");
    rows.forEach(row => {
        console.log(`  ${row.name} (${row.type})`);
    });
});
