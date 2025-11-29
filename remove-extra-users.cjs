const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Removing extra users...\n');

db.serialize(() => {
    db.run("DELETE FROM users WHERE username IN ('admin', 'user')", function (err) {
        if (err) {
            console.error('Error deleting users:', err.message);
            return;
        }
        console.log(`Deleted ${this.changes} users.`);
    });

    db.all("SELECT username, role FROM users", (err, rows) => {
        if (err) {
            console.error('Error fetching users:', err.message);
            return;
        }
        console.log('\nRemaining users:');
        rows.forEach(row => {
            console.log(`- ${row.username} (${row.role})`);
        });
        db.close();
    });
});
