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
    
    serverProcess = fork(serverPath, [], {
      stdio: 'pipe', // Pipe stdout/stderr to parent
      env: { ...process.env, PORT: PORT.toString() }
    });

    serverProcess.on('message', (message) => {
        if (message === 'server-started') {
            console.log('Backend server has started.');
            resolve();
        }
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server process:', err);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      console.log(`Server process exited with code ${code}`);
      // Optionally handle server crashes here
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
  } catch(error) {
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
