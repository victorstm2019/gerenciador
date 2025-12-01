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

  // Add auto_send_enabled column if it doesn't exist
  db.all("PRAGMA table_info(message_config)", (err, columns) => {
    if (!err) {
      const columnNames = columns.map(col => col.name);
      if (!columnNames.includes('auto_send_enabled')) {
        db.run("ALTER TABLE message_config ADD COLUMN auto_send_enabled INTEGER DEFAULT 0");
        console.log("Added auto_send_enabled column to message_config");
      }
      if (!columnNames.includes('reminder_repeat_times')) {
        db.run("ALTER TABLE message_config ADD COLUMN reminder_repeat_times INTEGER DEFAULT 0");
        console.log("Added reminder_repeat_times column to message_config");
      }
      if (!columnNames.includes('reminder_repeat_interval_days')) {
        db.run("ALTER TABLE message_config ADD COLUMN reminder_repeat_interval_days INTEGER DEFAULT 3");
        console.log("Added reminder_repeat_interval_days column to message_config");
      }
      if (!columnNames.includes('overdue_repeat_times')) {
        db.run("ALTER TABLE message_config ADD COLUMN overdue_repeat_times INTEGER DEFAULT 0");
        console.log("Added overdue_repeat_times column to message_config");
      }
      if (!columnNames.includes('overdue_repeat_interval_days')) {
        db.run("ALTER TABLE message_config ADD COLUMN overdue_repeat_interval_days INTEGER DEFAULT 7");
        console.log("Added overdue_repeat_interval_days column to message_config");
      }
    }
  });

  // Queue Items Table - Expanded for send queue management
  db.run(`CREATE TABLE IF NOT EXISTS queue_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_code TEXT,
    client_name TEXT,
    cpf TEXT,
    phone TEXT,
    installment_id TEXT,
    installment_value TEXT,
    due_date TEXT,
    scheduled_date TEXT,
    sent_date TEXT,
    error_date TEXT,
    status TEXT DEFAULT 'PENDING',
    message_content TEXT,
    message_type TEXT,
    send_mode TEXT DEFAULT 'AUTO',
    selected_for_send INTEGER DEFAULT 0,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Add new columns to queue_items if they don't exist
  db.all("PRAGMA table_info(queue_items)", (err, columns) => {
    if (!err) {
      const columnNames = columns.map(col => col.name);

      if (!columnNames.includes('client_code')) {
        db.run("ALTER TABLE queue_items ADD COLUMN client_code TEXT");
      }
      if (!columnNames.includes('phone')) {
        db.run("ALTER TABLE queue_items ADD COLUMN phone TEXT");
      }
      if (!columnNames.includes('installment_id')) {
        db.run("ALTER TABLE queue_items ADD COLUMN installment_id TEXT");
      }
      if (!columnNames.includes('message_content')) {
        db.run("ALTER TABLE queue_items ADD COLUMN message_content TEXT");
      }
      if (!columnNames.includes('message_type')) {
        db.run("ALTER TABLE queue_items ADD COLUMN message_type TEXT");
      }
      if (!columnNames.includes('send_mode')) {
        db.run("ALTER TABLE queue_items ADD COLUMN send_mode TEXT DEFAULT 'AUTO'");
      }
      if (!columnNames.includes('selected_for_send')) {
        db.run("ALTER TABLE queue_items ADD COLUMN selected_for_send INTEGER DEFAULT 0");
      }
      if (!columnNames.includes('error_message')) {
        db.run("ALTER TABLE queue_items ADD COLUMN error_message TEXT");
      }
      if (!columnNames.includes('created_at')) {
        db.run("ALTER TABLE queue_items ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
      }
    }
  });

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

  // Error Logs Table
  db.run(`CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    tipo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    detalhes TEXT,
    client_code TEXT,
    phone TEXT
  )`);


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
    blocked INTEGER DEFAULT 0,
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

  // W-API Configuration Table
  db.run(`CREATE TABLE IF NOT EXISTS wapi_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id TEXT NOT NULL,
    bearer_token TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Field Mappings Table (for mapping message variables to database columns)
  db.run(`CREATE TABLE IF NOT EXISTS field_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_variable TEXT NOT NULL UNIQUE,
    database_column TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert default field mappings if table is empty
  db.get("SELECT count(*) as count FROM field_mappings", (err, row) => {
    if (!err && row.count === 0) {
      const stmt = db.prepare("INSERT INTO field_mappings (message_variable, database_column) VALUES (?, ?)");
      stmt.run('@codigocliente', 'codigocliente');
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
      stmt.finalize();
      console.log("Default field mappings inserted.");
    }
  });

  // Add columns to blocked_clients if they don't exist
  db.all("PRAGMA table_info(blocked_clients)", (err, columns) => {
    if (!err) {
      const columnNames = columns.map(col => col.name);

      if (!columnNames.includes('block_type')) {
        db.run("ALTER TABLE blocked_clients ADD COLUMN block_type TEXT DEFAULT 'client'");
      }
      if (!columnNames.includes('installment_id')) {
        db.run("ALTER TABLE blocked_clients ADD COLUMN installment_id TEXT");
      }
      if (!columnNames.includes('client_code')) {
        db.run("ALTER TABLE blocked_clients ADD COLUMN client_code TEXT");
      }
    }
  });
});

module.exports = db;
