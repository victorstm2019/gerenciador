const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.run("UPDATE message_config SET last_auto_run = NULL WHERE id = 1", function(err) {
    if (err) {
        console.error('Erro:', err.message);
    } else {
        console.log('✅ Data de execução do agendamento limpa com sucesso!');
        console.log('O agendador irá executar novamente no próximo intervalo (30 minutos).');
    }
    db.close();
});
