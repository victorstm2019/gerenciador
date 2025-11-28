const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Backend and Frontend...');

// Start Backend
const server = spawn('node', ['server/index.cjs'], {
    stdio: 'inherit',
    cwd: __dirname
});

server.on('error', (err) => {
    console.error('Failed to start backend:', err);
});

// Start Frontend (Vite)
// Resolving vite bin path
const viteBin = path.resolve(__dirname, 'node_modules/vite/bin/vite.js');
const dev = spawn('node', [viteBin], {
    stdio: 'inherit',
    cwd: __dirname
});

dev.on('error', (err) => {
    console.error('Failed to start frontend:', err);
});

// Handle termination
process.on('SIGINT', () => {
    console.log('Stopping processes...');
    server.kill();
    dev.kill();
    process.exit();
});
