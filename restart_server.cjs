const { execSync } = require('child_process');
const { spawn } = require('child_process');

console.log('1. Matando processos Node.js antigos...');
try {
    execSync('taskkill /F /FI "IMAGENAME eq node.exe" /FI "WINDOWTITLE eq *dev:full*"', { stdio: 'pipe' });
} catch (err) {
    // Ignora erro se não houver processos
}

console.log('2. Aguardando 2 segundos...');
setTimeout(() => {
    console.log('3. Iniciando servidor limpo...');
    const server = spawn('npm', ['run', 'dev:full'], {
        stdio: 'inherit',
        shell: true
    });

    server.on('error', (err) => {
        console.error('Erro ao iniciar:', err);
    });
}, 2000);
