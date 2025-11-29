const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.get('SELECT * FROM message_config LIMIT 1', (err, row) => {
    if (err) {
        console.error('Erro:', err);
    } else {
        console.log('Configuração atual no banco:');
        console.log(JSON.stringify(row, null, 2));
    }
    db.close();
});
