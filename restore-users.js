const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.sqlite');

db.serialize(() => {
    const stmt = db.prepare("INSERT OR IGNORE INTO users (username, password, role, permissions, first_login) VALUES (?, ?, ?, ?, ?)");
    
    stmt.run('administrador', 'hiperadm', 'admin', JSON.stringify(['connections', 'messages', 'queue', 'logs', 'permissions']), 1);
    stmt.run('admin', 'admin123', 'admin', JSON.stringify(['connections', 'messages', 'queue', 'logs', 'permissions']), 0);
    stmt.run('user', 'user123', 'user', JSON.stringify(['queue', 'logs']), 0);
    
    stmt.finalize(() => {
        console.log('Usuários restaurados com sucesso!');
        db.close();
    });
});
