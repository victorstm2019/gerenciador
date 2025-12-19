const { app, Tray, Menu, shell, nativeImage } = require('electron');
const express = require('express');
const path = require('path');

let tray = null;
const server = express();
server.use(express.json());
server.use(express.static('dist'));
require('./server/index.cjs');
server.get('*', (req, res) => res.sendFile(path.resolve('./dist/index.html')));
server.listen(3001);

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: 'Abrir', click: () => shell.openExternal('http://localhost:3001') },
    { label: 'Sair', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
}

app.whenReady().then(() => {
  createTray();
  shell.openExternal('http://localhost:3001');
});

app.on('window-all-closed', () => {});