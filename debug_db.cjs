const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.db');

console.log('=== BLOCKED CLIENTS ===');
db.all('SELECT * FROM blocked_clients', [], (err, rows) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log('Count:', rows.length);
    if (rows.length > 0) {
        console.log('Sample:', rows[0]);
    }

    console.log('\n=== QUEUE ITEMS ===');
    db.all('SELECT * FROM queue_items LIMIT 3', [], (err2, rows2) => {
        if (err2) {
            console.error('Error:', err2);
            return;
        }
        console.log('Count:', rows2.length);
        if (rows2.length > 0) {
            console.log('Sample:', rows2[0]);
        }

        console.log('\n=== TESTING JOIN QUERY ===');
        const query = `
            SELECT 
                q.*,
                b_inst.id as blocked_inst_id,
                b_client.id as blocked_client_id,
                CASE 
                    WHEN b_inst.id IS NOT NULL THEN 'BLOCKED'
                    WHEN b_client.id IS NOT NULL THEN 'BLOCKED'
                    ELSE q.status 
                END as computed_status
            FROM queue_items q
            LEFT JOIN blocked_clients b_inst ON b_inst.block_type = 'installment' AND b_inst.installment_id = q.installment_id
            LEFT JOIN blocked_clients b_client ON b_client.block_type = 'client' AND b_client.client_code = q.client_code
            LIMIT 5
        `;

        db.all(query, [], (err3, rows3) => {
            if (err3) {
                console.error('Error:', err3);
                db.close();
                return;
            }
            console.log('Results:', rows3.length);
            rows3.forEach((row, idx) => {
                console.log(`\nItem ${idx + 1}:`);
                console.log('  client_code:', row.client_code);
                console.log('  installment_id:', row.installment_id);
                console.log('  original status:', row.status);
                console.log('  computed_status:', row.computed_status);
                console.log('  blocked_inst_id:', row.blocked_inst_id);
                console.log('  blocked_client_id:', row.blocked_client_id);
            });
            db.close();
        });
    });
});
