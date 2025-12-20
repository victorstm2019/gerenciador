const SqlJsDatabase = require('./db-sqljs.cjs');
const path = require('path');
const fs = require('fs');

// Configuração robusta do caminho do banco
let dbDir;
const isElectron = process.versions.electron;
const isPortable = process.env.IS_PORTABLE === 'true';

// PRIORITY 1: Path set by main.cjs (CORRETO - pasta do EXE original)
if (process.env.PORTABLE_BASE_PATH) {
  dbDir = process.env.PORTABLE_BASE_PATH;
}
// PRIORITY 2: CLI argument from electron-main.cjs (fork mode)
else {
  const args = process.argv.slice(2);
  const basePathArg = args.find(arg => arg.startsWith('--base-path='));
  if (basePathArg) {
    dbDir = basePathArg.split('=')[1];
  } else if (isPortable) {
    dbDir = process.cwd();
  } else if (path.basename(process.execPath).toLowerCase().startsWith('gerenciador')) {
    dbDir = path.dirname(process.execPath);
  } else if (typeof process.pkg !== 'undefined') {
    dbDir = path.dirname(process.execPath);
  } else {
    dbDir = path.join(__dirname, '..');
  }
}

// Garante que o diretório existe
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.resolve(dbDir, 'database.sqlite');
// Prefer env var from main, fallback to resourcesPath (if in renderer/main), then dev assets
const resourcesPath = process.env.ELECTRON_RESOURCES_PATH || process.resourcesPath || __dirname;
const templatePath = path.join(resourcesPath, 'assets', 'template.sqlite');

// DIAGNOSTIC LOG
try {
  const diagFile = path.resolve(dbDir, 'diagnosis.txt');
  const info = `
Timestamp: ${new Date().toISOString()}
ExecPath: ${process.execPath}
DbDir: ${dbDir}
DbPath: ${dbPath}
TemplatePath: ${templatePath}
IsPortable: ${isPortable}
Env_PDIR: ${process.env.PORTABLE_EXECUTABLE_DIR}
Env_RESOURCES: ${process.env.ELECTRON_RESOURCES_PATH}
    `;
  fs.writeFileSync(diagFile, info);
} catch (e) {
  if (process.send) process.send({ type: 'error', message: `Erro ao criar diagnosis.txt em ${dbDir}: ${e.message}` });
}

// Log para debug
try {
  const logFile = path.resolve(dbDir, 'debug-startup.log');
  const msg = `[DB Init] Definindo caminho do banco para: ${dbPath}\n`;
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}`);
} catch (e) { }

// Lógica de Migração de Template (Portable)
if (!fs.existsSync(dbPath)) {
  console.log('Database not found at', dbPath);
  try {
    if (fs.existsSync(templatePath)) {
      console.log('Found template at', templatePath, 'copying to', dbPath);
      fs.copyFileSync(templatePath, dbPath);
    } else {
      console.error('Template not found at', templatePath);
      if (process.send) process.send({ type: 'error', message: `Template não encontrado em:\n${templatePath}` });
    }
  } catch (err) {
    console.error('Error copying template:', err);
    if (process.send) process.send({ type: 'error', message: `Erro ao copiar template para ${dbPath}:\n${err.message}` });
  }
}

const db = new SqlJsDatabase(dbPath);

// Inicializar banco de dados de forma assíncrona
(async () => {
  try {
    await db.init();
    console.log('Connected to the SQLite database at:', dbPath);

    // REMOVED WAL MODE - incompatible with sql.js manual persistence strategy

    // Executar criação de tabelas após inicialização
    initializeTables();
  } catch (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
})();

function initializeTables() {
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
        db.run("INSERT INTO message_config (send_time, reminder_days, reminder_msg, overdue_days, overdue_msg) VALUES (?, ?, ?, ?, ?)", ["09:00", 5, defaultReminderMsg, 3, defaultOverdueMsg], () => {
          console.log("Default message configuration inserted.");
        });
      }
    });

    // Add columns to message_config if they don't exist
    db.all("PRAGMA table_info(message_config)", (err, rows) => {
      const configColumns = rows.map(col => col.name);
      const columnsToAdd = [
        { name: 'auto_send_enabled', type: 'INTEGER DEFAULT 0' },
        { name: 'auto_send_messages', type: 'INTEGER DEFAULT 0' },
        { name: 'reminder_repeat_times', type: 'INTEGER DEFAULT 0' },
        { name: 'reminder_repeat_interval_days', type: 'INTEGER DEFAULT 3' },
        { name: 'overdue_repeat_times', type: 'INTEGER DEFAULT 0' },
        { name: 'overdue_repeat_interval_days', type: 'INTEGER DEFAULT 7' },
        { name: 'last_auto_run', type: 'DATETIME' },
        { name: 'interest_rate', type: 'REAL DEFAULT 0' },
        { name: 'penalty_rate', type: 'REAL DEFAULT 0' },
        { name: 'base_value_type', type: 'TEXT DEFAULT "valorbrutoparcela"' },
        { name: 'delay_between_messages', type: 'INTEGER DEFAULT 3' },
        { name: 'batch_size', type: 'INTEGER DEFAULT 15' },
        { name: 'batch_delay', type: 'INTEGER DEFAULT 60' },
        { name: 'max_retries', type: 'INTEGER DEFAULT 3' },
        { name: 'retry_delay', type: 'INTEGER DEFAULT 30' },
        { name: 'max_messages_per_hour', type: 'INTEGER DEFAULT 100' }
      ];

      columnsToAdd.forEach(col => {
        if (!configColumns.includes(col.name)) {
          db.run(`ALTER TABLE message_config ADD COLUMN ${col.name} ${col.type}`, () => {
            console.log(`Added ${col.name} column to message_config`);
          });
        }
      });
    });

    // Queue Items Table
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

    // Add columns to queue_items if they don't exist
    db.all("PRAGMA table_info(queue_items)", (err, rows) => {
      const queueColumns = rows.map(col => col.name);
      const queueColsToAdd = [
        { name: 'client_code', type: 'TEXT' },
        { name: 'phone', type: 'TEXT' },
        { name: 'installment_id', type: 'TEXT' },
        { name: 'message_content', type: 'TEXT' },
        { name: 'message_type', type: 'TEXT' },
        { name: 'send_mode', type: 'TEXT DEFAULT "AUTO"' },
        { name: 'selected_for_send', type: 'INTEGER DEFAULT 0' },
        { name: 'error_message', type: 'TEXT' },
        { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
        { name: 'description', type: 'TEXT' },
        { name: 'emission_date', type: 'TEXT' },
        { name: 'repeat_number', type: 'INTEGER DEFAULT 0' },
        { name: 'retry_count', type: 'INTEGER DEFAULT 0' },
        { name: 'last_retry_at', type: 'DATETIME' }
      ];

      queueColsToAdd.forEach(col => {
        if (!queueColumns.includes(col.name)) {
          db.run(`ALTER TABLE queue_items ADD COLUMN ${col.name} ${col.type}`, () => {
            console.log(`Added ${col.name} column to queue_items`);
          });
        }
      });
    });

    // Error Logs Table
    db.run(`CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    tipo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    detalhes TEXT,
    user TEXT,
    password TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

    // Log Cleanup Configuration Table
    db.run(`CREATE TABLE IF NOT EXISTS log_cleanup_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_type TEXT NOT NULL UNIQUE,
    retention_days INTEGER DEFAULT 15,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

    // Insert default cleanup configs if empty
    db.get("SELECT count(*) as count FROM log_cleanup_config", (err, row) => {
      if (row.count === 0) {
        db.run("INSERT INTO log_cleanup_config (log_type, retention_days, enabled) VALUES ('ERRO', 15, 1)");
        db.run("INSERT INTO log_cleanup_config (log_type, retention_days, enabled) VALUES ('AGENDAMENTO', 15, 1)");
        db.run("INSERT INTO log_cleanup_config (log_type, retention_days, enabled) VALUES ('INFO', 15, 1)");
        db.run("INSERT INTO log_cleanup_config (log_type, retention_days, enabled) VALUES ('DUPLICATAS', 15, 1)", () => {
          console.log("Default log cleanup configuration inserted.");
        });
      }
    });

    // Duplicate Logs Table
    db.run(`CREATE TABLE IF NOT EXISTS duplicate_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT,
    client_code TEXT,
    client_name TEXT,
    due_date TEXT,
    installment_value TEXT,
    message_type TEXT,
    existing_queue_id INTEGER,
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
        db.run("INSERT INTO users (username, password, role, permissions, first_login) VALUES (?, ?, ?, ?, ?)", ['administrador', 'hiperadm', 'admin', JSON.stringify(['connections', 'messages', 'queue', 'logs', 'permissions']), 1], () => {
          console.log("Default users inserted.");
        });
      }
    });

    // Database Connections Table (SQL Server)
    db.run(`CREATE TABLE IF NOT EXISTS db_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    host TEXT NOT NULL,
    user TEXT NOT NULL,
    password TEXT NOT NULL,
    database TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

    // W-API Configuration Table
    db.run(`CREATE TABLE IF NOT EXISTS wapi_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id TEXT NOT NULL,
    bearer_token TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

    // Field Mappings Table
    db.run(`CREATE TABLE IF NOT EXISTS field_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_variable TEXT NOT NULL UNIQUE,
    database_column TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

    // Insert default field mappings if empty
    db.get("SELECT count(*) as count FROM field_mappings", (err, row) => {
      if (row.count === 0) {
        const defaults = [
          ['@codigocliente', 'codigocliente'],
          ['@nomecliente', 'nomecliente'],
          ['@cpfcliente', 'cpfcliente'],
          ['@fone1', 'fone1'],
          ['@fone2', 'fone2'],
          ['@descricaoparcela', 'descricaoparcela'],
          ['@emissaoparcela', 'emissao'],
          ['@vencimentoparcela', 'vencimento'],
          ['@valorbrutoparcela', 'valorbrutoparcela'],
          ['@desconto', 'desconto'],
          ['@juros', 'juros'],
          ['@multa', 'multa'],
          ['@valorfinalparcela', 'valorfinalparcela'],
          ['@valortotaldevido', 'valortotaldevido'],
          ['@totalvencido', 'totalvencido']
        ];
        const stmt = db.prepare("INSERT INTO field_mappings (message_variable, database_column) VALUES (?, ?)");
        defaults.forEach(d => stmt.run(d));
        stmt.finalize(() => {
          console.log("Default field mappings inserted.");
        });
      }
    });

    // Blocked Clients
    db.run(`CREATE TABLE IF NOT EXISTS blocked_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

    // Add columns to blocked_clients if they don't exist
    db.all("PRAGMA table_info(blocked_clients)", (err, rows) => {
      const blockedColumns = rows.map(col => col.name);
      const blockedColsToAdd = [
        { name: 'block_type', type: 'TEXT DEFAULT "client"' },
        { name: 'installment_id', type: 'TEXT' },
        { name: 'client_code', type: 'TEXT' }
      ];
      blockedColsToAdd.forEach(col => {
        if (!blockedColumns.includes(col.name)) {
          db.run(`ALTER TABLE blocked_clients ADD COLUMN ${col.name} ${col.type}`);
        }
      });
    });
  });
}

db.dbPath = dbPath;
module.exports = db;