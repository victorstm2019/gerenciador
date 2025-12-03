const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('server/database.sqlite');

db.all('SELECT id, client_name, description FROM queue_items ORDER BY id DESC LIMIT 10', (err, rows) => {
    if (err) {
        console.error('Erro:', err);
    } else {
        console.log('Itens no banco:');
        rows.forEach(row => {
            console.log(`ID: ${row.id}, Cliente: ${row.client_name}, Descrição: "${row.description || '(vazio)'}"`);
        });
    }
    db.close();
});
