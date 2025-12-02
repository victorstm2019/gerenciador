const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.sqlite');

console.log('=== TESTING WITH CORRECT DATABASE ===\n');

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
    db.all('SELECT client_code, installment_id, status FROM queue_items LIMIT 5', [], (err2, rows2) => {
        if (err2) {
            console.error('Error:', err2);
            return;
        }
        console.log('Count:', rows2.length);
        rows2.forEach((row, idx) => {
            console.log(`  ${idx + 1}. code=${row.client_code}, inst=${row.installment_id}, status=${row.status}`);
        });

        console.log('\n=== TESTING JOIN QUERY ===');
        const query = `
            SELECT 
                q.id,
                q.client_code,
                q.installment_id,
                q.status as original_status,
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
            LIMIT 10
        `;

        db.all(query, [], (err3, rows3) => {
            if (err3) {
                console.error('Error:', err3);
                db.close();
                return;
            }
            console.log('Results:', rows3.length);
            const blockedCount = rows3.filter(r => r.computed_status === 'BLOCKED').length;
            console.log('Blocked items:', blockedCount);

            rows3.forEach((row, idx) => {
                console.log(`\n  Item ${idx + 1}:`);
                console.log(`    code=${row.client_code}, inst=${row.installment_id}`);
                console.log(`    original=${row.original_status}, computed=${row.computed_status}`);
                if (row.blocked_inst_id || row.blocked_client_id) {
                    console.log(`    ⚠️  BLOCKED: inst_id=${row.blocked_inst_id}, client_id=${row.blocked_client_id}`);
                }
            });
            db.close();
        });
    });
});
