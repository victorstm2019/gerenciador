const { execSync } = require('child_process');

console.log('Matando processos Node.js...');
try {
    execSync('taskkill /F /IM node.exe', { stdio: 'inherit' });
    console.log('✅ Processos finalizados');
} catch (err) {
    console.log('Nenhum processo Node.js rodando');
}

console.log('\nAgora execute:');
console.log('npm run dev:full');
