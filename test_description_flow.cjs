const sql = require('mssql');
const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/database.sqlite');
const db = new sqlite3.Database(dbPath);

async function testFlow() {
    try {
        console.log('=== TESTE DE FLUXO COMPLETO ===\n');

        // 1. Pegar config SQL Server
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

        // 2. Pegar query salva
        const savedQuery = await new Promise((resolve, reject) => {
            db.get("SELECT query_text FROM saved_queries ORDER BY id DESC LIMIT 1", (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.query_text : null);
            });
        });

        // 3. Executar query com TOP (SQL Server não usa LIMIT)
        const queryWithTop = `
            WITH BaseData AS (
                ${savedQuery}
            )
            SELECT TOP 1 * FROM BaseData
            ORDER BY CONVERT(DATE, vencimento, 103)
        `;

        await sql.connect(config);
        const result = await sql.query(queryWithTop);

        if (result.recordset.length === 0) {
            console.log('Nenhum registro encontrado');
            return;
        }

        const client = result.recordset[0];

        console.log('1. DADOS DO SQL SERVER:');
        console.log('   Chaves:', Object.keys(client));
        console.log('   descricaoparcela:', client.descricaoparcela);
        console.log('   DESCRICAOPARCELA:', client.DESCRICAOPARCELA);
        console.log('   Descricao:', client.Descricao);
        console.log('   DESCRICAO:', client.DESCRICAO);

        // Testar função getValue
        const getValue = (obj, key) => {
            if (obj[key] !== undefined) return obj[key];
            const lowerKey = key.toLowerCase();
            const foundKey = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
            return foundKey ? obj[foundKey] : undefined;
        };

        const desc = getValue(client, 'descricaoparcela');
        console.log('\n2. RESULTADO DA FUNÇÃO getValue:');
        console.log('   getValue(client, "descricaoparcela"):', desc);

        // 4. Simular objeto que seria retornado pela API
        const apiObject = {
            id: getValue(client, 'codigocliente'),
            code: getValue(client, 'codigocliente'),
            clientName: getValue(client, 'nomecliente'),
            cpf: getValue(client, 'cpfcliente'),
            dueDate: getValue(client, 'vencimento'),
            phone: getValue(client, 'fone1') || '',
            description: getValue(client, 'descricaoparcela') || ''
        };

        console.log('\n3. OBJETO QUE A API RETORNARIA:');
        console.log(JSON.stringify(apiObject, null, 2));

        console.log('\n4. VERIFICAÇÃO FINAL:');
        if (apiObject.description) {
            console.log('   ✅ DESCRIÇÃO PRESENTE:', apiObject.description);
        } else {
            console.log('   ❌ DESCRIÇÃO VAZIA OU UNDEFINED');
        }

    } catch (err) {
        console.error('ERRO:', err);
    } finally {
        db.close();
        await sql.close();
    }
}

testFlow();
