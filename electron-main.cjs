const { app, BrowserWindow, Tray, Menu, shell, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let tray = null;
let mainWindow = null;
let serverProcess = null;
const PORT = 3001;
const APP_URL = `http://localhost:${PORT}`;

// Function to start the backend server
const startServer = () => {
  return new Promise((resolve, reject) => {
    // The server entry point is 'server/index.cjs'
    const serverPath = path.join(__dirname, 'server', 'index.cjs');

    const actualBasePath = process.env.PORTABLE_EXECUTABLE_DIR ||
      (process.env.PORTABLE_EXECUTABLE_FILE ? path.dirname(process.env.PORTABLE_EXECUTABLE_FILE) : null) ||
      path.dirname(app.getPath('exe'));

    // Global variable for the tray menu
    global.dbDir = actualBasePath;

    serverProcess = fork(serverPath, [`--base-path=${actualBasePath}`], {
      stdio: 'pipe', // Pipe stdout/stderr to parent
      cwd: actualBasePath,
      env: {
        ...process.env,
        PORT: PORT.toString(),
        ELECTRON_RESOURCES_PATH: process.resourcesPath,
        ELECTRON_EXEC_PATH: process.execPath,
        PORTABLE_EXECUTABLE_DIR: process.env.PORTABLE_EXECUTABLE_DIR,
        INIT_CWD: process.env.INIT_CWD || process.cwd(),
        IS_PORTABLE: 'true'
      }
    });

    // DIAGNOSTIC STARTUP DIALOG
    if (app.isPackaged) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Diagnóstico de Inicialização',
        message: 'O Gerenciador está localizando os arquivos...',
        detail: `Pasta Detectada: ${actualBasePath}\n` +
          `PORTABLE_EXECUTABLE_DIR: ${process.env.PORTABLE_EXECUTABLE_DIR || 'N/A'}\n` +
          `EXE Path: ${app.getPath('exe')}`,
        buttons: ['Continuar']
      });
    }

    serverProcess.on('message', (message) => {
      if (message === 'server-started') {
        console.log('Backend server has started.');
        resolve();
      } else if (message && message.type === 'error') {
        dialog.showErrorBox('Erro no Servidor', message.message);
      }
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server process:', err);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      console.log(`Server process exited with code ${code}`);
      if (code !== 0 && !app.isQuitting) {
        dialog.showErrorBox('Servidor Encerrado', `O backend parou inesperadamente (Código: ${code}). Verifique se há outra instância aberta.`);
      }
    });

    // Log server output for debugging
    serverProcess.stdout.on('data', (data) => console.log(`Server STDOUT: ${data}`));
    serverProcess.stderr.on('data', (data) => console.error(`Server STDERR: ${data}`));
  });
};

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false, // Don't show initially
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Example for preload script if needed
    },
    icon: path.join(__dirname, 'assets', 'icon.svg')
  });

  mainWindow.loadURL(APP_URL);

  // When the window is closed, hide it instead of quitting
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
};

const createTray = () => {
  const iconPath = path.join(__dirname, 'assets', 'icon.svg');
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Gerenciador',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      },
    },
    {
      label: 'Abrir no Navegador',
      click: () => {
        shell.openExternal(APP_URL);
      },
    },
    {
      label: 'Abrir Pasta do Banco',
      click: () => {
        if (global.dbDir) {
          shell.openPath(global.dbDir);
        } else {
          dialog.showErrorBox('Erro', 'Pasta do banco não identificada.');
        }
      },
    },
    {
      label: 'Diagnóstico de Caminhos',
      click: () => {
        dialog.showMessageBox({
          type: 'info',
          title: 'Diagnóstico',
          message: 'Informações de Localização',
          detail: `Caminho Base (Banco): ${global.dbDir}\n` +
            `Executável: ${app.getPath('exe')}\n` +
            `Portable Dir: ${process.env.PORTABLE_EXECUTABLE_DIR || 'N/A'}\n` +
            `Pasta AppData: ${app.getPath('userData')}`,
          buttons: ['Fechar']
        });
      }
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        app.isQuitting = true;
        if (serverProcess) {
          serverProcess.kill();
        }
        app.quit();
      },
    },
  ]);
  tray.setToolTip('Gerenciador de Cobranças');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });
};

app.on('ready', async () => {
  try {
    await startServer();
    createWindow();
    createTray();
  } catch (error) {
    dialog.showErrorBox('Erro na Aplicação', `Não foi possível iniciar o servidor. Verifique os logs.\n${error}`);
    app.quit();
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // On Windows, closing all windows does not quit the app, as it's running in the tray.
  // We do nothing here. The 'close' event on the window handles hiding.
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// We need to modify the server to let us know when it's ready.
// This is a placeholder for that modification.
// We will edit `server/index.cjs` to add `process.send('server-started');`
