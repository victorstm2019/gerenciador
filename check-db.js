const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.sqlite');

db.all("SELECT id, installment_id, client_code, client_name FROM queue_items LIMIT 3", (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log('DADOS DO BANCO:');
        rows.forEach(row => {
            console.log(`ID: ${row.id}, INSTALLMENT_ID: ${row.installment_id}, CLIENT: ${row.client_code} - ${row.client_name}`);
        });
    }
    db.close();
});
