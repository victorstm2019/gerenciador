const sql = require('mssql');
const sqlite3 = require('sqlite3');
const path = require('path');
const express = require('express');

const app = express();
app.use(express.json());

const dbPath = path.resolve(__dirname, 'server/database.sqlite');
const db = new sqlite3.Database(dbPath);

app.post('/api/test-description', async (req, res) => {
    try {
        // Get SQL Server config
        const sqlConfig = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM db_connections WHERE active = 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        const config = {
            user: sqlConfig.user,
            password: sqlConfig.password,
            server: sqlConfig.host,
            database: sqlConfig.database,
            options: { encrypt: false, trustServerCertificate: true }
        };

        // Get saved query
        const savedQuery = await new Promise((resolve, reject) => {
            db.get("SELECT query_text FROM saved_queries ORDER BY id DESC LIMIT 1", (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.query_text : null);
            });
        });

        // Execute query
        const pool = await sql.connect(config);
        const result = await pool.request().query(savedQuery + " ORDER BY NEWID()");

        if (result.recordset.length > 0) {
            const client = result.recordset[0];
            res.json({
                success: true,
                keys: Object.keys(client),
                descricaoparcela: client.descricaoparcela,
                DESCRICAOPARCELA: client.DESCRICAOPARCELA,
                Descricao: client.Descricao,
                DESCRICAO: client.DESCRICAO
            });
        } else {
            res.json({ success: false, message: 'No records' });
        }

        await pool.close();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = 3003;
app.listen(PORT, () => {
    console.log(`Test server running on http://localhost:${PORT}`);
    console.log('Call: POST http://localhost:3003/api/test-description');
});
