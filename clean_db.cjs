const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.sqlite');

// Delete items where client_name is null or empty, or installment_value is null
db.run("DELETE FROM queue_items WHERE client_code IS NULL OR client_name IS NULL OR installment_value IS NULL", function (err) {
    if (err) {
        console.error(err.message);
    } else {
        console.log(`Deleted ${this.changes} rows with invalid data.`);
    }
});
