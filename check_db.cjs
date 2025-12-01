const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.sqlite');

db.all("SELECT id, client_code, client_name, cpf, installment_value, due_date, status, created_at FROM queue_items ORDER BY id DESC LIMIT 10", [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log("Items in DB:", rows);
});
