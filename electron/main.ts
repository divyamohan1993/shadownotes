import { app, BrowserWindow, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── NVIDIA 940 MX / GPU Force Flags ─────────────────────────────────────
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-gpu-compositing');
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch(
  'enable-features',
  'Vulkan,SharedArrayBuffer,WebGPU',
);
app.commandLine.appendSwitch('use-angle', 'd3d11');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('disable-gpu-driver-bug-workarounds');

// ── App ──────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'SHADOW NOTES — Classified',
    backgroundColor: '#0a0e1a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });

  // Show window once content is ready (avoids blank flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Fallback: if ready-to-show doesn't fire within 5s, force show
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.warn('[ShadowNotes] ready-to-show did not fire, forcing show');
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.openDevTools();
    }
  }, 5000);

  // COOP/COEP headers for SharedArrayBuffer
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['credentialless'],
      },
    });
  });

  // Load app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('[ShadowNotes] Loading:', indexPath);
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('[ShadowNotes] Failed to load index.html:', err);
      mainWindow?.show();
      mainWindow?.webContents.openDevTools();
    });
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[ShadowNotes] Page load failed:', errorCode, errorDescription);
    mainWindow?.show();
    mainWindow?.webContents.openDevTools();
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[ShadowNotes] Renderer crashed:', details.reason);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
