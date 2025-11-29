const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Corrigindo ordem dos mapeamentos...');

db.serialize(() => {
    // Deletar TODOS os mapeamentos
    db.run("DELETE FROM field_mappings", (err) => {
        if (err) {
            console.error('Erro:', err);
            return;
        }
        console.log('✓ Mapeamentos antigos removidos');
    });

    // Inserir na ORDEM EXATA especificada
    const stmt = db.prepare("INSERT INTO field_mappings (message_variable, database_column) VALUES (?, ?)");

    // ORDEM CORRETA: 1-8 esquerda, 9-15 direita
    stmt.run('@codigocliente', 'codigocliente');      // 1
    stmt.run('@nomecliente', 'nomecliente');          // 2
    stmt.run('@cpfcliente', 'cpfcliente');            // 3
    stmt.run('@fone1', 'fone1');                      // 4
    stmt.run('@fone2', 'fone2');                      // 5
    stmt.run('@descricaoparcela', 'descricaoparcela');// 6
    stmt.run('@emissaoparcela', 'emissao');           // 7
    stmt.run('@vencimentoparcela', 'vencimento');     // 8
    stmt.run('@valorbrutoparcela', 'valorbrutoparcela'); // 9
    stmt.run('@desconto', 'desconto');                // 10
    stmt.run('@juros', 'juros');                      // 11
    stmt.run('@multa', 'multa');                      // 12
    stmt.run('@valorfinalparcela', 'valorfinalparcela'); // 13
    stmt.run('@valortotaldevido', 'valortotaldevido');// 14
    stmt.run('@totalvencido', 'totalvencido');        // 15

    stmt.finalize((err) => {
        if (err) {
            console.error('Erro:', err);
        } else {
            console.log('\n✅ ORDEM CORRIGIDA!\n');

            db.all("SELECT * FROM field_mappings ORDER BY id", (err, rows) => {
                if (!err) {
                    console.log('ESQUERDA (1-8):');
                    rows.slice(0, 8).forEach((row, idx) => {
                        console.log(`  ${idx + 1}. ${row.message_variable.padEnd(22)} = ${row.database_column}`);
                    });
                    console.log('\nDIREITA (9-15):');
                    rows.slice(8).forEach((row, idx) => {
                        console.log(`  ${idx + 9}. ${row.message_variable.padEnd(22)} = ${row.database_column}`);
                    });
                }
                db.close();
            });
        }
    });
});
