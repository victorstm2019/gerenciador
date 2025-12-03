const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
});

db.all('SELECT * FROM saved_queries', (err, rows) => {
    if (err) {
        console.error('Error reading saved_queries:', err.message);
    } else {
        console.log(JSON.stringify(rows, null, 2));
    }
    db.close();
});
