const { app, Tray, Menu, shell, nativeImage, dialog } = require('electron');
const express = require('express');
const path = require('path');
const fs = require('fs');

// Configuração de Log
const logFile = path.join(path.dirname(process.execPath), 'app-debug.log');

function log(message) {
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
  } catch (e) {
    // Falha silenciosa no log
  }
}

log('--- INICIANDO APLICAÇÃO ---');
log(`ExecPath: ${process.execPath}`);
log(`DirName: ${__dirname}`);

let tray = null;
const server = express();

// Tratamento de erros globais
process.on('uncaughtException', (error) => {
  log(`UNCAUGHT EXCEPTION: ${error.message}\n${error.stack}`);
  dialog.showErrorBox('Erro Crítico', `Erro não tratado: ${error.message}`);
});

try {
  log('Configurando servidor Express...');
  server.use(express.json());
  server.use(express.static(path.join(__dirname, 'dist'))); // Caminho relativo ao ASAR/resources

  // Iniciar servidor backend
  log('Carregando módulo do servidor...');
  require('./server/index.cjs');
  log('Módulo do servidor carregado.');

  server.get('*', (req, res) => {
    const indexHtml = path.join(__dirname, 'dist', 'index.html');
    log(`Servindo index.html: ${indexHtml}`);
    res.sendFile(indexHtml);
  });

  server.listen(3001, () => {
    log('Servidor Express ouvindo na porta 3001');
  });
} catch (e) {
  log(`ERRO AO INICIAR SERVIDOR: ${e.message}\n${e.stack}`);
}

function createTray() {
  log('Função createTray chamada.');
  try {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    log(`Tentando carregar ícone de: ${iconPath}`);

    let icon;
    if (fs.existsSync(iconPath)) {
      log('Arquivo de ícone encontrado.');
      icon = nativeImage.createFromPath(iconPath);
    } else {
      log('Arquivo de ícone NÃO encontrado. Usando fallback vazio.');
      icon = nativeImage.createEmpty();
    }

    tray = new Tray(icon);

    const menu = Menu.buildFromTemplate([
      {
        label: 'Abrir Gerenciador', click: () => {
          log('Menu: Abrir clicado');
          shell.openExternal('http://localhost:3001');
        }
      },
      { type: 'separator' },
      {
        label: 'Sair', click: () => {
          log('Menu: Sair clicado');
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(menu);
    tray.setToolTip('Gerenciador de Cobranças');

    // Clique duplo para abrir
    tray.on('double-click', () => {
      shell.openExternal('http://localhost:3001');
    });

    log('Tray criado e configurado com sucesso.');
  } catch (err) {
    log(`ERRO AO CRIAR TRAY: ${err.message}\n${err.stack}`);
  }
}

app.whenReady().then(() => {
  log('Electron app.whenReady disparado.');
  createTray();

  log('Abrindo navegador padrão...');
  shell.openExternal('http://localhost:3001').catch(e => log(`Erro ao abrir navegador: ${e.message}`));
});

app.on('window-all-closed', () => {
  log('Evento window-all-closed (não fazendo nada, mantendo bandeja).');
});

app.on('quit', () => {
  log('Aplicação encerrando.');
});