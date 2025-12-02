const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.sqlite');

console.log('Creating test item for installment 31...\n');

// Insert a queue item for the blocked installment
db.run(`
    INSERT INTO queue_items (
        client_code, client_name, cpf, phone, installment_id,
        installment_value, due_date, message_content, message_type,
        send_mode, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)
`, [
    '32',
    'ALCIONE RODRIGUES DOS SANTOS',
    '123.456.789-00',
    '11999999999',
    '31',  // This matches the blocked installment_id
    '150.00',
    '2025-12-15',
    'Test message for blocked installment',
    'reminder',
    'MANUAL'
], function (err) {
    if (err) {
        console.error('Error inserting:', err);
        db.close();
        return;
    }

    console.log(`✅ Test item created with ID: ${this.lastID}\n`);

    // Now test the JOIN query again
    console.log('Testing JOIN query with the new item...\n');
    const query = `
        SELECT 
            q.id,
            q.client_code,
            q.installment_id,
            q.client_name,
            q.status as original_status,
            CASE 
                WHEN b_inst.id IS NOT NULL THEN 'BLOCKED'
                WHEN b_client.id IS NOT NULL THEN 'BLOCKED'
                ELSE q.status 
            END as computed_status
        FROM queue_items q
        LEFT JOIN blocked_clients b_inst ON b_inst.block_type = 'installment' AND b_inst.installment_id = q.installment_id
        LEFT JOIN blocked_clients b_client ON b_client.block_type = 'client' AND b_client.client_code = q.client_code
        WHERE q.client_code = '32'
    `;

    db.all(query, [], (err2, rows) => {
        if (err2) {
            console.error('Error:', err2);
            db.close();
            return;
        }

        console.log(`Found ${rows.length} items for client 32:\n`);
        rows.forEach((row, idx) => {
            console.log(`${idx + 1}. ID: ${row.id}`);
            console.log(`   installment_id: ${row.installment_id}`);
            console.log(`   original_status: ${row.original_status}`);
            console.log(`   computed_status: ${row.computed_status}`);
            if (row.computed_status === 'BLOCKED') {
                console.log(`   ✅ THIS ITEM IS BLOCKED!`);
            }
            console.log('');
        });

        db.close();
    });
});
