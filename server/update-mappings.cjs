const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Atualizando mapeamentos de campos...');

db.serialize(() => {
    // Limpar mapeamentos existentes
    db.run("DELETE FROM field_mappings", (err) => {
        if (err) {
            console.error('Erro ao limpar mapeamentos:', err);
            return;
        }
        console.log('Mapeamentos antigos removidos.');
    });

    // Inserir novos mapeamentos na ordem especificada
    const stmt = db.prepare("INSERT INTO field_mappings (message_variable, database_column) VALUES (?, ?)");

    stmt.run('@codigocliente', 'codigocliente');
    stmt.run('@numeroparcela', 'numeroparcela');
    stmt.run('@sequenciavenda', 'sequenciavenda');
    stmt.run('@nomecliente', 'nomecliente');
    stmt.run('@cpfcliente', 'cpfcliente');
    stmt.run('@fone1', 'fone1');
    stmt.run('@fone2', 'fone2');
    stmt.run('@descricaoparcela', 'descricaoparcela');
    stmt.run('@emissaoparcela', 'emissao');
    stmt.run('@vencimentoparcela', 'vencimento');
    stmt.run('@valorbrutoparcela', 'valorbrutoparcela');
    stmt.run('@desconto', 'desconto');
    stmt.run('@juros', 'juros');
    stmt.run('@multa', 'multa');
    stmt.run('@valorfinalparcela', 'valorfinalparcela');
    stmt.run('@valortotaldevido', 'valortotaldevido');
    stmt.run('@totalvencido', 'totalvencido');

    stmt.finalize((err) => {
        if (err) {
            console.error('Erro ao inserir mapeamentos:', err);
        } else {
            console.log('✅ 17 mapeamentos inseridos com sucesso!');
            console.log('\nMapeamentos configurados:');

            db.all("SELECT * FROM field_mappings ORDER BY id", (err, rows) => {
                if (!err) {
                    rows.forEach((row, idx) => {
                        console.log(`${idx + 1}. ${row.message_variable} = ${row.database_column}`);
                    });
                }
                db.close();
            });
        }
    });
});
