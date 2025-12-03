async function test() {
    try {
        console.log('Chamando API...');
        const res = await fetch('http://localhost:3002/api/queue/generate-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageType: 'overdue', limit: 5 })
        });

        if (!res.ok) {
            const text = await res.text();
            console.error('ERRO:', res.status, text);
            return;
        }

        const data = await res.json();
        console.log('\nRESPOSTA DA API:');
        console.log(JSON.stringify(data, null, 2));

        if (data.length > 0) {
            console.log('\nPRIMEIRO ITEM:');
            console.log('Cliente:', data[0].clientName);
            console.log('Descrição:', data[0].description || '(VAZIO)');
            console.log('Chaves disponíveis:', JSON.stringify(data[0].debug_keys, null, 2));
        }
    } catch (err) {
        console.error('ERRO:', err.message);
    }
}

test();
