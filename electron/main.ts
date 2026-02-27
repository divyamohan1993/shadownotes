import { app, BrowserWindow, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer, type Server } from 'http';
import { readFile } from 'fs/promises';

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

// ── Local server for production (WebAuthn requires localhost or HTTPS) ──

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
  '.webp': 'image/webp', '.webmanifest': 'application/manifest+json',
};

let localServer: Server | null = null;

function startLocalServer(distPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const urlPath = new URL(req.url || '/', 'http://localhost').pathname;
      const filePath = path.join(distPath, urlPath === '/' ? 'index.html' : urlPath);
      try {
        const data = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      } catch {
        // SPA fallback
        const index = await readFile(path.join(distPath, 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(index);
      }
    });
    server.listen(0, 'localhost', () => {
      localServer = server;
      const addr = server.address() as { port: number };
      console.log(`[ShadowNotes] Local server on http://localhost:${addr.port}`);
      resolve(addr.port);
    });
    server.on('error', reject);
  });
}

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

  // Load app — use localhost in production so WebAuthn (Windows Hello) works
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const distPath = path.join(__dirname, '../dist');
    console.log('[ShadowNotes] Serving from:', distPath);
    startLocalServer(distPath).then((port) => {
      mainWindow?.loadURL(`http://localhost:${port}`);
    }).catch((err) => {
      console.error('[ShadowNotes] Local server failed, falling back to file://', err);
      mainWindow?.loadFile(path.join(distPath, 'index.html')).catch(() => {
        mainWindow?.show();
        mainWindow?.webContents.openDevTools();
      });
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
  localServer?.close();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
