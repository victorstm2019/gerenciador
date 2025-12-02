const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.sqlite');

console.log('Looking for items that match the blocked entry...\n');

db.all(`
    SELECT * FROM queue_items 
    WHERE client_code = '32' OR installment_id = '31'
`, [], (err, rows) => {
    if (err) {
        console.error('Error:', err);
        db.close();
        return;
    }

    console.log(`Found ${rows.length} items:`);
    rows.forEach((row, idx) => {
        console.log(`\n${idx + 1}. ID: ${row.id}`);
        console.log(`   client_code: ${row.client_code}`);
        console.log(`   installment_id: ${row.installment_id}`);
        console.log(`   status: ${row.status}`);
        console.log(`   client_name: ${row.client_name}`);
    });

    console.log('\n\nBlocked entry:');
    db.get('SELECT * FROM blocked_clients WHERE id = 7', [], (err2, blocked) => {
        if (!err2 && blocked) {
            console.log(`   client_code: ${blocked.client_code}`);
            console.log(`   installment_id: ${blocked.installment_id}`);
            console.log(`   block_type: ${blocked.block_type}`);
        }
        db.close();
    });
});
