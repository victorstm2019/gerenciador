const express = require('express');
const https = require('https');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db.cjs');
const sql = require('mssql');
const crypto = require('crypto');

// This agent will be used to bypass SSL certificate verification for the W-API.
// It's insecure but isolates the risk instead of affecting the whole process.
const insecureAgent = new https.Agent({
    rejectUnauthorized: false
});

const app = express();
const PORT = 3001;

// Session storage (in-memory)
const activeSessions = new Map(); // Map<token, { userId, username, createdAt }>

// Create SYSTEM identity for internal scheduler tasks
const SYSTEM_TOKEN = "SYSTEM-INTERNAL-TOKEN-" + crypto.randomUUID();
activeSessions.set(SYSTEM_TOKEN, {
    userId: 0,
    username: 'SYSTEM',
    role: 'system',
    createdAt: new Date()
});

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Aumentado de 100kb (padrão) para 50mb
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Authentication Middleware
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    const session = activeSessions.get(token);

    if (!session) {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    // Attach user info to request
    req.user = session;
    next();
};

// Utility function to format Brazilian phone numbers
const formatBrazilianPhone = (phone) => {
    if (!phone) return null;

    // Convert to string and extract only the first phone if there are multiple
    let phoneStr = phone.toString().trim();

    // Common separators for multiple phones: / - | ; ,
    const separators = [' / ', '/', ' - ', ' | ', '|', ';', ',', '  '];
    for (const sep of separators) {
        if (phoneStr.includes(sep)) {
            const parts = phoneStr.split(sep).filter(p => p.trim().length > 0);
            if (parts.length > 0) {
                phoneStr = parts[0].trim();
                break;
            }
        }
    }

    // Remove all non-numeric characters
    let cleaned = phoneStr.replace(/\D/g, '');

    // CHECK and REMOVE country code 55 if present
    if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
        cleaned = cleaned.substring(2);
    }

    // Now cleaned should be 10 or 11 digits (DDD + Number)

    // If has 11 digits (DDD + 9 digits), return as is (without 55)
    if (cleaned.length === 11) {
        return cleaned;
    }

    // If has 10 digits (DDD + 8 digits), add 9? User didn't explicitly ask to add 9, but previous logic did.
    // Let's keep the logic of adding 9 if missing, but NO 55.
    if (cleaned.length === 10) {
        const ddd = cleaned.substring(0, 2);
        const number = cleaned.substring(2);
        return ddd + '9' + number;
    }

    // Invalid format
    // console.warn(`Invalid phone: ${phone} (${cleaned.length} digits)`);
    return cleaned; // Return whatever we have if it doesn't match standard
};

// --- Authentication API ---

// Login endpoint
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });

        // In a real app, use hashed passwords (bcrypt). Here it seems plaintext based on logs.
        if (user.password !== password) {
            return res.status(401).json({ error: 'Senha incorreta' });
        }

        // Generate token
        const token = crypto.randomUUID();
        activeSessions.set(token, {
            userId: user.id,
            username: user.username,
            role: user.role,
            createdAt: new Date()
        });

        // Return user info + token
        // Permissions is JSON string in DB
        let permissions = [];
        try {
            permissions = JSON.parse(user.permissions || '[]');
        } catch (e) {
            console.error('Error parsing permissions', e);
        }

        res.json({
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: permissions,
            first_login: user.first_login,
            token: token
        });
    });
});

// List users for login dropdown
app.get('/api/users/list', (req, res) => {
    db.all("SELECT id, username, role FROM users WHERE blocked = 0", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows || []);
    });
});


// Reset password endpoint
app.post('/api/auth/reset-password', authMiddleware, (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Nome de usuário é obrigatório' });
    }

    // Reset to default password (same as username)
    db.run("UPDATE users SET password = ?, first_login = 1 WHERE username = ?", [username, username], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json({ message: 'Senha resetada com sucesso' });
    });
});

// Logout endpoint (optional, for future use)
app.post('/api/auth/logout', authMiddleware, (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader.substring(7);

    activeSessions.delete(token);
    res.json({ message: 'Logout realizado com sucesso' });
});

// --- Message Config API ---

// Get Config
app.get('/api/config', authMiddleware, (req, res) => {
    db.get("SELECT * FROM message_config LIMIT 1", (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row);
    });
});

// Update Config
app.post('/api/config', authMiddleware, (req, res) => {
    const {
        send_time,
        auto_send_enabled,
        reminder_enabled,
        reminder_days,
        reminder_msg,
        reminder_repeat_times,
        reminder_repeat_interval_days,
        overdue_enabled,
        overdue_days,
        overdue_msg,
        overdue_repeat_times,
        overdue_repeat_interval_days,
        interest_rate,
        penalty_rate,
        base_value_type
    } = req.body;

    // We assume there's always one row with ID 1 (created in db.js)
    const sqlQuery = `UPDATE message_config SET 
    send_time = ?, 
    auto_send_enabled = ?,
    reminder_enabled = ?, 
    reminder_days = ?, 
    reminder_msg = ?,
    reminder_repeat_times = ?,
    reminder_repeat_interval_days = ?,
    overdue_enabled = ?, 
    overdue_days = ?, 
    overdue_msg = ?,
    overdue_repeat_times = ?,
    overdue_repeat_interval_days = ?,
    interest_rate = ?,
    penalty_rate = ?,
    base_value_type = ?
    WHERE id = 1`;

    db.run(sqlQuery, [
        send_time,
        auto_send_enabled ? 1 : 0,
        reminder_enabled ? 1 : 0,
        reminder_days,
        reminder_msg,
        reminder_repeat_times,
        reminder_repeat_interval_days,
        overdue_enabled ? 1 : 0,
        overdue_days,
        overdue_msg,
        overdue_repeat_times,
        overdue_repeat_interval_days,
        interest_rate,
        penalty_rate,
        base_value_type
    ], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Configuração atualizada com sucesso", changes: this.changes });
    });
});

// --- Database Connection API ---

// Get Connection Config
app.get('/api/connection', authMiddleware, (req, res) => {
    db.get("SELECT * FROM db_connections ORDER BY id DESC LIMIT 1", (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (row) {
            // Don't send password back for security, or send a placeholder
            // For now, sending it as is because the frontend might need it to show "configured" state
            // or we can just send "configured: true"
            res.json(row);
        } else {
            res.json({});
        }
    });
});

// Save Connection Config
app.post('/api/connection', authMiddleware, (req, res) => {
    const { host, user, password, database } = req.body;

    // Check if config exists
    db.get("SELECT id FROM db_connections LIMIT 1", (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (row) {
            // Update existing config
            db.run("UPDATE db_connections SET host = ?, user = ?, password = ?, database = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [host, user, password, database, row.id], function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ message: "Configuração de banco de dados atualizada" });
                });
        } else {
            // Insert new config
            db.run("INSERT INTO db_connections (host, user, password, database) VALUES (?, ?, ?, ?)",
                [host, user, password, database], function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ message: "Configuração de banco de dados salva", id: this.lastID });
                });
        }
    });
});

// Test Connection
app.post('/api/connection/test', authMiddleware, async (req, res) => {
    const { host, user, password, database } = req.body;

    const config = {
        user: user,
        password: password,
        server: host,
        database: database,
        options: {
            encrypt: false, // Use true for Azure
            trustServerCertificate: true // Change to false for production
        }
    };

    try {
        let pool = await sql.connect(config);
        await pool.close();
        res.json({ success: true, message: "Conexão bem sucedida!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- Saved Queries API ---

// Save Query
app.post('/api/query/save', authMiddleware, (req, res) => {
    const { name, query_text } = req.body;
    db.run("INSERT INTO saved_queries (name, query_text) VALUES (?, ?)", [name, query_text], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, name, query_text });
    });
});

// Get Saved Queries
app.get('/api/query/saved', authMiddleware, (req, res) => {
    db.all("SELECT * FROM saved_queries ORDER BY created_at DESC LIMIT 10", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Delete Saved Query
app.delete('/api/query/saved/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM saved_queries WHERE id = ?", [id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Query deleted", changes: this.changes });
    });
});

// Execute Query
app.post('/api/query/execute', authMiddleware, async (req, res) => {
    const { query } = req.body;

    // Get credentials from DB
    db.get("SELECT * FROM db_connections ORDER BY id DESC LIMIT 1", async (err, row) => {
        if (err || !row) {
            res.status(400).json({ error: "No database connection configured" });
            return;
        }

        const config = {
            user: row.user,
            password: row.password,
            server: row.host,
            database: row.database,
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        };

        let pool;
        try {
            pool = await sql.connect(config);
            const result = await pool.request().query(query);
            res.json(result.recordset);
        } catch (err) {
            res.status(500).json({ error: err.message });
        } finally {
            if (pool) {
                await pool.close();
            }
        }
    });
});

// --- Authentication API ---

// List all usernames (for login selection)
app.get('/api/users/list', (req, res) => {
    db.all("SELECT id, username, role FROM users ORDER BY username", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(401).json({ error: "Credenciais inválidas" });
            return;
        }
        if (row.blocked === 1) {
            res.status(403).json({ error: "Usuário bloqueado. Entre em contato com o administrador." });
            return;
        }
        // Parse permissions JSON
        const user = {
            ...row,
            permissions: JSON.parse(row.permissions || '[]')
        };
        res.json(user);
    });
});

// Reset password to default (hiperadm)
app.post('/api/auth/reset-password', (req, res) => {
    const { username } = req.body;
    db.run("UPDATE users SET password = ?, first_login = 1 WHERE username = ?", ['hiperadm', username], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: "Usuário não encontrado" });
            return;
        }
        res.json({ message: "Senha resetada para padrão" });
    });
});

// Change password (for first login or password change)
app.put('/api/users/:id/change-password', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    db.run("UPDATE users SET password = ?, first_login = 0 WHERE id = ?", [password, id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Senha alterada com sucesso" });
    });
});

// --- User Management API (for UserPermissions page) ---

// Get all users
app.get('/api/users', authMiddleware, (req, res) => {
    db.all("SELECT id, username, role, permissions, blocked FROM users ORDER BY username", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        const users = rows.map(row => ({
            ...row,
            permissions: JSON.parse(row.permissions || '[]')
        }));
        res.json(users);
    });
});

// Create new user
app.post('/api/users', authMiddleware, (req, res) => {
    const { username, password, role, permissions } = req.body;
    const permissionsJson = JSON.stringify(permissions || []);

    db.run("INSERT INTO users (username, password, role, permissions, first_login) VALUES (?, ?, ?, ?, 1)",
        [username, password, role, permissionsJson], function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({
                id: this.lastID,
                username,
                role,
                permissions: permissions || []
            });
        });
});

// Update user permissions
app.put('/api/users/:id/permissions', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { permissions } = req.body;
    const permissionsJson = JSON.stringify(permissions || []);

    db.run("UPDATE users SET permissions = ? WHERE id = ?", [permissionsJson, id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Permissions updated", changes: this.changes });
    });
});

// Update user password (from UserPermissions page)
app.put('/api/users/:id/password', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    db.run("UPDATE users SET password = ? WHERE id = ?", [password, id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Password updated", changes: this.changes });
    });
});

// Block/Unblock user
app.put('/api/users/:id/block', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { blocked } = req.body; // true or false

    db.run("UPDATE users SET blocked = ? WHERE id = ?", [blocked ? 1 : 0, id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "User block status updated", changes: this.changes });
    });
});

// Delete user
app.delete('/api/users/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM users WHERE id = ?", [id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "User deleted", changes: this.changes });
    });
});

// --- W-API Configuration API ---

// Get W-API Configuration
app.get('/api/wapi/config', authMiddleware, (req, res) => {
    db.get("SELECT * FROM wapi_config ORDER BY id DESC LIMIT 1", (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (row) {
            res.json(row);
        } else {
            res.json({});
        }
    });
});

// Save W-API Configuration
app.post('/api/wapi/config', authMiddleware, (req, res) => {
    const { instance_id, bearer_token } = req.body;

    // Check if config exists
    db.get("SELECT id FROM wapi_config LIMIT 1", (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (row) {
            // Update existing config
            db.run("UPDATE wapi_config SET instance_id = ?, bearer_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [instance_id, bearer_token, row.id], function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ message: "W-API configuration updated" });
                });
        } else {
            // Insert new config
            db.run("INSERT INTO wapi_config (instance_id, bearer_token) VALUES (?, ?)",
                [instance_id, bearer_token], function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ message: "W-API configuration saved", id: this.lastID });
                });
        }
    });
});

// Test W-API Connection
app.post('/api/wapi/test', authMiddleware, async (req, res) => {
    const { instance_id, bearer_token } = req.body;

    if (!instance_id || !bearer_token) {
        res.status(400).json({ error: "Instance ID and Bearer Token are required" });
        return;
    }

    try {
        const fetch = (await import('node-fetch')).default;
        const url = `https://api.w-api.app/v1/instance/status-instance?instanceId=${instance_id}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${bearer_token}`,
                'Content-Type': 'application/json'
            },
            agent: insecureAgent
        });

        let data;
        const responseText = await response.text();
        console.log(`W-API Test Status: ${response.status}`);
        console.log(`W-API Test Response: ${responseText}`);
        
        try {
            data = responseText ? JSON.parse(responseText) : {};
        } catch (e) {
            data = { error: 'Resposta inválida da API', raw: responseText };
        }

        if (response.ok) {
            res.json({
                success: true,
                message: "Conexão bem sucedida!",
                status: data
            });
        } else {
            res.status(response.status).json({
                success: false,
                error: data.message || data.error || `Erro HTTP ${response.status}: ${responseText}`
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || "Erro ao testar conexão"
        });
    }
});

// Send Test Message via W-API
app.post('/api/wapi/send-test', authMiddleware, async (req, res) => {
    const { instance_id, bearer_token, phone, message } = req.body;

    if (!instance_id || !bearer_token || !phone) {
        res.status(400).json({ error: "Instance ID, Bearer Token, and Phone are required" });
        return;
    }

    try {
        const fetch = (await import('node-fetch')).default;
        const url = `https://api.w-api.app/v1/message/send-text?instanceId=${instance_id}`;

        // Formato brasileiro completo
        let cleanPhone = phone.replace(/\D/g, '');
        if (!cleanPhone.startsWith('55')) {
            cleanPhone = '55' + cleanPhone;
        }
        
        const requestBody = {
            phone: cleanPhone + '@c.us',
            message: message || "Mensagem de teste do Gerenciador",
            isGroup: false
        };
        
        console.log(`W-API Request URL: ${url}`);
        console.log(`W-API Request Body:`, requestBody);
        console.log(`W-API Bearer Token: ${bearer_token.substring(0, 10)}...`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${bearer_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            agent: insecureAgent
        });

        let data;
        const responseText = await response.text();
        console.log(`W-API Response Status: ${response.status}`);
        console.log(`W-API Response Text: ${responseText}`);
        
        try {
            data = responseText ? JSON.parse(responseText) : {};
        } catch (e) {
            data = { error: 'Resposta inválida da API', raw: responseText };
        }

        if (response.ok) {
            res.json({
                success: true,
                message: "Mensagem enviada com sucesso!",
                result: data
            });
        } else {
            res.status(response.status).json({
                success: false,
                error: data.message || data.error || `Erro HTTP ${response.status}: ${responseText}`
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || "Erro ao enviar mensagem de teste"
        });
    }
});

// --- Queue Test Generation API ---

// Generate test messages from database
app.post('/api/queue/generate-test', authMiddleware, async (req, res) => {
    const { messageType, limit } = req.body; // 'reminder' or 'overdue'

    try {
        // Get message configuration
        const config = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM message_config LIMIT 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!config) {
            res.status(400).json({ error: "Configuração de mensagens não encontrada" });
            return;
        }

        // Get field mappings
        const mappings = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM field_mappings", (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Create mapping object for quick lookup
        const fieldMap = {};
        mappings.forEach(m => {
            fieldMap[m.message_variable] = m.database_column;
        });

        // Get SQL connection config
        const connectionConfig = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM db_connections ORDER BY id DESC LIMIT 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!connectionConfig) {
            res.status(400).json({ error: "Configuração de conexão SQL não encontrada" });
            return;
        }

        // Connect to SQL Server and fetch data
        const sqlConfig = {
            user: connectionConfig.user,
            password: connectionConfig.password,
            server: connectionConfig.host,
            database: connectionConfig.database,
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        };

        let pool;
        try {
            pool = await sql.connect(sqlConfig);

            // Build query based on message type
            const today = new Date();
            let finalQuery;

            // Get saved query or use default if needed
            const savedQuery = await new Promise((resolve, reject) => {
                db.get("SELECT query_text FROM saved_queries ORDER BY id DESC LIMIT 1", (err, row) => {
                    if (err) resolve(null);
                    else resolve(row ? row.query_text : null);
                });
            });

            const baseQuery = savedQuery || `
                SELECT
                    FC.Cliente__Codigo AS codigocliente,
                    FC.Parcela_Numero AS numeroparcela,
                    FC.Sequencia AS sequenciavenda,
                    C.Nome AS nomecliente,
                    C.CNPJ AS cpfcliente,
                    c.fone1 as fone1,
                    c.fone2 as fone2,
                    CONVERT(VARCHAR(10), FC.EMISSAO, 103) AS emissao,
                    CONVERT(VARCHAR(10), FC.VENCIMENTO, 103) AS vencimento,
                    FC.Valor AS valorbrutoparcela,
                    FC.Desconto AS desconto,
                    FC.Juros AS juros,
                    FC.Multa AS multa,
                    FC.Valor_Final AS valorfinalparcela,
                    SUM(FC.Valor_Final) OVER (PARTITION BY FC.Cliente__Codigo) AS valortotaldevido,
                    SUM(CASE WHEN FC.VENCIMENTO < CAST(GETDATE() AS DATE) THEN FC.Valor_Final ELSE 0 END) OVER (PARTITION BY FC.Cliente__Codigo) AS totalvencido,
                    FC.Descricao AS descricaoparcela
                FROM FINANCEIRO_CONTA FC
                LEFT JOIN Cli_For C ON FC.Cliente__Codigo = C.Codigo
                WHERE FC.PAGAR_RECEBER = 'R'
                  AND FC.SITUACAO = 'A'
                  AND FC.STATUS <> -1
                  AND FC.Cliente__Codigo <> 1
                  AND FC.Tipo = 'P'
            `;

            // Ensure base query doesn't have ORDER BY at the end or trailing semicolons
            let cleanBaseQuery = baseQuery.trim();
            // Remove trailing semicolons
            cleanBaseQuery = cleanBaseQuery.replace(/;+\s*$/g, '');
            // Remove ORDER BY clause at the end
            cleanBaseQuery = cleanBaseQuery.replace(/ORDER\s+BY\s+[\w\.,\s]+$/i, '');

            if (messageType === 'reminder') {
                const daysAhead = config.reminder_days || 5;
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() + daysAhead);

                finalQuery = `
                    WITH BaseData AS (
                        ${cleanBaseQuery}
                    )
                    SELECT *
                    FROM BaseData
                    WHERE CONVERT(DATE, vencimento, 103) >= '${today.toISOString().split('T')[0]}'
                    AND CONVERT(DATE, vencimento, 103) <= '${targetDate.toISOString().split('T')[0]}'
                    ORDER BY CONVERT(DATE, vencimento, 103)
                `;
            } else { // overdue
                const daysOverdue = config.overdue_days || 3;
                const maxRecoveryDays = 7; // Limite máximo de recuperação
                
                const minDate = new Date(today);
                minDate.setDate(today.getDate() - maxRecoveryDays);
                
                const maxDate = new Date(today);
                maxDate.setDate(today.getDate() - daysOverdue);

                // Busca parcelas entre X dias e limite de recuperação
                finalQuery = `
                    WITH BaseData AS (
                        ${cleanBaseQuery}
                    )
                    SELECT *
                    FROM BaseData
                    WHERE CONVERT(DATE, vencimento, 103) >= '${minDate.toISOString().split('T')[0]}'
                    AND CONVERT(DATE, vencimento, 103) <= '${maxDate.toISOString().split('T')[0]}'
                    ORDER BY CONVERT(DATE, vencimento, 103) DESC
                `;
            }

            const result = await pool.request().query(finalQuery);
            const clients = result.recordset;

            // Generate messages
            const template = messageType === 'reminder' ? config.reminder_msg : config.overdue_msg;

            const getValue = (obj, key) => {
                if (!obj) return undefined;
                if (obj[key] !== undefined) return obj[key];
                const lowerKey = key.toLowerCase();
                const foundKey = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
                if (foundKey) return obj[foundKey];
                if (lowerKey === 'emissao' || lowerKey === 'emissiondate') {
                    const variations = ['Emissao', 'EMISSAO', 'DataEmissao', 'Data_Emissao', 'emission_date'];
                    for (const v of variations) {
                        if (obj[v] !== undefined) return obj[v];
                    }
                }
                return undefined;
            };

            const generatedMessages = clients.map(client => {
                let message = template;

                // Replace each variable with corresponding database field value
                Object.keys(fieldMap).forEach(variable => {
                    const dbColumn = fieldMap[variable];
                    let value = client[dbColumn] || '';

                    // Format values based on type
                    if (typeof value === 'number' && (variable.includes('valor') || variable.includes('juros') || variable.includes('multa'))) {
                        value = value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    } else if (value instanceof Date) {
                        value = value.toLocaleDateString('pt-BR');
                    } else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                        // Format date strings
                        const date = new Date(value);
                        value = date.toLocaleDateString('pt-BR');
                    }
                    message = message.replace(new RegExp(variable, 'g'), value);
                });

                // Calculate and replace {valorparcelavencida}, {juros}, {multa}
                if (message.includes('{valorparcelavencida}') || message.includes('{juros}') || message.includes('{multa}')) {
                    const interestRate = config.interest_rate || 0;
                    const penaltyRate = config.penalty_rate || 0;
                    const baseType = config.base_value_type || 'valorbrutoparcela';

                    let baseValue = 0;
                    // Determine base value key and get value
                    const baseColumn = Object.keys(fieldMap).find(key => key.includes(baseType)) ? fieldMap[Object.keys(fieldMap).find(key => key.includes(baseType))] : baseType;

                    if (getValue(client, baseType)) baseValue = getValue(client, baseType);
                    else if (getValue(client, baseColumn)) baseValue = getValue(client, baseColumn);
                    else {
                        if (baseType.includes('bruto')) baseValue = client.valorbrutoparcela || 0;
                        else if (baseType.includes('final')) baseValue = client.valorfinalparcela || 0;
                    }

                    baseValue = parseFloat(baseValue) || 0;

                    // Calculate Days Overdue
                    let daysOverdue = 0;
                    const vencimentoStr = getValue(client, 'vencimento') || client.vencimento;
                    let dueDateObj = null;

                    if (vencimentoStr) {
                        if (vencimentoStr instanceof Date) {
                            dueDateObj = vencimentoStr;
                        } else if (typeof vencimentoStr === 'string') {
                            if (vencimentoStr.includes('/')) {
                                const parts = vencimentoStr.split('/'); // DD/MM/YYYY
                                if (parts.length === 3) {
                                    dueDateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                                }
                            } else if (vencimentoStr.includes('-')) {
                                dueDateObj = new Date(vencimentoStr);
                            }
                        }
                    }

                    if (dueDateObj) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        dueDateObj.setHours(0, 0, 0, 0);
                        const diffTime = today.getTime() - dueDateObj.getTime();
                        daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    }

                    let interestAmount = 0;
                    let penaltyAmount = 0;

                    if (daysOverdue > 0) {
                        // Monthly Rate / 30 * Days
                        interestAmount = baseValue * ((interestRate / 100) / 30) * daysOverdue;
                        penaltyAmount = baseValue * (penaltyRate / 100);
                    }

                    const totalAmount = baseValue + interestAmount + penaltyAmount;

                    const formattedTotal = totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const formattedInterest = interestAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const formattedPenalty = penaltyAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                    // Explicitly replace with calculated values using string replacement
                    if (message.includes('{valorparcelavencida}')) {
                        message = message.split('{valorparcelavencida}').join(formattedTotal);
                    }
                    if (message.includes('{juros}')) {
                        message = message.split('{juros}').join(formattedInterest);
                    }
                    if (message.includes('{multa}')) {
                        message = message.split('{multa}').join(formattedPenalty);
                    }
                }

                // Criar ID único combinando sequência de venda, número da parcela e código do cliente
                const uniqueId = `${getValue(client, 'sequenciavenda') || '0'}-${getValue(client, 'numeroparcela') || '0'}-${client.codigocliente}`;

                return {
                    id: uniqueId,
                    code: client.codigocliente,
                    installmentNumber: getValue(client, 'numeroparcela'),
                    sequenceNumber: getValue(client, 'sequenciavenda'),
                    clientName: client.nomecliente,
                    cpf: client.cpfcliente,
                    phone: getValue(client, 'fone1') || getValue(client, 'fone2'),
                    dueDate: client.vencimento,
                    emissionDate: getValue(client, 'emissao'),
                    description: getValue(client, 'descricaoparcela'),
                    installmentValue: client.valorfinalparcela || client.valorbrutoparcela || 0,
                    value: client.valorfinalparcela || client.valorbrutoparcela || 0,
                    messageContent: message,
                    messageType: messageType,
                    status: 'PREVIEW'
                };
            });

            res.json(generatedMessages);

        } finally {
            if (pool) {
                await pool.close();
            }
        }

    } catch (error) {
        console.error("Error generating test messages:", error);
        res.status(500).json({ error: error.message || "Erro ao gerar mensagens de teste" });
    }
});

// Generate batch messages (manual generation)
app.post('/api/queue/generate-batch', authMiddleware, async (req, res) => {
    const { types } = req.body; // ['reminder', 'overdue']

    if (!Array.isArray(types) || types.length === 0) {
        res.status(400).json({ error: "Types array is required" });
        return;
    }

    try {
        // Get message configuration
        const config = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM message_config LIMIT 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!config) {
            res.status(400).json({ error: "Configuração de mensagens não encontrada" });
            return;
        }

        // Get field mappings
        const mappings = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM field_mappings", (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        const fieldMap = {};
        mappings.forEach(m => {
            fieldMap[m.message_variable] = m.database_column;
        });

        // Get SQL connection config
        const connectionConfig = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM db_connections ORDER BY id DESC LIMIT 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!connectionConfig) {
            res.status(400).json({ error: "Configuração de conexão SQL não encontrada" });
            return;
        }

        const sqlConfig = {
            user: connectionConfig.user,
            password: connectionConfig.password,
            server: connectionConfig.host,
            database: connectionConfig.database,
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        };

        let pool;
        let allMessages = [];

        try {
            pool = await sql.connect(sqlConfig);
            const today = new Date();
            const { types, startDate, endDate } = req.body; // Extract custom dates

            // Helper to format date for SQL
            const formatDate = (date) => date.toISOString().split('T')[0];

            for (const type of types) {
                let finalQuery;
                if (startDate && endDate) {
                    // Custom Range Query (applies to both, but usually used for Overdue by Date)
                    finalQuery = `
                        WITH BaseData AS (
                            ${cleanBaseQuery}
                        )
                        SELECT 
                            codigocliente, numeroparcela, sequenciavenda, nomecliente, cpfcliente, fone1, fone2,
                            emissao, vencimento, valorbrutoparcela, desconto, juros, multa,
                            valorfinalparcela, valortotaldevido, totalvencido, descricaoparcela
                        FROM BaseData
                        WHERE CONVERT(DATE, vencimento, 103) >= '${startDate}'
                        AND CONVERT(DATE, vencimento, 103) <= '${endDate}'
                        ORDER BY CONVERT(DATE, vencimento, 103)
                    `;
                } else if (type === 'reminder') {
                    const daysAhead = config.reminder_days || 5;
                    const targetDate = new Date(today);
                    targetDate.setDate(today.getDate() + daysAhead);

                    finalQuery = `
                        WITH BaseData AS (
                            ${cleanBaseQuery}
                        )
                        SELECT 
                            codigocliente, numeroparcela, sequenciavenda, nomecliente, cpfcliente, fone1, fone2,
                            emissao, vencimento, valorbrutoparcela, desconto, juros, multa,
                            valorfinalparcela, valortotaldevido, totalvencido, descricaoparcela
                        FROM BaseData
                        WHERE CONVERT(DATE, vencimento, 103) >= '${formatDate(today)}'
                        AND CONVERT(DATE, vencimento, 103) <= '${formatDate(targetDate)}'
                        ORDER BY CONVERT(DATE, vencimento, 103)
                    `;
                } else if (type === 'overdue') {
                    const daysBack = config.overdue_days || 3;
                    const targetDate = new Date(today);
                    targetDate.setDate(today.getDate() - daysBack);

                    finalQuery = `
                        WITH BaseData AS (
                            ${cleanBaseQuery}
                        )
                        SELECT 
                            codigocliente, numeroparcela, sequenciavenda, nomecliente, cpfcliente, fone1, fone2,
                            emissao, vencimento, valorbrutoparcela, desconto, juros, multa,
                            valorfinalparcela, valortotaldevido, totalvencido, descricaoparcela
                        FROM BaseData
                        WHERE CONVERT(DATE, vencimento, 103) < '${formatDate(today)}'
                        AND CONVERT(DATE, vencimento, 103) >= '${formatDate(targetDate)}'
                        ORDER BY CONVERT(DATE, vencimento, 103) DESC
                    `;
                }

                if (finalQuery) {
                    const result = await pool.request().query(finalQuery);
                    const clients = result.recordset;

                    // Helper function to get value case-insensitive
                    const getValue = (obj, key) => {
                        if (!obj) return undefined;
                        if (obj[key] !== undefined) return obj[key];

                        const lowerKey = key.toLowerCase();
                        const foundKey = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);

                        if (foundKey) return obj[foundKey];

                        // Tentar variações comuns se for data de emissão
                        if (lowerKey === 'emissao' || lowerKey === 'emissiondate') {
                            const variations = ['Emissao', 'EMISSAO', 'DataEmissao', 'Data_Emissao', 'emission_date'];
                            for (const v of variations) {
                                if (obj[v] !== undefined) return obj[v];
                            }
                        }

                        return undefined;
                    };

                    const template = type === 'reminder' ? config.reminder_msg : config.overdue_msg;

                    const messages = clients.map((client, idx) => {
                        let message = template || '';
                        Object.keys(fieldMap).forEach(variable => {
                            const dbColumn = fieldMap[variable];
                            let value = getValue(client, dbColumn) || '';
                            if (typeof value === 'number' && (variable.includes('valor') || variable.includes('juros') || variable.includes('multa'))) {
                                value = value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            } else if (value instanceof Date) {
                                value = value.toLocaleDateString('pt-BR');
                            } else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                                const date = new Date(value);
                                value = date.toLocaleDateString('pt-BR');
                            }
                            message = message.replace(new RegExp(variable, 'g'), value);
                        });

                        // Calculate and replace {valorparcelavencida}, {juros}, {multa}
                        const interestRate = config.interest_rate || 0;
                        const penaltyRate = config.penalty_rate || 0;
                        const baseType = config.base_value_type || 'valorbrutoparcela';

                        let baseValue = 0;
                        // Determine base value key and get value
                        const baseColumn = Object.keys(fieldMap).find(key => key.includes(baseType)) ? fieldMap[Object.keys(fieldMap).find(key => key.includes(baseType))] : baseType;

                        if (getValue(client, baseType)) baseValue = getValue(client, baseType);
                        else if (getValue(client, baseColumn)) baseValue = getValue(client, baseColumn);
                        else {
                            if (baseType.includes('bruto')) baseValue = getValue(client, 'valorbrutoparcela') || 0;
                            else if (baseType.includes('final')) baseValue = getValue(client, 'valorfinalparcela') || 0;
                        }

                        baseValue = parseFloat(baseValue) || 0;

                        // Calculate Days Overdue
                        let daysOverdue = 0;
                        const vencimentoStr = getValue(client, 'vencimento') || client.vencimento;
                        let dueDateObj = null;

                        if (vencimentoStr) {
                            if (vencimentoStr instanceof Date) {
                                dueDateObj = vencimentoStr;
                            } else if (typeof vencimentoStr === 'string') {
                                if (vencimentoStr.includes('/')) {
                                    const parts = vencimentoStr.split('/'); // DD/MM/YYYY
                                    if (parts.length === 3) {
                                        dueDateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                                    }
                                } else if (vencimentoStr.includes('-')) {
                                    dueDateObj = new Date(vencimentoStr);
                                }
                            }
                        }

                        if (dueDateObj) {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            dueDateObj.setHours(0, 0, 0, 0);
                            const diffTime = today.getTime() - dueDateObj.getTime();
                            daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        }

                        // DEBUG LOGGING
                        if (idx === 0) {
                            console.log('--- DEBUG ITEM 0 ---');
                            console.log('Vencimento raw:', client.vencimento);
                            console.log('VencimentoStr:', vencimentoStr);
                            console.log('Parsed DueDate:', dueDateObj);
                            console.log('Days Overdue:', daysOverdue);
                            console.log('Interest Rate:', interestRate, 'Penalty Rate:', penaltyRate);
                            console.log('Base Value:', baseValue);
                            console.log('Message before replace:', message);
                            console.log('Has {juros}?:', message.includes('{juros}'));
                        }

                        let interestAmount = 0;
                        let penaltyAmount = 0;

                        if (daysOverdue > 0) {
                            // Monthly Rate / 30 * Days
                            interestAmount = baseValue * ((interestRate / 100) / 30) * daysOverdue;
                            penaltyAmount = baseValue * (penaltyRate / 100);
                        }

                        const totalAmount = baseValue + interestAmount + penaltyAmount;

                        const formattedTotal = totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        const formattedInterest = interestAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        const formattedPenalty = penaltyAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


                        // Explicitly replace with calculated values using string replacement
                        if (message.includes('{valorparcelavencida}')) {
                            message = message.split('{valorparcelavencida}').join(formattedTotal);
                        }
                        if (message.includes('{juros}')) {
                            message = message.split('{juros}').join(formattedInterest);
                        }
                        if (message.includes('{multa}')) {
                            message = message.split('{multa}').join(formattedPenalty);
                        }





                        const desc = getValue(client, 'descricaoparcela') || '';

                        if (idx === 0) {
                            console.log('\n=== DEBUG PRIMEIRO ITEM ===');
                            console.log('Todas as chaves:', Object.keys(client));
                            console.log('client["descricaoparcela"]:', client["descricaoparcela"]);
                            console.log('client["DESCRICAOPARCELA"]:', client["DESCRICAOPARCELA"]);
                            console.log('getValue result:', desc);
                            console.log('===========================\n');
                        }

                        // Criar ID único combinando sequência de venda, número da parcela e código do cliente
                        const uniqueId = `${getValue(client, 'sequenciavenda') || '0'}-${getValue(client, 'numeroparcela') || '0'}-${getValue(client, 'codigocliente')}`;

                        // Format phone number
                        const rawPhone = getValue(client, 'fone1') || getValue(client, 'fone2');
                        const formattedPhone = formatBrazilianPhone(rawPhone);

                        return {
                            id: uniqueId,
                            code: getValue(client, 'codigocliente'),
                            installmentNumber: getValue(client, 'numeroparcela'),
                            sequenceNumber: getValue(client, 'sequenciavenda'),
                            clientName: getValue(client, 'nomecliente'),
                            cpf: getValue(client, 'cpfcliente'),
                            dueDate: getValue(client, 'vencimento'),
                            emissionDate: getValue(client, 'emissao'),
                            value: getValue(client, 'valorfinalparcela') || getValue(client, 'valorbrutoparcela') || 0,
                            installmentValue: getValue(client, 'valorfinalparcela') || getValue(client, 'valorbrutoparcela') || 0,
                            messageContent: message,
                            messageType: type,
                            status: 'PREVIEW',
                            phone: formattedPhone,
                            description: desc
                        };
                    });
                    allMessages = [...allMessages, ...messages];
                }
            }

            // Log para debug
            if (allMessages.length > 0) {
                console.log('\n=== GENERATE-TEST DEBUG ===');
                console.log('Total mensagens:', allMessages.length);
                console.log('Primeira mensagem:');
                console.log('- dueDate:', allMessages[0].dueDate);
                console.log('- emissionDate:', allMessages[0].emissionDate);
                console.log('===========================\n');
            }

            res.json(allMessages);

        } finally {
            if (pool) {
                await pool.close();
            }
        }

    } catch (error) {
        console.error("Error generating batch messages:", error);
        res.status(500).json({ error: error.message || "Erro ao gerar lote de mensagens" });
    }
});

// Generate messages by date range
app.post('/api/queue/generate-by-date', authMiddleware, async (req, res) => {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
        res.status(400).json({ error: "startDate and endDate are required" });
        return;
    }

    try {
        // Get message configuration
        const config = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM message_config LIMIT 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!config) {
            res.status(400).json({ error: "Configuração de mensagens não encontrada" });
            return;
        }

        // Get field mappings
        const mappings = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM field_mappings", (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        const fieldMap = {};
        mappings.forEach(m => {
            fieldMap[m.message_variable] = m.database_column;
        });

        // Get SQL connection config
        const connectionConfig = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM db_connections ORDER BY id DESC LIMIT 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!connectionConfig) {
            res.status(400).json({ error: "Configuração de conexão SQL não encontrada" });
            return;
        }

        const sqlConfig = {
            user: connectionConfig.user,
            password: connectionConfig.password,
            server: connectionConfig.host,
            database: connectionConfig.database,
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        };

        let pool;

        try {
            pool = await sql.connect(sqlConfig);

            // Get saved query or use default
            const savedQuery = await new Promise((resolve, reject) => {
                db.get("SELECT query_text FROM saved_queries ORDER BY id DESC LIMIT 1", (err, row) => {
                    if (err) resolve(null);
                    else resolve(row ? row.query_text : null);
                });
            });

            const baseQuery = savedQuery || `
                SELECT
                    FC.Cliente__Codigo AS codigocliente,
                    FC.Parcela_Numero AS numeroparcela,
                    FC.Sequencia AS sequenciavenda,
                    C.Nome AS nomecliente,
                    C.CNPJ AS cpfcliente,
                    c.fone1 as fone1,
                    c.fone2 as fone2,
                    CONVERT(VARCHAR(10), FC.EMISSAO, 103) AS emissao,
                    CONVERT(VARCHAR(10), FC.VENCIMENTO, 103) AS vencimento,
                    FC.Valor AS valorbrutoparcela,
                    FC.Desconto AS desconto,
                    FC.Juros AS juros,
                    FC.Multa AS multa,
                    FC.Valor_Final AS valorfinalparcela,
                    SUM(FC.Valor_Final) OVER (PARTITION BY FC.Cliente__Codigo) AS valortotaldevido,
                    SUM(CASE WHEN FC.VENCIMENTO < CAST(GETDATE() AS DATE) THEN FC.Valor_Final ELSE 0 END) OVER (PARTITION BY FC.Cliente__Codigo) AS totalvencido,
                    FC.Descricao AS descricaoparcela
                FROM FINANCEIRO_CONTA FC
                LEFT JOIN Cli_For C ON FC.Cliente__Codigo = C.Codigo
                WHERE FC.PAGAR_RECEBER = 'R'
                  AND FC.SITUACAO = 'A'
                  AND FC.STATUS <> -1
                  AND FC.Cliente__Codigo <> 1
                  AND FC.Tipo = 'P'
            `;

            let cleanBaseQuery = baseQuery.trim();
            cleanBaseQuery = cleanBaseQuery.replace(/;+\s*$/g, '');
            cleanBaseQuery = cleanBaseQuery.replace(/ORDER\s+BY\s+[\w\.,\s]+$/i, '');

            // Convert date format to ISO if needed
            const parseDate = (dateStr) => {
                if (!dateStr) return '';
                // If already YYYY-MM-DD
                if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    return dateStr;
                }
                // If DD/MM/YYYY
                if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                    const [day, month, year] = dateStr.split('/');
                    return `${year}-${month}-${day}`;
                }
                return dateStr;
            };

            const parsedStartDate = parseDate(startDate);
            const parsedEndDate = parseDate(endDate);

            console.log('[generate-by-date] Período solicitado:', { startDate, endDate, parsedStartDate, parsedEndDate });

            const finalQuery = `
                WITH BaseData AS (
                    ${cleanBaseQuery}
                )
                SELECT *
                FROM BaseData
                WHERE CONVERT(DATE, vencimento, 103) >= '${parsedStartDate}'
                AND CONVERT(DATE, vencimento, 103) <= '${parsedEndDate}'
                ORDER BY CONVERT(DATE, vencimento, 103) DESC
            `;

            console.log('[generate-by-date] Query SQL gerada');

            const result = await pool.request().query(finalQuery);
            const clients = result.recordset;

            console.log(`[generate-by-date] Encontrados ${clients.length} registros no período`);

            if (clients.length === 0) {
                console.log('[generate-by-date] Nenhum registro encontrado no período especificado');
                return res.json([]);
            }

            const template = config.overdue_msg;

            // Helper function to get value case-insensitive
            const getValue = (obj, key) => {
                if (obj[key] !== undefined) return obj[key];
                const lowerKey = key.toLowerCase();
                const foundKey = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
                return foundKey ? obj[foundKey] : undefined;
            };

            const messages = clients.map((client) => {
                let message = template;
                Object.keys(fieldMap).forEach(variable => {
                    const dbColumn = fieldMap[variable];
                    let value = getValue(client, dbColumn) || '';
                    if (typeof value === 'number' && (variable.includes('valor') || variable.includes('juros') || variable.includes('multa'))) {
                        value = value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    } else if (value instanceof Date) {
                        value = value.toLocaleDateString('pt-BR');
                    } else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                        const date = new Date(value);
                        value = date.toLocaleDateString('pt-BR');
                    }
                    message = message.replace(new RegExp(variable, 'g'), value);
                });

                // --- CALCULATION LOGIC START ---
                const interestRate = config.interest_rate || 0;
                const penaltyRate = config.penalty_rate || 0;
                const baseType = config.base_value_type || 'valorbrutoparcela';

                let baseValue = 0;
                // Determine base value key and get value
                const baseColumn = Object.keys(fieldMap).find(key => key.includes(baseType)) ? fieldMap[Object.keys(fieldMap).find(key => key.includes(baseType))] : baseType;

                if (getValue(client, baseType)) baseValue = getValue(client, baseType);
                else if (getValue(client, baseColumn)) baseValue = getValue(client, baseColumn);
                else {
                    if (baseType.includes('bruto')) baseValue = getValue(client, 'valorbrutoparcela') || 0;
                    else if (baseType.includes('final')) baseValue = getValue(client, 'valorfinalparcela') || 0;
                }

                baseValue = parseFloat(baseValue) || 0;

                // Calculate Days Overdue
                let daysOverdue = 0;
                const vencimentoStr = getValue(client, 'vencimento') || client.vencimento;
                let dueDateObj = null;

                if (vencimentoStr) {
                    if (vencimentoStr instanceof Date) {
                        dueDateObj = vencimentoStr;
                    } else if (typeof vencimentoStr === 'string') {
                        if (vencimentoStr.includes('/')) {
                            const parts = vencimentoStr.split('/'); // DD/MM/YYYY
                            if (parts.length === 3) {
                                dueDateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                            }
                        } else if (vencimentoStr.includes('-')) {
                            dueDateObj = new Date(vencimentoStr);
                        }
                    }
                }

                if (dueDateObj) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    // Ensure date from SQL is treated as local midnight for accurate day diff
                    // Or if parsed from string, it's already local logic above.
                    if (dueDateObj.getHours() !== 0) dueDateObj.setHours(0, 0, 0, 0);

                    const diffTime = today.getTime() - dueDateObj.getTime();
                    daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }

                let interestAmount = 0;
                let penaltyAmount = 0;

                if (daysOverdue > 0) {
                    // Pro-rata Daily: Base * ((Rate/100)/30) * Days
                    interestAmount = baseValue * ((interestRate / 100) / 30) * daysOverdue;
                    penaltyAmount = baseValue * (penaltyRate / 100);
                }

                const totalAmount = baseValue + interestAmount + penaltyAmount;

                const formattedTotal = totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const formattedInterest = interestAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const formattedPenalty = penaltyAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                // Explicitly replace with calculated values using string replacement
                if (message.includes('{valorparcelavencida}')) {
                    message = message.split('{valorparcelavencida}').join(formattedTotal);
                }
                if (message.includes('{juros}')) {
                    message = message.split('{juros}').join(formattedInterest);
                }
                if (message.includes('{multa}')) {
                    message = message.split('{multa}').join(formattedPenalty);
                }
                // --- CALCULATION LOGIC END ---

                const desc = getValue(client, 'descricaoparcela') || '';

                // Criar ID único combinando sequência de venda, número da parcela e código do cliente
                const uniqueId = `${getValue(client, 'sequenciavenda') || '0'}-${getValue(client, 'numeroparcela') || '0'}-${getValue(client, 'codigocliente')}`;

                return {
                    id: uniqueId,
                    code: getValue(client, 'codigocliente'),
                    installmentNumber: getValue(client, 'numeroparcela'),
                    sequenceNumber: getValue(client, 'sequenciavenda'),
                    clientName: getValue(client, 'nomecliente'),
                    cpf: getValue(client, 'cpfcliente'),
                    dueDate: getValue(client, 'vencimento'),
                    emissionDate: getValue(client, 'emissao'),
                    value: getValue(client, 'valorfinalparcela') || getValue(client, 'valorbrutoparcela') || 0,
                    installmentValue: getValue(client, 'valorfinalparcela') || getValue(client, 'valorbrutoparcela') || 0,
                    messageContent: message,
                    messageType: 'overdue',
                    status: 'PREVIEW',
                    phone: getValue(client, 'fone1') || '',
                    description: desc
                };
            });

            console.log(`[generate-by-date] Geradas ${messages.length} mensagens com sucesso`);
            console.log('[generate-by-date] Exemplo de mensagem gerada:', messages[0]);

            res.json(messages);

        } finally {
            if (pool) {
                await pool.close();
            }
        }

    } catch (error) {
        console.error('[generate-by-date] Erro ao gerar mensagens:', error);
        console.error('[generate-by-date] Stack trace:', error.stack);
        res.status(500).json({
            error: error.message || "Erro ao gerar mensagens por data",
            details: error.stack
        });
    }
});


// Get all field mappings
app.get('/api/field-mappings', authMiddleware, (req, res) => {
    db.all("SELECT * FROM field_mappings ORDER BY id", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows || []);
    });
});

// Save/Update field mappings
app.post('/api/field-mappings', authMiddleware, (req, res) => {
    const mappings = req.body; // Array of {message_variable, database_column}

    if (!Array.isArray(mappings)) {
        res.status(400).json({ error: "Expected array of mappings" });
        return;
    }

    // Use a transaction-like approach
    const stmt = db.prepare(`
        INSERT INTO field_mappings (message_variable, database_column) 
        VALUES (?, ?)
        ON CONFLICT(message_variable) 
        DO UPDATE SET database_column = excluded.database_column, updated_at = CURRENT_TIMESTAMP
    `);

    let errors = [];
    mappings.forEach(mapping => {
        stmt.run(mapping.message_variable, mapping.database_column, (err) => {
            if (err) errors.push(err.message);
        });
    });

    stmt.finalize((err) => {
        if (err || errors.length > 0) {
            res.status(500).json({ error: errors.join('; ') || err.message });
            return;
        }
        res.json({ message: "Field mappings saved successfully" });
    });
});

// Block specific installment
app.post('/api/blocked/by-installment', authMiddleware, (req, res) => {
    const { client_code, installment_id, client_name, reason } = req.body;

    const identifier = `${client_code}-${installment_id}`;
    const sqlQuery = `INSERT INTO blocked_clients 
        (identifier, client_name, reason, block_type, client_code, installment_id) 
        VALUES (?, ?, ?, 'installment', ?, ?)`;

    db.run(sqlQuery, [identifier, client_name, reason, client_code, installment_id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            id: this.lastID,
            message: "Parcela bloqueada com sucesso"
        });
    });
});

// Block all client messages
app.post('/api/blocked/by-client', authMiddleware, (req, res) => {
    const { client_code, client_name, reason } = req.body;

    const sqlQuery = `INSERT INTO blocked_clients 
        (identifier, client_name, reason, block_type, client_code) 
        VALUES (?, ?, ?, 'client', ?)`;

    db.run(sqlQuery, [client_code, client_name, reason, client_code], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            id: this.lastID,
            message: "Cliente bloqueado com sucesso - todas as mensagens"
        });
    });
});

// --- Queue Management API ---

// Get queue items with filters
app.get('/api/queue/items', authMiddleware, (req, res) => {
    const { status, date_from, date_to } = req.query;
    let query = "SELECT * FROM queue_items WHERE 1=1";
    const params = [];

    if (status && status !== 'todos') {
        query += " AND status = ?";
        params.push(status.toUpperCase());
    }

    if (date_from) {
        query += " AND DATE(created_at) >= DATE(?)";
        params.push(date_from);
    }

    if (date_to) {
        query += " AND DATE(created_at) <= DATE(?)";
        params.push(date_to);
    }

    query += " ORDER BY created_at DESC";

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        const mappedRows = (rows || []).map(row => ({
            id: row.id,
            code: row.client_code || row.code,
            clientName: row.client_name,
            cpf: row.cpf,
            phone: row.phone,
            installmentValue: row.installment_value,
            value: row.installment_value, // for compatibility
            dueDate: row.due_date,
            messageContent: row.message_content,
            messageType: row.message_type,
            status: row.status,
            sendMode: row.send_mode,
            createdAt: row.created_at,
            description: row.description
        }));
        res.json(mappedRows);
    });
});

// Get today's queue items (changed to get all items for better UX)
app.get('/api/queue/today', authMiddleware, async (req, res) => {
    const query = `
        SELECT 
            q.*,
            CASE 
                WHEN b_inst.id IS NOT NULL THEN 'BLOCKED'
                WHEN b_client.id IS NOT NULL THEN 'BLOCKED'
                ELSE q.status 
            END as computed_status
        FROM queue_items q
        LEFT JOIN blocked_clients b_inst ON b_inst.block_type = 'installment' AND b_inst.installment_id = q.installment_id
        LEFT JOIN blocked_clients b_client ON b_client.block_type = 'client' AND b_client.client_code = q.client_code
        ORDER BY q.created_at DESC
    `;

    db.all(query, async (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        try {
            // Get SQL Server connection to fetch descriptions
            const sqlConfig = await new Promise((resolve, reject) => {
                db.get("SELECT * FROM db_connections WHERE active = 1", (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (sqlConfig) {
                const config = {
                    user: sqlConfig.user,
                    password: sqlConfig.password,
                    server: sqlConfig.host,
                    database: sqlConfig.database,
                    options: { encrypt: false, trustServerCertificate: true }
                };

                const pool = await sql.connect(config);

                // Fetch descriptions for all items
                const mappedRows = (rows || []).map(row => ({
                    id: row.id,
                    installmentId: row.installment_id,
                    code: row.client_code || row.code,
                    clientName: row.client_name,
                    cpf: row.cpf,
                    phone: row.phone,
                    installmentValue: row.installment_value,
                    value: row.installment_value,
                    dueDate: row.due_date,
                    emissionDate: row.emission_date,
                    messageContent: row.message_content,
                    messageType: row.message_type,
                    status: row.computed_status || row.status,
                    sendMode: row.send_mode,
                    createdAt: row.created_at,
                    scheduledDate: row.created_at,
                    created_at: row.created_at,
                    description: row.description
                }));
                res.json(mappedRows);
            }
        } catch (err) {
            console.error('Error in /api/queue/today:', err);
            // Fallback to basic mapping
            const mappedRows = (rows || []).map(row => ({
                id: row.id,
                installmentId: row.installment_id,
                code: row.client_code || row.code,
                clientName: row.client_name,
                cpf: row.cpf,
                phone: row.phone,
                installmentValue: row.installment_value,
                value: row.installment_value,
                dueDate: row.due_date,
                messageContent: row.message_content,
                messageType: row.message_type,
                status: row.computed_status || row.status,
                sendMode: row.send_mode,
                createdAt: row.created_at,
                scheduledDate: row.created_at,
                created_at: row.created_at,
                description: row.description
            }));
            res.json(mappedRows);
        }
    });
});

// Get blocked clients
app.get('/api/blocked', authMiddleware, (req, res) => {
    db.all("SELECT * FROM blocked_clients ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows || []);
    });
});

// Delete blocked client
app.delete('/api/blocked/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM blocked_clients WHERE id = ?", [id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Bloqueio removido", changes: this.changes });
    });
});

// Add items to queue (from generate-batch)
app.post('/api/queue/add-items', authMiddleware, async (req, res) => {
    const { items, send_mode } = req.body;

    console.log(`[add-items] Recebida requisição para adicionar ${items?.length || 0} itens`);
    console.log('[add-items] Modo de envio:', send_mode);

    if (!Array.isArray(items) || items.length === 0) {
        console.error('[add-items] Erro: array de itens inválido ou vazio');
        res.status(400).json({ error: "Items array is required" });
        return;
    }

    try {
        let inserted = 0;
        let skipped = 0;
        const errors = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Validar campos obrigatórios
            if (!item.code) {
                console.error(`[add-items] Item ${i}: código do cliente ausente`, item);
                errors.push({ index: i, error: 'Código do cliente ausente', item });
                skipped++;
                continue;
            }

            if (!item.clientName) {
                console.error(`[add-items] Item ${i}: nome do cliente ausente`, item);
                errors.push({ index: i, error: 'Nome do cliente ausente', item });
                skipped++;
                continue;
            }

            if (!item.dueDate) {
                console.error(`[add-items] Item ${i}: data de vencimento ausente`, item);
                errors.push({ index: i, error: 'Data de vencimento ausente', item });
                skipped++;
                continue;
            }

            console.log(`[add-items] Processando item ${i}: ID="${item.id}", Cliente="${item.code}", Nome="${item.clientName}"`);

            // Check if item already exists (same client, installment, type, and pending)
            try {
                const existing = await new Promise((resolve, reject) => {
                    db.get(
                        `SELECT id FROM queue_items 
                         WHERE client_code = ?
                                        AND installment_id = ?
                                            AND message_type = ?
                                                AND status = 'PENDING'`,
                        [item.code, item.id, item.messageType],
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        }
                    );
                });

                if (existing) {
                    console.log(`[add-items] ❌ DUPLICADO encontrado:`);
                    console.log(`  - Item atual: ID="${item.id}", Cliente="${item.code}", Nome="${item.clientName}"`);
                    console.log(`  - Vencimento: ${item.dueDate}, Valor: ${item.installmentValue}`);
                    console.log(`  - Tipo: ${item.messageType}`);
                    console.log(`  - Já existe na fila com ID do banco: ${existing.id}`);
                    console.log(`  - Motivo: Mesmo cliente (${item.code}) + mesmo installment_id (${item.id}) + mesmo tipo (${item.messageType}) + status PENDING`);

                    // Registrar log de duplicata
                    console.log(`[add-items] Tentando inserir log de duplicata para ${item.id}`);
                    db.run(
                        `INSERT INTO duplicate_logs (
                            item_id, client_code, client_name, due_date, 
                            installment_value, message_type, existing_queue_id
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            item.id,
                            item.code,
                            item.clientName,
                            item.dueDate,
                            item.installmentValue ? item.installmentValue.toString() : '0',
                            item.messageType,
                            existing.id
                        ],
                        function (err) {
                            if (err) {
                                console.error('[add-items] ❌ Erro ao salvar log de duplicata:', err);
                            } else {
                                console.log(`[add-items] ✅ Log de duplicata salvo com sucesso. ID: ${this.lastID}`);
                            }
                        }
                    );

                    skipped++;
                    continue; // Skip duplicate
                }
            } catch (err) {
                console.error(`[add-items] Item ${i}: erro ao verificar duplicata:`, err);
                errors.push({ index: i, error: 'Erro ao verificar duplicata: ' + err.message, item });
                skipped++;
                continue;
            }

            // Insert new item
            try {
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO queue_items(
                            client_code, client_name, cpf, phone, installment_id,
                            installment_value, due_date, emission_date, message_content, message_type,
                            send_mode, status, description, created_at
                        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, CURRENT_TIMESTAMP)`,
                        [
                            item.code,
                            item.clientName,
                            item.cpf,
                            item.phone || item.fone1 || item.fone2,
                            item.id,
                            typeof item.installmentValue === 'number'
                                ? item.installmentValue.toFixed(2)
                                : item.installmentValue,
                            item.dueDate,
                            item.emissionDate,
                            item.messageContent,
                            item.messageType,
                            send_mode || 'MANUAL',
                            item.description || item.descricao || ''
                        ],
                        function (err) {
                            if (err) {
                                console.error(`[add-items] Item ${i} (${item.code}): erro ao inserir:`, err);
                                reject(err);
                            } else {
                                console.log(`[add-items] Item ${i} (${item.code}): inserido com sucesso (ID: ${this.lastID})`);
                                inserted++;
                                resolve();
                            }
                        }
                    );
                });
            } catch (err) {
                console.error(`[add-items] Item ${i}: erro ao inserir no banco:`, err);
                errors.push({ index: i, error: 'Erro ao inserir: ' + err.message, item });
                skipped++;
            }
        }

        console.log(`[add-items] Processamento concluído: ${inserted} inseridos, ${skipped} pulados de ${items.length} total`);

        if (errors.length > 0) {
            console.error(`[add-items] ${errors.length} erros encontrados:`, errors);
        }

        // Log summary
        if (inserted > 0 || skipped > 0) {
            logEvent('INFO', `Itens adicionados à fila: ${inserted} inseridos, ${skipped} duplicados`, JSON.stringify({ inserted, skipped, total: items.length }));
        }

        res.json({
            message: "Items processed",
            inserted,
            skipped,
            total: items.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('[add-items] Erro crítico no processamento:', error);
        console.error('[add-items] Stack trace:', error.stack);
        res.status(500).json({
            error: error.message || 'Erro ao adicionar itens',
            details: error.stack
        });
    }
});

// Toggle item selection
app.put('/api/queue/items/:id/select', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { selected } = req.body;

    db.run(
        "UPDATE queue_items SET selected_for_send = ? WHERE id = ?",
        [selected ? 1 : 0, id],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: "Selection updated", changes: this.changes });
        }
    );
});

// Delete multiple queue items
// Delete multiple queue items
app.delete('/api/queue/items/bulk', authMiddleware, async (req, res) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: "IDs array is required" });
        return;
    }

    const CHUNK_SIZE = 500;
    let deletedCount = 0;
    let errors = [];

    // Process in chunks to avoid SQLite variable limit
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => '?').join(',');
        const query = `DELETE FROM queue_items WHERE id IN(${placeholders})`;

        try {
            await new Promise((resolve, reject) => {
                db.run(query, chunk, function (err) {
                    if (err) reject(err);
                    else {
                        deletedCount += this.changes;
                        resolve();
                    }
                });
            });
        } catch (err) {
            console.error(`Error deleting chunk ${i}:`, err);
            errors.push(err.message);
        }
    }

    if (errors.length > 0 && deletedCount === 0) {
        res.status(500).json({ error: "Failed to delete items", details: errors });
    } else {
        // Log deletion
        if (deletedCount > 0) {
            logEvent('INFO', `Exclusão em massa: ${deletedCount} itens removidos`, JSON.stringify({ deleted: deletedCount, requested: ids.length }));
        }

        res.json({
            message: "Items processed",
            deleted: deletedCount,
            errors: errors.length > 0 ? errors : undefined
        });
    }
});

// Delete single queue item
app.delete('/api/queue/:id', authMiddleware, (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM queue_items WHERE id = ?', [id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        // Log deletion
        if (this.changes > 0) {
            logEvent('INFO', `Item excluído da fila`, `ID: ${id}`);
        }

        res.json({ message: "Item deleted", deleted: this.changes });
    });
});

// Helper function to send message via W-API
async function sendMessageViaWAPI(phone, message) {
    // Get W-API config
    const wapiConfig = await new Promise((resolve, reject) => {
        db.get("SELECT * FROM wapi_config ORDER BY id DESC LIMIT 1", (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

    if (!wapiConfig || !wapiConfig.instance_id || !wapiConfig.bearer_token) {
        throw new Error("W-API not configured");
    }

    const fetch = (await import('node-fetch')).default;
    const url = `https://api.w-api.app/v1/message/send-text?instanceId=${wapiConfig.instance_id}`;

    // Clean phone number (remove non-digits)
    let cleanPhone = phone.replace(/\D/g, '');

    // Ensure it has country code 55
    if (!cleanPhone.startsWith('55')) {
        cleanPhone = '55' + cleanPhone;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${wapiConfig.bearer_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            phone: cleanPhone + '@c.us',
            message: message,
            isGroup: false
        }),
        agent: insecureAgent
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || `W-API error: ${response.status}`);
    }

    return data;
}

// Helper function to log error
function logError(tipo, mensagem, detalhes, client_code, phone) {
    db.run(
        "INSERT INTO error_logs (tipo, mensagem, detalhes, client_code, phone) VALUES (?, ?, ?, ?, ?)",
        [tipo, mensagem, detalhes, client_code, phone],
        (err) => {
            if (err) {
                console.error("Error logging error:", err);
            }
        }
    );
}

// Helper function to log scheduler events
function logScheduler(mensagem, detalhes = '') {
    db.run(
        "INSERT INTO error_logs (tipo, mensagem, detalhes) VALUES (?, ?, ?)",
        ['AGENDAMENTO', mensagem, detalhes],
        (err) => {
            if (err) {
                console.error("Error logging scheduler:", err);
            }
        }
    );
    console.log(`Scheduler: ${mensagem}`);
}

// Helper function to log general events
function logEvent(tipo, mensagem, detalhes = '') {
    db.run(
        "INSERT INTO error_logs (tipo, mensagem, detalhes) VALUES (?, ?, ?)",
        [tipo, mensagem, detalhes],
        (err) => {
            if (err) {
                console.error("Error logging event:", err);
            }
        }
    );
}

// Send selected items
app.post('/api/queue/send-selected', authMiddleware, async (req, res) => {
    try {
        // Get selected items
        const items = await new Promise((resolve, reject) => {
            db.all(
                "SELECT * FROM queue_items WHERE selected_for_send = 1 AND status = 'PENDING'",
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        if (items.length === 0) {
            res.status(400).json({ error: "No items selected" });
            return;
        }

        let sent = 0;
        let errors = 0;
        const results = [];

        for (const item of items) {
            try {
                // Check if phone exists
                if (!item.phone) {
                    throw new Error("Phone number not available");
                }

                // Send message
                await sendMessageViaWAPI(item.phone, item.message_content);

                // Log successful send
                logEvent('INFO', `Mensagem enviada para ${item.client_name}`, `Cliente: ${item.client_code}, Telefone: ${item.phone}`);

                // Update status
                db.run(
                    "UPDATE queue_items SET status = 'SENT', sent_date = CURRENT_TIMESTAMP WHERE id = ?",
                    [item.id]
                );

                sent++;
                results.push({ id: item.id, success: true });
            } catch (error) {
                // Log error
                logError(
                    'envio',
                    `Erro ao enviar para ${item.client_name}`,
                    error.message,
                    item.client_code,
                    item.phone
                );

                // Update status
                db.run(
                    "UPDATE queue_items SET status = 'ERROR', error_date = CURRENT_TIMESTAMP, error_message = ? WHERE id = ?",
                    [error.message, item.id]
                );

                errors++;
                results.push({ id: item.id, success: false, error: error.message });
            }
        }

        // Log summary
        if (sent > 0 || errors > 0) {
            logEvent('INFO', `Envio concluído: ${sent} enviadas, ${errors} erros`, JSON.stringify({ sent, errors, total: items.length }));
        }

        res.json({
            message: `Sent ${sent} messages, ${errors} errors`,
            sent,
            errors,
            results
        });

    } catch (error) {
        console.error("Error sending selected items:", error);
        res.status(500).json({ error: error.message });
    }
});

// Get error logs
app.get('/api/logs', authMiddleware, (req, res) => {
    const { tipo, startDate, endDate, search } = req.query;

    let query = "SELECT * FROM error_logs WHERE 1=1";
    const params = [];

    if (tipo) {
        query += " AND tipo = ?";
        params.push(tipo);
    }

    if (startDate) {
        query += " AND DATE(data_hora) >= DATE(?)";
        params.push(startDate);
    }

    if (endDate) {
        query += " AND DATE(data_hora) <= DATE(?)";
        params.push(endDate);
    }

    if (search) {
        query += " AND (mensagem LIKE ? OR detalhes LIKE ? OR client_code LIKE ? OR phone LIKE ?)";
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += " ORDER BY data_hora DESC";

    // Only limit if no filters are applied to allow for full range searches
    if (params.length === 0) {
        query += " LIMIT 200";
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows || []);
    });
});

// Toggle item selection
app.put('/api/queue/items/:id/select', (req, res) => {
    const { id } = req.params;
    const { selected } = req.body;

    db.run(
        "UPDATE queue_items SET selected_for_send = ? WHERE id = ?",
        [selected ? 1 : 0, id],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: "Selection updated", changes: this.changes });
        }
    );
});



// Delete error logs
app.delete('/api/logs', authMiddleware, (req, res) => {
    const { ids, all } = req.body;

    if (all) {
        db.run("DELETE FROM error_logs", (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            console.log('Todos os logs de sistema foram excluídos');
            res.json({ message: "Todos os logs foram excluídos" });
        });
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        db.run(`DELETE FROM error_logs WHERE id IN (${placeholders})`, ids, function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            console.log(`${this.changes} logs de sistema excluídos`);
            res.json({ message: `${ids.length} logs excluídos`, deleted: this.changes });
        });
    } else {
        res.status(400).json({ error: "IDs ou flag 'all' necessários" });
    }
});

// --- Duplicate Logs API ---

app.get('/api/logs/duplicates', authMiddleware, (req, res) => {
    const { startDate, endDate, type, client } = req.query;

    let query = "SELECT * FROM duplicate_logs WHERE 1=1";
    const params = [];

    if (startDate) {
        query += " AND date(created_at) >= date(?)";
        params.push(startDate);
    }

    if (endDate) {
        query += " AND date(created_at) <= date(?)";
        params.push(endDate);
    }

    if (type && type !== 'all') {
        query += " AND message_type = ?";
        params.push(type);
    }

    if (client) {
        query += " AND (client_name LIKE ? OR client_code LIKE ? OR item_id LIKE ?)";
        params.push(`%${client}%`, `%${client}%`, `%${client}%`);
    }

    query += " ORDER BY created_at DESC LIMIT 500";

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Erro ao buscar logs de duplicatas:', err);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.delete('/api/logs/duplicates', authMiddleware, (req, res) => {
    const { ids, all } = req.body;

    if (all) {
        db.run("DELETE FROM duplicate_logs", (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: "Todos os logs de duplicatas foram excluídos" });
        });
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        db.run(`DELETE FROM duplicate_logs WHERE id IN (${placeholders})`, ids, (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: `${ids.length} logs excluídos` });
        });
    } else {
        res.status(400).json({ error: "IDs ou flag 'all' necessários" });
    }
});

// Get error logs
app.get('/api/logs', (req, res) => {
    db.all("SELECT * FROM error_logs ORDER BY data_hora DESC LIMIT 100", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows || []);
    });
});

// Get log cleanup configuration
app.get('/api/logs/cleanup-config', authMiddleware, (req, res) => {
    db.all("SELECT * FROM log_cleanup_config ORDER BY log_type", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows || []);
    });
});

// Update log cleanup configuration
app.post('/api/logs/cleanup-config', authMiddleware, (req, res) => {
    const configs = req.body; // Array of {log_type, retention_days, enabled}

    if (!Array.isArray(configs)) {
        res.status(400).json({ error: "Expected array of configs" });
        return;
    }

    const stmt = db.prepare(`
        UPDATE log_cleanup_config 
        SET retention_days = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE log_type = ?
    `);

    let errors = [];
    configs.forEach(config => {
        stmt.run(config.retention_days, config.enabled ? 1 : 0, config.log_type, (err) => {
            if (err) errors.push(err.message);
        });
    });

    stmt.finalize((err) => {
        if (err || errors.length > 0) {
            res.status(500).json({ error: errors.join('; ') || err.message });
            return;
        }
        res.json({ message: "Configuração de limpeza atualizada com sucesso" });
    });
});

// Function to perform automatic log cleanup
function performLogCleanup() {
    db.all("SELECT * FROM log_cleanup_config WHERE enabled = 1", (err, configs) => {
        if (err || !configs) return;

        configs.forEach(config => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - config.retention_days);
            const cutoffStr = cutoffDate.toISOString();

            if (config.log_type === 'DUPLICATAS') {
                db.run(
                    "DELETE FROM duplicate_logs WHERE created_at < ?",
                    [cutoffStr],
                    function(err) {
                        if (!err && this.changes > 0) {
                            console.log(`Limpeza automática: ${this.changes} logs de duplicatas removidos (>${config.retention_days} dias)`);
                        }
                    }
                );
            } else {
                db.run(
                    "DELETE FROM error_logs WHERE tipo = ? AND data_hora < ?",
                    [config.log_type, cutoffStr],
                    function(err) {
                        if (!err && this.changes > 0) {
                            console.log(`Limpeza automática: ${this.changes} logs de ${config.log_type} removidos (>${config.retention_days} dias)`);
                        }
                    }
                );
            }
        });
    });
}

// Run cleanup daily at 12 PM (noon)
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 12 && now.getMinutes() < 30) {
        performLogCleanup();
    }
}, 30 * 60 * 1000); // Check every 30 minutes

// --- Scheduler for Automatic Generation ---
const SCHEDULER_INTERVAL = 30 * 60 * 1000; // Check every 30 minutes

// Helper function to get config
function getConfig() {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM message_config LIMIT 1", (err, row) => {
            if (err) reject(err);
            else resolve(row || {});
        });
    });
}

// Helper function to mark execution
function markAsExecuted() {
    return new Promise((resolve, reject) => {
        db.run(
            "UPDATE message_config SET last_auto_run = CURRENT_TIMESTAMP WHERE id = 1",
            (err) => {
                if (err) reject(err);
                else {
                    console.log("Scheduler: Marked as executed for today");
                    resolve();
                }
            }
        );
    });
}

setInterval(async () => {
    try {
        // 1. Get configuration
        const config = await getConfig();

        // 2. Check if auto-send is enabled
        if (!config.auto_send_enabled) {
            logScheduler("Auto-send desabilitado, aguardando próxima verificação");
            return;
        }

        // 3. Check if already executed today
        const now = new Date();
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

        if (config.last_auto_run) {
            const lastRunDate = config.last_auto_run.split(' ')[0]; // Extract date part
            if (lastRunDate === today) {
                logScheduler("Já executado hoje, aguardando próximo dia", `Última execução: ${config.last_auto_run}`);
                return;
            }
        }

        // 4. Check if current time >= configured time
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const configuredTime = config.send_time || '09:00';

        if (currentTime < configuredTime) {
            logScheduler("Aguardando horário configurado", `Atual: ${currentTime}, Configurado: ${configuredTime}`);
            return;
        }

        // 5. Execute automatic generation
        logScheduler("Iniciando geração automática de mensagens", `Horário: ${currentTime}`);

        // Only run if there are active configurations for auto-generation
        try {
            const remindersResponse = await fetch(`http://localhost:${PORT}/api/queue/generate-test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SYSTEM_TOKEN}`
                },
                body: JSON.stringify({ messageType: 'reminder' })
            });

            if (remindersResponse.ok) {
                const reminders = await remindersResponse.json();
                logScheduler(`Busca de Lembretes realizada`, `Encontrados: ${reminders.length}`);
                if (reminders.length > 0) {
                    await fetch(`http://localhost:${PORT}/api/queue/add-items`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${SYSTEM_TOKEN}`
                        },
                        body: JSON.stringify({ items: reminders, send_mode: 'AUTO' })
                    });
                    logScheduler(`Lembretes adicionados à fila`, `${reminders.length} itens`);
                }
            } else {
                logScheduler(`Erro ao buscar lembretes`, `Status: ${remindersResponse.status}`);
            }
        } catch (e) {
            logScheduler(`Erro na requisição de lembretes`, e.message);
        }

        // 2. Generate Overdue
        try {
            const overdueResponse = await fetch(`http://localhost:${PORT}/api/queue/generate-test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SYSTEM_TOKEN}`
                },
                body: JSON.stringify({ messageType: 'overdue' })
            });

            if (overdueResponse.ok) {
                const overdue = await overdueResponse.json();
                logScheduler(`Busca de Vencimentos realizada`, `Encontrados: ${overdue.length}`);
                if (overdue.length > 0) {
                    await fetch(`http://localhost:${PORT}/api/queue/add-items`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${SYSTEM_TOKEN}`
                        },
                        body: JSON.stringify({ items: overdue, send_mode: 'AUTO' })
                    });
                    logScheduler(`Mensagens de vencimento adicionadas à fila`, `${overdue.length} itens`);
                }
            } else {
                logScheduler(`Erro ao buscar vencimentos`, `Status: ${overdueResponse.status}`);
            }
        } catch (e) {
            logScheduler(`Erro na requisição de vencimentos`, e.message);
        }

        // 6. Mark as executed
        await markAsExecuted();

    } catch (error) {
        logScheduler("Erro na execução automática", error.message || error.toString());
        console.error("Scheduler Error:", error);
    }

}, SCHEDULER_INTERVAL);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
