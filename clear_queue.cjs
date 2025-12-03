const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Limpando fila de mensagens...');

db.run('DELETE FROM queue_items', (err) => {
    if (err) {
        console.error('Erro ao limpar:', err);
    } else {
        console.log('✅ Fila limpa com sucesso!');
        console.log('\nAgora:');
        console.log('1. Vá na aplicação');
        console.log('2. Clique em "Gerar Lembretes"');
        console.log('3. As novas mensagens terão a descrição');
    }
    db.close();
});
