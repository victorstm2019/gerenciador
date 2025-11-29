const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database (creates file if not exists)
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Initialize tables
db.serialize(() => {
  // Message Configuration Table
  db.run(`CREATE TABLE IF NOT EXISTS message_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    send_time TEXT DEFAULT '09:00',
    reminder_enabled INTEGER DEFAULT 1,
    reminder_days INTEGER DEFAULT 5,
    reminder_msg TEXT,
    overdue_enabled INTEGER DEFAULT 1,
    overdue_days INTEGER DEFAULT 3,
    overdue_msg TEXT
  )`);

  // Insert default config if empty
  db.get("SELECT count(*) as count FROM message_config", (err, row) => {
    if (row.count === 0) {
      const defaultReminderMsg = "Olá, @nomecliente! Passando para lembrar que sua fatura no valor de R$ @valorparcela vence em @vencimentoparcela. 😊";
      const defaultOverdueMsg = "Olá, @nomecliente. Identificamos que sua fatura de R$ @valorparcela, vencida em @vencimentoparcela, ainda está em aberto. Por favor, regularize sua situação. O valor total devido é R$ @valortotaldevido.";

      const stmt = db.prepare("INSERT INTO message_config (send_time, reminder_days, reminder_msg, overdue_days, overdue_msg) VALUES (?, ?, ?, ?, ?)");
      stmt.run("09:00", 5, defaultReminderMsg, 3, defaultOverdueMsg);
      stmt.finalize();
      console.log("Default message configuration inserted.");
    }
  });

  // Queue Items Table
  db.run(`CREATE TABLE IF NOT EXISTS queue_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT,
    installment_value TEXT,
    due_date TEXT,
    scheduled_date TEXT,
    sent_date TEXT,
    error_date TEXT,
    code TEXT,
    cpf TEXT,
    status TEXT
  )`);

  // Seed Queue if empty (for demo purposes)
  db.get("SELECT count(*) as count FROM queue_items", (err, row) => {
    if (row.count === 0) {
      const stmt = db.prepare("INSERT INTO queue_items (client_name, installment_value, due_date, scheduled_date, sent_date, error_date, code, cpf, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");

      stmt.run('Ana Silva', '150,00', '30/10/2023', '25/10/2023 10:00', null, null, '10234', '123.***.***-00', 'PENDING');
      stmt.run('Carlos Pereira', '250,50', '20/10/2023', null, '24/10/2023 15:30', null, '10235', '987.***.***-00', 'SENT');
      stmt.run('Mariana Costa', '99,90', '15/10/2023', null, null, '24/10/2023 14:00', '10236', '111.***.***-44', 'ERROR');
      stmt.run('João Fernandes', '500,00', '22/10/2023', null, '24/10/2023 11:15', null, '10237', '444.***.***-55', 'SENT');

      stmt.finalize();
      console.log("Default queue items inserted.");
    }
  });

  // Blocked Clients Table
  db.run(`CREATE TABLE IF NOT EXISTS blocked_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT UNIQUE,
    client_name TEXT,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // DB Connections Table (for SQL Server)
  db.run(`CREATE TABLE IF NOT EXISTS db_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    host TEXT,
    database TEXT,
    user TEXT,
    password TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Saved Queries Table
  db.run(`CREATE TABLE IF NOT EXISTS saved_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    query_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Users Table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    permissions TEXT DEFAULT '[]',
    first_login INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert default users if empty
  db.get("SELECT count(*) as count FROM users", (err, row) => {
    if (row.count === 0) {
      const stmt = db.prepare("INSERT INTO users (username, password, role, permissions, first_login) VALUES (?, ?, ?, ?, ?)");

      // Administrador padrão
      stmt.run('administrador', 'hiperadm', 'admin', JSON.stringify(['connections', 'messages', 'queue', 'logs', 'permissions']), 1);

      // Usuários de exemplo (compatibilidade)


      stmt.finalize();
      console.log("Default users inserted.");
    }
  });
});

module.exports = db;
