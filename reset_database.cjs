const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/database.sqlite');

console.log('Deletando banco de dados...');

if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('✅ Banco deletado!');
} else {
    console.log('⚠️ Banco não existe');
}

console.log('\nAgora:');
console.log('1. Reinicie o servidor (npm run dev:full)');
console.log('2. O banco será recriado SEM mock data');
console.log('3. Execute: node test_api_real.cjs');
console.log('4. Agora vai funcionar!');
