const express = require('express');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs');

const PORT = 3001;
const app = express();

// Esconder console
if (process.platform === 'win32') {
    try {
        const ffi = require('ffi-napi');
        const user32 = ffi.Library('user32', {
            'ShowWindow': ['bool', ['pointer', 'int']],
            'GetConsoleWindow': ['pointer', []]
        });
        const hwnd = user32.GetConsoleWindow();
        if (hwnd) {
            user32.ShowWindow(hwnd, 0); // SW_HIDE
        }
    } catch (e) {
        // Fallback: spawn hidden process
        if (!process.env.HIDDEN) {
            const child = spawn(process.execPath, process.argv.slice(1), {
                env: { ...process.env, HIDDEN: '1' },
                detached: true,
                stdio: 'ignore',
                windowsHide: true
            });
            child.unref();
            process.exit(0);
        }
    }
}

app.use(express.json());
app.use(require('cors')());
app.use(require('body-parser').json());

require('./server/index.cjs');

app.use(express.static('./dist'));
app.get('/*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.resolve('./dist/index.html'));
    }
});

// Criar ícone na bandeja usando PowerShell
function createTrayIcon() {
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$icon = [System.Drawing.SystemIcons]::Application
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = $icon
$notifyIcon.Text = "Gerenciador de Cobranças"
$notifyIcon.Visible = $true

$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip
$openItem = New-Object System.Windows.Forms.ToolStripMenuItem
$openItem.Text = "Abrir Dashboard"
$openItem.Add_Click({ Start-Process "http://localhost:${PORT}" })

$exitItem = New-Object System.Windows.Forms.ToolStripMenuItem
$exitItem.Text = "Sair"
$exitItem.Add_Click({ 
    $notifyIcon.Dispose()
    Get-Process -Name "gerenciador*" -ErrorAction SilentlyContinue | Stop-Process -Force
    exit 
})

$contextMenu.Items.Add($openItem)
$contextMenu.Items.Add("-")
$contextMenu.Items.Add($exitItem)
$notifyIcon.ContextMenuStrip = $contextMenu

$notifyIcon.Add_DoubleClick({ Start-Process "http://localhost:${PORT}" })

$appContext = New-Object System.Windows.Forms.ApplicationContext
[System.Windows.Forms.Application]::Run($appContext)
`;

    fs.writeFileSync('tray.ps1', psScript);
    spawn('powershell', ['-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', 'tray.ps1'], {
        detached: true,
        stdio: 'ignore'
    });
}

app.listen(PORT, () => {
    createTrayIcon();
    setTimeout(() => {
        exec(`start "" "http://localhost:${PORT}"`);
    }, 2000);
});