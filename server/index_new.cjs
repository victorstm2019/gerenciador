const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db.cjs');
const sql = require('mssql');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(bodyParser.json());

// --- Message Config API ---

// Get Config
app.get('/api/config', (req, res) => {
    db.get("SELECT * FROM message_config LIMIT 1", (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row);
    });
});

// Update Config
app.post('/api/config', (req, res) => {
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
        overdue_repeat_interval_days
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
    overdue_repeat_interval_days = ?
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
        overdue_repeat_interval_days
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
app.get('/api/connection', (req, res) => {
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
app.post('/api/connection', (req, res) => {
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
app.post('/api/connection/test', async (req, res) => {
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
app.post('/api/query/save', (req, res) => {
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
app.get('/api/query/saved', (req, res) => {
    db.all("SELECT * FROM saved_queries ORDER BY created_at DESC LIMIT 10", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Delete Saved Query
app.delete('/api/query/saved/:id', (req, res) => {
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
app.post('/api/query/execute', async (req, res) => {
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
app.put('/api/users/:id/change-password', (req, res) => {
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
app.get('/api/users', (req, res) => {
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
app.post('/api/users', (req, res) => {
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
app.put('/api/users/:id/permissions', (req, res) => {
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
app.put('/api/users/:id/password', (req, res) => {
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
app.put('/api/users/:id/block', (req, res) => {
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
app.delete('/api/users/:id', (req, res) => {
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
app.get('/api/wapi/config', (req, res) => {
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
app.post('/api/wapi/config', (req, res) => {
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
app.post('/api/wapi/test', async (req, res) => {
    const { instance_id, bearer_token } = req.body;

    if (!instance_id || !bearer_token) {
        res.status(400).json({ error: "Instance ID and Bearer Token are required" });
        return;
    }

    try {
        const fetch = (await import('node-fetch')).default;
        const url = `https://w-api.izy.one/instance/status/${instance_id}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${bearer_token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            res.json({
                success: true,
                message: "Conexão bem sucedida!",
                status: data
            });
        } else {
            res.status(response.status).json({
                success: false,
                error: data.message || "Erro ao conectar com W-API"
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
app.post('/api/wapi/send-test', async (req, res) => {
    const { instance_id, bearer_token, phone, message } = req.body;

    if (!instance_id || !bearer_token || !phone) {
        res.status(400).json({ error: "Instance ID, Bearer Token, and Phone are required" });
        return;
    }

    try {
        const fetch = (await import('node-fetch')).default;
        const url = `https://w-api.izy.one/message/sendText/${instance_id}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${bearer_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: phone,
                message: message || "Mensagem de teste do Gerenciador"
            })
        });

        const data = await response.json();

        if (response.ok) {
            res.json({
                success: true,
                message: "Mensagem enviada com sucesso!",
                result: data
            });
        } else {
            res.status(response.status).json({
                success: false,
                error: data.message || "Erro ao enviar mensagem"
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
app.post('/api/queue/generate-test', async (req, res) => {
    const { messageType, limit = 10 } = req.body; // 'reminder' or 'overdue'

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
                    SELECT TOP ${limit} *
                    FROM BaseData
                    WHERE CONVERT(DATE, vencimento, 103) >= '${today.toISOString().split('T')[0]}'
                    AND CONVERT(DATE, vencimento, 103) <= '${targetDate.toISOString().split('T')[0]}'
                    ORDER BY CONVERT(DATE, vencimento, 103)
                `;
            } else {
                const daysBack = config.overdue_days || 3;
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() - daysBack);

                finalQuery = `
                    WITH BaseData AS (
                        ${cleanBaseQuery}
                    )
                    SELECT TOP ${limit} *
                    FROM BaseData
                    WHERE CONVERT(DATE, vencimento, 103) < '${today.toISOString().split('T')[0]}'
                    AND CONVERT(DATE, vencimento, 103) >= '${targetDate.toISOString().split('T')[0]}'
                    ORDER BY CONVERT(DATE, vencimento, 103) DESC
                `;
            }

            const result = await pool.request().query(finalQuery);
            const clients = result.recordset;

            // Generate messages
            const template = messageType === 'reminder' ? config.reminder_msg : config.overdue_msg;

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

                return {
                    id: client.codigocliente || client.id,
                    code: client.codigocliente,
                    clientName: client.nomecliente,
                    cpf: client.cpfcliente,
                    phone: client.fone1 || client.fone2,
                    dueDate: client.vencimento,
                    installmentValue: client.valorfinalparcela || client.valorbrutoparcela || 0,
                    value: client.valorfinalparcela || client.valorbrutoparcela || 0,
                    messageContent: message,
                    messageType: messageType,
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
app.post('/api/queue/generate-batch', async (req, res) => {
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

            for (const type of types) {
                let finalQuery;
                if (type === 'reminder') {
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
                } else if (type === 'overdue') {
                    const daysBack = config.overdue_days || 3;
                    const targetDate = new Date(today);
                    targetDate.setDate(today.getDate() - daysBack);

                    finalQuery = `
                        WITH BaseData AS (
                            ${cleanBaseQuery}
                        )
                        SELECT *
                        FROM BaseData
                        WHERE CONVERT(DATE, vencimento, 103) < '${today.toISOString().split('T')[0]}'
                        AND CONVERT(DATE, vencimento, 103) >= '${targetDate.toISOString().split('T')[0]}'
                        ORDER BY CONVERT(DATE, vencimento, 103) DESC
                    `;
                }

                if (finalQuery) {
                    const result = await pool.request().query(finalQuery);
                    const clients = result.recordset;
                    const template = type === 'reminder' ? config.reminder_msg : config.overdue_msg;

                    // LOG DE DEBUG
                    if (clients.length > 0) {
                        console.log('\n=== DEBUG GENERATE-TEST ===');
                        console.log('Total de clientes:', clients.length);
                        console.log('Chaves do primeiro cliente:', Object.keys(clients[0]));
                        console.log('Primeiro cliente completo:', JSON.stringify(clients[0], null, 2));
                        console.log('===========================\n');
                    }

                    // Helper function to get value case-insensitive
                    const getValue = (obj, key) => {
                        if (obj[key] !== undefined) return obj[key];
                        const lowerKey = key.toLowerCase();
                        const foundKey = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
                        return foundKey ? obj[foundKey] : undefined;
                    };

                    const messages = clients.map((client, idx) => {
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

                        const desc = getValue(client, 'descricaoparcela') || '';

                        if (idx === 0) {
                            console.log('\n=== DEBUG PRIMEIRO ITEM ===');
                            console.log('Todas as chaves:', Object.keys(client));
                            console.log('client["descricaoparcela"]:', client["descricaoparcela"]);
                            console.log('client["DESCRICAOPARCELA"]:', client["DESCRICAOPARCELA"]);
                            console.log('getValue result:', desc);
                            console.log('===========================\n');
                        }

                        return {
                            id: getValue(client, 'codigocliente') || client.id,
                            code: getValue(client, 'codigocliente'),
                            clientName: getValue(client, 'nomecliente'),
                            cpf: getValue(client, 'cpfcliente'),
                            dueDate: getValue(client, 'vencimento'),
                            value: getValue(client, 'valorfinalparcela') || getValue(client, 'valorbrutoparcela') || 0,
                            messageContent: message,
                            messageType: type,
                            status: 'PREVIEW',
                            phone: getValue(client, 'fone1') || '',
                            description: desc,
                            _debug_timestamp: new Date().toISOString(),
                            _debug_keys: Object.keys(client),
                            _debug_desc_raw: client.descricaoparcela,
                            _debug_desc_upper: client.DESCRICAOPARCELA,
                            _debug_desc_getValue: desc
                        };
                    });
                    allMessages = [...allMessages, ...messages];
                }
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

// Get all field mappings
app.get('/api/field-mappings', (req, res) => {
    db.all("SELECT * FROM field_mappings ORDER BY id", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows || []);
    });
});

// Save/Update field mappings
app.post('/api/field-mappings', (req, res) => {
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
app.post('/api/blocked/by-installment', (req, res) => {
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
app.post('/api/blocked/by-client', (req, res) => {
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
app.get('/api/queue/items', (req, res) => {
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
app.get('/api/queue/today', async (req, res) => {
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
                const mappedRows = await Promise.all((rows || []).map(async row => {
                    let description = row.description || '';

                    // Try to fetch description from SQL Server
                    if (row.client_code) {
                        try {
                            const result = await pool.request()
                                .input('codigo', sql.VarChar, row.client_code)
                                .query(`
                                    SELECT TOP 1 FC.Descricao 
                                    FROM FINANCEIRO_CONTA FC
                                    WHERE FC.Cliente__Codigo = @codigo
                                    AND FC.PAGAR_RECEBER = 'R'
                                    AND FC.SITUACAO = 'A'
                                    ORDER BY FC.VENCIMENTO DESC
                                `);

                            if (result.recordset.length > 0) {
                                description = result.recordset[0].Descricao || description;
                            }
                        } catch (sqlErr) {
                            console.error('Error fetching description:', sqlErr);
                        }
                    }

                    return {
                        id: row.id,
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
                        description: description
                    };
                }));

                await pool.close();
                res.json(mappedRows);
            } else {
                // No SQL config, return without descriptions
                const mappedRows = (rows || []).map(row => ({
                    id: row.id,
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
        } catch (err) {
            console.error('Error in /api/queue/today:', err);
            // Fallback to basic mapping
            const mappedRows = (rows || []).map(row => ({
                id: row.id,
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
app.get('/api/blocked', (req, res) => {
    db.all("SELECT * FROM blocked_clients ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows || []);
    });
});

// Delete blocked client
app.delete('/api/blocked/:id', (req, res) => {
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
app.post('/api/queue/add-items', async (req, res) => {
    const { items, send_mode } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: "Items array is required" });
        return;
    }

    try {
        let inserted = 0;
        let skipped = 0;

        for (const item of items) {
            // Check if item already exists (same client, installment, type, and pending)
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
                skipped++;
                continue; // Skip duplicate
            }

            // Insert new item
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO queue_items (
                        client_code, client_name, cpf, phone, installment_id,
                        installment_value, due_date, message_content, message_type,
                        send_mode, status, description, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, CURRENT_TIMESTAMP)`,
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
                        item.messageContent,
                        item.messageType,
                        send_mode || 'MANUAL',
                        item.description || item.descricao || ''
                    ],
                    function (err) {
                        if (err) reject(err);
                        else {
                            inserted++;
                            resolve();
                        }
                    }
                );
            });
        }

        res.json({
            message: "Items processed",
            inserted,
            skipped,
            total: items.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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

// Delete multiple queue items
app.delete('/api/queue/items/bulk', (req, res) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: "IDs array is required" });
        return;
    }

    const placeholders = ids.map(() => '?').join(',');
    const query = `DELETE FROM queue_items WHERE id IN (${placeholders})`;

    db.run(query, ids, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Items deleted", deleted: this.changes });
    });
});

// Delete single queue item
app.delete('/api/queue/:id', (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM queue_items WHERE id = ?', [id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
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
    const url = `https://w-api.izy.one/message/sendText/${wapiConfig.instance_id}`;

    // Clean phone number (remove non-digits)
    const cleanPhone = phone.replace(/\D/g, '');

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${wapiConfig.bearer_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            phone: cleanPhone,
            message: message
        })
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
        ['SCHEDULER', mensagem, detalhes],
        (err) => {
            if (err) {
                console.error("Error logging scheduler:", err);
            }
        }
    );
    console.log(`Scheduler: ${mensagem}`);
}

// Send selected items
app.post('/api/queue/send-selected', async (req, res) => {
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
app.get('/api/logs', (req, res) => {
    db.all("SELECT * FROM error_logs ORDER BY data_hora DESC LIMIT 100", (err, rows) => {
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
    const url = `https://w-api.izy.one/message/sendText/${wapiConfig.instance_id}`;

    // Clean phone number (remove non-digits)
    const cleanPhone = phone.replace(/\D/g, '');

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${wapiConfig.bearer_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            phone: cleanPhone,
            message: message
        })
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

// Send selected items
app.post('/api/queue/send-selected', async (req, res) => {
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
app.get('/api/logs', (req, res) => {
    db.all("SELECT * FROM error_logs ORDER BY data_hora DESC LIMIT 100", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows || []);
    });
});

// --- Scheduler for Automatic Generation ---
const SCHEDULER_INTERVAL = 60 * 60 * 1000; // Check every hour
// const SCHEDULER_INTERVAL = 60 * 1000; // DEBUG: Check every minute

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
        // For now, we'll assume we want to generate daily reminders/overdue
        // Ideally, this should be configurable in the database

        // 1. Generate Reminders
        const remindersResponse = await fetch('http://localhost:3002/api/queue/generate-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageType: 'reminder', limit: 50 }) // Reasonable limit per run
        });

        if (remindersResponse.ok) {
            const reminders = await remindersResponse.json();
            if (reminders.length > 0) {
                await fetch('http://localhost:3002/api/queue/add-items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: reminders, send_mode: 'AUTO' })
                });
                logScheduler(`Lembretes adicionados à fila`, `${reminders.length} itens`);
            }
        }

        // 2. Generate Overdue
        const overdueResponse = await fetch('http://localhost:3002/api/queue/generate-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageType: 'overdue', limit: 50 })
        });

        if (overdueResponse.ok) {
            const overdue = await overdueResponse.json();
            if (overdue.length > 0) {
                await fetch('http://localhost:3002/api/queue/add-items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: overdue, send_mode: 'AUTO' })
                });
                logScheduler(`Mensagens de vencimento adicionadas à fila`, `${overdue.length} itens`);
            }
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
