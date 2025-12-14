const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.sqlite');

db.all("SELECT * FROM users", (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log('USUÁRIOS NO BANCO:');
        console.log(rows);
    }
    db.close();
});
