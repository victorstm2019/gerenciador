const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('server/database.sqlite');

db.get('SELECT query_text FROM saved_queries ORDER BY id DESC LIMIT 1', (err, row) => {
    if (err) {
        console.error('Erro:', err);
    } else if (row) {
        console.log('Query salva no banco:');
        console.log('---');
        console.log(row.query_text);
        console.log('---');

        // Verificar se tem "descricaoparcela"
        if (row.query_text.includes('descricaoparcela') || row.query_text.includes('Descricao')) {
            console.log('\n✅ Query CONTÉM campo de descrição');
        } else {
            console.log('\n❌ Query NÃO CONTÉM campo de descrição!');
        }
    } else {
        console.log('Nenhuma query salva encontrada');
    }
    db.close();
});
