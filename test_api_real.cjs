async function testAPI() {
    try {
        console.log('=== TESTANDO API REAL ===\n');

        // 1. Limpar fila
        console.log('1. Limpando fila...');
        const clearRes = await fetch('http://localhost:3002/api/queue/items', {
            method: 'DELETE'
        });
        console.log('   Fila limpa\n');

        // 2. Gerar mensagens
        console.log('2. Gerando lembretes...');
        const genRes = await fetch('http://localhost:3002/api/queue/generate-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageType: 'reminder', limit: 3 })
        });

        if (!genRes.ok) {
            const errorText = await genRes.text();
            console.error('   ERRO:', genRes.status, genRes.statusText);
            console.error('   Detalhes:', errorText);
            return;
        }

        const generated = await genRes.json();
        console.log(`   ${generated.length} mensagens geradas\n`);

        if (generated.length > 0) {
            const first = generated[0];
            console.log('3. PRIMEIRA MENSAGEM GERADA:');
            console.log('   Cliente:', first.clientName);
            console.log('   Código:', first.code);
            console.log('   Telefone:', first.phone || '(vazio)');
            console.log('   Descrição:', first.description || '(vazio)');

            if (first.description) {
                console.log('\n   ✅ DESCRIÇÃO PRESENTE!');
            } else {
                console.log('\n   ❌ DESCRIÇÃO AUSENTE!');
            }

            // 3. Adicionar à fila
            console.log('\n4. Adicionando à fila...');
            const addRes = await fetch('http://localhost:3002/api/queue/add-items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: generated, send_mode: 'MANUAL' })
            });

            const addResult = await addRes.json();
            console.log('   Resultado:', addResult);

            // 4. Buscar da fila
            console.log('\n5. Buscando da fila...');
            const listRes = await fetch('http://localhost:3002/api/queue/today');
            const items = await listRes.json();

            if (items.length > 0) {
                const firstItem = items[0];
                console.log('   Primeiro item da fila:');
                console.log('   Cliente:', firstItem.clientName);
                console.log('   Descrição:', firstItem.description || '(vazio)');

                if (firstItem.description) {
                    console.log('\n   ✅ DESCRIÇÃO SALVA E RETORNADA CORRETAMENTE!');
                } else {
                    console.log('\n   ❌ DESCRIÇÃO PERDIDA NO PROCESSO!');
                }
            }
        }

    } catch (err) {
        console.error('ERRO:', err.message);
    }
}

testAPI();
