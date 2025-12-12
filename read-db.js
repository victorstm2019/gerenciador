const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/database.sqlite');

db.get('SELECT * FROM message_config LIMIT 1', (err, row) => {
  if (err) {
    console.error('Erro:', err);
  } else {
    console.log(JSON.stringify(row, null, 2));
  }
  db.close();
});
