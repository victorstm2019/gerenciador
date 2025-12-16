const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

const PORT = 3001;
const app = express();

// Servir arquivos estáticos do build
app.use(express.static(path.join(__dirname, 'dist')));

// Importar rotas do servidor
const serverPath = path.join(__dirname, 'server', 'index.cjs');
if (fs.existsSync(serverPath)) {
    const serverRoutes = require(serverPath);
    // As rotas já estão configuradas no index.cjs
}

// Fallback para SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    
    // Abrir navegador padrão
    const url = `http://localhost:${PORT}`;
    const start = process.platform === 'win32' ? 'start' : 
                  process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${start} ${url}`);
});

// Manter processo vivo
process.on('SIGINT', () => {
    console.log('Encerrando servidor...');
    process.exit(0);
});
