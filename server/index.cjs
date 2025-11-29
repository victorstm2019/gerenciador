const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db.cjs');
const sql = require('mssql');

const app = express();
const PORT = 3001;

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
        reminder_enabled,
        reminder_days,
        reminder_msg,
        reminder_repeat_times ?? 1,
        reminder_repeat_interval_days ?? 3,
        overdue_enabled,
        overdue_days,
        overdue_msg,
        overdue_repeat_times ?? 1,
        overdue_repeat_interval_days ?? 7
    ], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Configuration updated", changes: this.changes });
    });
});

// --- Queue API ---

// Get Queue
app.get('/api/queue', (req, res) => {
    db.all("SELECT * FROM queue_items ORDER BY id DESC", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // Map snake_case to camelCase for frontend if needed, or handle in frontend.
        // Let's return as is and handle mapping in frontend or here.
        // To minimize frontend changes, let's map here.
        const mappedRows = rows.map(row => ({
            id: row.id.toString(),
            clientName: row.client_name,
            installmentValue: row.installment_value,
            dueDate: row.due_date,
            scheduledDate: row.scheduled_date,
            sentDate: row.sent_date,
            errorDate: row.error_date,
            code: row.code,
            cpf: row.cpf,
            status: row.status
        }));
        res.json(mappedRows);
    });
});

// Add/Update Queue Item (Simplified for now, maybe just Add)
app.post('/api/queue', (req, res) => {
    // Implementation for adding items if needed
    res.status(501).json({ message: "Not implemented yet" });
});

// --- Blocked List API ---

// Get Blocked
app.get('/api/blocked', (req, res) => {
    db.all("SELECT * FROM blocked_clients ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Add Blocked
app.post('/api/blocked', (req, res) => {
    const { identifier, client_name, reason } = req.body;
    const sqlQuery = "INSERT INTO blocked_clients (identifier, client_name, reason) VALUES (?, ?, ?)";
    db.run(sqlQuery, [identifier, client_name, reason], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, identifier, client_name, reason });
    });
});

// Delete Blocked
app.delete('/api/blocked/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM blocked_clients WHERE id = ?", id, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Deleted", changes: this.changes });
    });
});

// --- SQL Server & Connection API ---

// Get Connection
app.get('/api/connection', (req, res) => {
    db.get("SELECT * FROM db_connections ORDER BY id DESC LIMIT 1", (err, row) => {
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

// Save Connection
app.post('/api/connection', (req, res) => {
    const { host, database, user, password } = req.body;
    db.run("INSERT INTO db_connections (host, database, user, password) VALUES (?, ?, ?, ?)",
        [host, database, user, password], function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: "Connection saved" });
        });
});

// Test Connection
app.post('/api/connection/test', async (req, res) => {
    const { host, database, user, password } = req.body;
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

    let pool;
    try {
        pool = await sql.connect(config);
        res.json({ message: "Connection successful" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (pool) {
            await pool.close();
        }
    }
});

// Save Query
app.post('/api/query/save', (req, res) => {
    const { query } = req.body;
    db.run("INSERT INTO saved_queries (name, query_text) VALUES (?, ?)",
        ['Last Query', query], function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: "Query saved", id: this.lastID });
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
