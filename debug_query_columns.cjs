const sql = require('mssql');
const sqlite3 = require('sqlite3');
const path = require('path');

// Configuração do SQLite
const dbPath = path.resolve(__dirname, 'server/database.sqlite');
const db = new sqlite3.Database(dbPath);

async function run() {
    try {
        // 1. Pegar configuração do SQL Server
        const sqlConfig = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM db_connections WHERE active = 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!sqlConfig) {
            console.error("Nenhuma configuração de banco SQL Server ativa encontrada.");
            return;
        }

        const config = {
            user: sqlConfig.user,
            password: sqlConfig.password,
            server: sqlConfig.host,
            database: sqlConfig.database,
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        };

        // 2. Pegar a última query salva
        const savedQuery = await new Promise((resolve, reject) => {
            db.get("SELECT query_text FROM saved_queries ORDER BY id DESC LIMIT 1", (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.query_text : null);
            });
        });

        if (!savedQuery) {
            console.error("Nenhuma query salva encontrada.");
            return;
        }

        console.log("--- Query Salva ---");
        console.log(savedQuery);
        console.log("-------------------");

        // 3. Executar no SQL Server
        await sql.connect(config);
        const result = await sql.query(savedQuery);

        if (result.recordset.length > 0) {
            const firstRow = result.recordset[0];
            console.log("\n--- Primeiro Registro Encontrado ---");
            console.log(JSON.stringify(firstRow, null, 2));
            console.log("\n--- Chaves (Colunas) ---");
            console.log(Object.keys(firstRow));

            if (firstRow.hasOwnProperty('descricaoparcela')) {
                console.log("\n✅ Coluna 'descricaoparcela' ENCONTRADA!");
                console.log("Valor:", firstRow.descricaoparcela);
            } else {
                console.log("\n❌ Coluna 'descricaoparcela' NÃO encontrada!");
                // Verificar case insensitive
                const key = Object.keys(firstRow).find(k => k.toLowerCase() === 'descricaoparcela');
                if (key) {
                    console.log(`⚠️ Mas encontrei '${key}'. O código espera 'descricaoparcela' (minúsculo).`);
                }
            }
        } else {
            console.log("Query retornou 0 resultados.");
        }

    } catch (err) {
        console.error("Erro:", err);
    } finally {
        db.close();
        await sql.close();
    }
}

run();
