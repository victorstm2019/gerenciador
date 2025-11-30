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
                    dueDate: client.vencimento,
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

                    const messages = clients.map(client => {
                        let message = template;
                        Object.keys(fieldMap).forEach(variable => {
                            const dbColumn = fieldMap[variable];
                            let value = client[dbColumn] || '';
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

                        return {
                            id: client.codigocliente || client.id,
                            code: client.codigocliente,
                            clientName: client.nomecliente,
                            cpf: client.cpfcliente,
                            dueDate: client.vencimento,
                            value: client.valorfinalparcela || client.valorbrutoparcela || 0,
                            messageContent: message,
                            messageType: type,
                            status: 'PREVIEW'
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
