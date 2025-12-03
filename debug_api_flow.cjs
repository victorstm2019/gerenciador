// const fetch = require('node-fetch'); // Usando fetch nativo do Node 18+
const sqlite3 = require('sqlite3');
const path = require('path');

const API_URL = 'http://localhost:3002/api/queue';
const dbPath = path.resolve(__dirname, 'server/database.sqlite');

async function run() {
    try {
        console.log("1. Chamando generate-test...");
        const genRes = await fetch(`${API_URL}/generate-test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageType: 'reminder', limit: 1 })
        });

        if (!genRes.ok) throw new Error(`Generate falhou: ${genRes.statusText}`);
        const generated = await genRes.json();

        if (generated.length === 0) {
            console.log("Nenhuma mensagem gerada para teste.");
            return;
        }

        const firstItem = generated[0];
        console.log("Item gerado:", JSON.stringify(firstItem, null, 2));

        if (!firstItem.description) {
            console.error("❌ ERRO: Item gerado não tem 'description'!");
        } else {
            console.log("✅ Item gerado tem 'description'.");
        }

        console.log("\n2. Chamando add-items...");
        // Forçar um ID único para não dar duplicidade
        firstItem.id = `TEST_${Date.now()}`;
        firstItem.code = `TEST_${Date.now()}`;

        const addRes = await fetch(`${API_URL}/add-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [firstItem], send_mode: 'MANUAL' })
        });

        if (!addRes.ok) throw new Error(`Add falhou: ${addRes.statusText}`);
        console.log("Adicionado com sucesso.");

        console.log("\n3. Verificando no banco SQLite...");
        const db = new sqlite3.Database(dbPath);

        db.get("SELECT * FROM queue_items WHERE client_code = ?", [firstItem.code], (err, row) => {
            if (err) console.error("Erro ao ler banco:", err);
            else {
                console.log("Registro no banco:", JSON.stringify(row, null, 2));
                if (row.description === firstItem.description) {
                    console.log("✅ SUCESSO: Descrição gravada corretamente no banco!");
                } else {
                    console.log("❌ FALHA: Descrição no banco diferente ou vazia.");
                    console.log(`Esperado: '${firstItem.description}'`);
                    console.log(`Encontrado: '${row.description}'`);
                }
            }
            db.close();
        });

    } catch (err) {
        console.error("Erro:", err);
    }
}

run();
