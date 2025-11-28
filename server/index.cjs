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
    const { send_time, reminder_enabled, reminder_days, reminder_msg, overdue_enabled, overdue_days, overdue_msg } = req.body;

    // We assume there's always one row with ID 1 (created in db.js)
    const sqlQuery = `UPDATE message_config SET 
    send_time = ?, 
    reminder_enabled = ?, 
    reminder_days = ?, 
    reminder_msg = ?, 
    overdue_enabled = ?, 
    overdue_days = ?, 
    overdue_msg = ? 
    WHERE id = 1`; // Or use a WHERE clause that targets the single config row

    // Note: In a robust system we might upsert, but here we rely on the seed.
    // Let's use a more robust approach: check if exists, if not insert, else update.
    // But for now, since db.js seeds it, update is fine.

    db.run(sqlQuery, [send_time, reminder_enabled, reminder_days, reminder_msg, overdue_enabled, overdue_days, overdue_msg], function (err) {
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
