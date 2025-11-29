const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Verificando colunas da tabela message_config...');

    db.all("PRAGMA table_info(message_config)", (err, rows) => {
        if (err) {
            console.error('Erro ao obter informações da tabela:', err);
            db.close();
            return;
        }

        const columns = rows.map(row => row.name);
        console.log('Colunas existentes:', columns.join(', '));

        const columnsToAdd = [
            { name: 'reminder_repeat_times', type: 'INTEGER DEFAULT 1' },
            { name: 'reminder_repeat_interval_days', type: 'INTEGER DEFAULT 3' },
            { name: 'overdue_repeat_times', type: 'INTEGER DEFAULT 1' },
            { name: 'overdue_repeat_interval_days', type: 'INTEGER DEFAULT 7' }
        ];

        let addedCount = 0;
        let toAdd = columnsToAdd.filter(col => !columns.includes(col.name));

        if (toAdd.length === 0) {
            console.log('✓ Todas as colunas de repetição já existem.');
            db.close();
            return;
        }

        console.log(`\nAdicionando ${toAdd.length} colunas...`);

        toAdd.forEach((col, index) => {
            const sql = `ALTER TABLE message_config ADD COLUMN ${col.name} ${col.type}`;
            db.run(sql, (err) => {
                if (err) {
                    console.error(`✗ Erro ao adicionar ${col.name}:`, err.message);
                } else {
                    console.log(`✓ Coluna ${col.name} adicionada com sucesso.`);
                }

                addedCount++;
                if (addedCount === toAdd.length) {
                    console.log('\n✓ Migração concluída!');
                    db.close();
                }
            });
        });
    });
});
