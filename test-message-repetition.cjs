const http = require('http');

function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: method,
            headers: data ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(data))
            } : {}
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch {
                    resolve(body);
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function testMessageConfig() {
    console.log('=== Testando Configuração de Mensagens com Repetição ===\n');

    // 1. Salvar configuração com repetição
    console.log('1. Salvando configuração com campos de repetição...');
    const saveResult = await makeRequest('POST', '/api/config', {
        send_time: '10:00',
        reminder_enabled: true,
        reminder_days: 5,
        reminder_msg: 'Teste de lembrete @nomecliente',
        reminder_repeat_times: 3,
        reminder_repeat_interval_days: 2,
        overdue_enabled: true,
        overdue_days: 7,
        overdue_msg: 'Teste de atraso @nomecliente',
        overdue_repeat_times: 2,
        overdue_repeat_interval_days: 5
    });
    console.log('Resultado:', JSON.stringify(saveResult, null, 2));

    if (saveResult.error) {
        console.log('❌ ERRO ao salvar configuração!');
        return;
    }
    console.log('✓ Configuração salva com sucesso!\n');

    // 2. Buscar configuração
    console.log('2. Buscando configuração salva...');
    const config = await makeRequest('GET', '/api/config');

    console.log('\nConfiguração retornada:');
    console.log('  - send_time:', config.send_time);
    console.log('  - reminder_repeat_times:', config.reminder_repeat_times);
    console.log('  - reminder_repeat_interval_days:', config.reminder_repeat_interval_days);
    console.log('  - overdue_repeat_times:', config.overdue_repeat_times);
    console.log('  - overdue_repeat_interval_days:', config.overdue_repeat_interval_days);

    // 3. Validar valores
    console.log('\n3. Validando valores...');

    const tests = [
        { name: 'reminder_repeat_times', expected: 3, actual: config.reminder_repeat_times },
        { name: 'reminder_repeat_interval_days', expected: 2, actual: config.reminder_repeat_interval_days },
        { name: 'overdue_repeat_times', expected: 2, actual: config.overdue_repeat_times },
        { name: 'overdue_repeat_interval_days', expected: 5, actual: config.overdue_repeat_interval_days }
    ];

    let allPassed = true;
    tests.forEach(test => {
        const passed = test.actual === test.expected;
        const icon = passed ? '✓' : '✗';
        console.log(`  ${icon} ${test.name}: ${test.actual} ${passed ? '(OK)' : `(esperado: ${test.expected})`}`);
        if (!passed) allPassed = false;
    });

    console.log('\n' + '='.repeat(50));
    if (allPassed) {
        console.log('✓✓✓ TODOS OS TESTES PASSARAM! ✓✓✓');
    } else {
        console.log('❌ Alguns testes falharam');
    }
    console.log('='.repeat(50));
}

testMessageConfig().catch(console.error);
