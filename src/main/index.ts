import { app, BrowserWindow } from 'electron';
import path from 'path';
import { registerIpcHandlers } from './ipc-handlers';
import { PipeServer } from './pipe-server';
import { IPC_CHANNELS } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
const pipeServer = new PipeServer();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a1a',
      symbolColor: '#cccccc',
      height: 38,
    },
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed for node-pty IPC
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  // Start named pipe server
  pipeServer.start();

  pipeServer.on('v1', (cmd) => {
    // Forward metadata updates to all windows
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.METADATA_UPDATE, cmd);
      }
    });
  });

  pipeServer.on('v2', (request, respond, respondError) => {
    switch (request.method) {
      case 'system.identify':
        respond({ name: 'wmux', version: '0.1.0', platform: 'win32' });
        break;
      case 'system.capabilities':
        respond({ protocols: ['v1', 'v2'], features: ['workspaces', 'splits', 'notifications'] });
        break;
      case 'workspace.list':
        // Will be filled in when workspace IPC is complete
        respond({ workspaces: [] });
        break;
      default:
        respondError(-32601, `Method not found: ${request.method}`);
    }
  });
});

app.on('will-quit', () => {
  pipeServer.stop();
});

app.on('window-all-closed', () => {
  app.quit();
});
