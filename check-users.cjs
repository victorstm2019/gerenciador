const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Checking users table...\n');

db.all("SELECT username, password, role, first_login FROM users", (err, rows) => {
    if (err) {
        console.error('Error:', err.message);
        db.close();
        return;
    }

    if (rows.length === 0) {
        console.log('No users found! Creating default users...\n');

        const stmt = db.prepare("INSERT INTO users (username, password, role, permissions, first_login) VALUES (?, ?, ?, ?, ?)");

        // Administrador padrão
        stmt.run('administrador', 'hiperadm', 'admin', JSON.stringify(['connections', 'messages', 'queue', 'logs', 'permissions']), 1);

        // Usuários de exemplo (compatibilidade)
        stmt.run('admin', 'admin123', 'admin', JSON.stringify(['connections', 'messages', 'queue', 'logs', 'permissions']), 0);
        stmt.run('user', 'user123', 'user', JSON.stringify(['connections', 'messages', 'queue']), 0);

        stmt.finalize(() => {
            console.log('Default users created!\n');

            // Show users again
            db.all("SELECT username, password, role, first_login FROM users", (err, rows) => {
                if (!err) {
                    console.log('Users in database:');
                    rows.forEach(row => {
                        console.log(`- ${row.username} (${row.role}) - password: ${row.password} - first_login: ${row.first_login}`);
                    });
                }
                db.close();
            });
        });
    } else {
        console.log('Users in database:');
        rows.forEach(row => {
            console.log(`- ${row.username} (${row.role}) - password: ${row.password} - first_login: ${row.first_login}`);
        });
        db.close();
    }
});
