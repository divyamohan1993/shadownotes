import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import electron from 'vite-plugin-electron/simple';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const isElectron = process.env.BUILD_TARGET === 'electron';

function copyWasmPlugin(): Plugin {
  const llamacppWasm = path.resolve(__dir, 'node_modules/@runanywhere/web-llamacpp/wasm');
  const onnxWasm = path.resolve(__dir, 'node_modules/@runanywhere/web-onnx/wasm/sherpa');

  return {
    name: 'copy-wasm',
    writeBundle(options) {
      const outDir = options.dir ?? path.resolve(__dir, 'dist');
      const assetsDir = path.join(outDir, 'assets');
      fs.mkdirSync(assetsDir, { recursive: true });

      const llamacppFiles = [
        { src: 'racommons-llamacpp.wasm', dest: 'racommons-llamacpp.wasm' },
        { src: 'racommons-llamacpp.js', dest: 'racommons-llamacpp.js' },
        { src: 'racommons-llamacpp-webgpu.wasm', dest: 'racommons-llamacpp-webgpu.wasm' },
        { src: 'racommons-llamacpp-webgpu.js', dest: 'racommons-llamacpp-webgpu.js' },
      ];

      for (const { src, dest } of llamacppFiles) {
        const srcPath = path.join(llamacppWasm, src);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, path.join(assetsDir, dest));
        }
      }

      // Copy sherpa-onnx WASM + JS files for STT, TTS, VAD
      const sherpaFiles = [
        'sherpa-onnx.wasm',
        'sherpa-onnx-glue.js',
        'sherpa-onnx-asr.js',
        'sherpa-onnx-tts.js',
        'sherpa-onnx-vad.js',
        'sherpa-onnx-wave.js',
      ];

      for (const file of sherpaFiles) {
        const srcPath = path.join(onnxWasm, file);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, path.join(assetsDir, file));
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    copyWasmPlugin(),

    // Electron main + preload (only for desktop builds)
    ...(isElectron
      ? [
          electron({
            main: {
              entry: 'electron/main.ts',
            },
            preload: {
              input: 'electron/preload.ts',
            },
          }),
        ]
      : []),

    // PWA only for web builds (service workers conflict with Electron's file:// protocol)
    ...(!isElectron
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icons/**/*'],
            workbox: {
              globPatterns: ['**/*.{js,css,html,wasm,ico,png,svg,woff,woff2}'],
              maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                  handler: 'StaleWhileRevalidate',
                  options: {
                    cacheName: 'google-fonts-css',
                    expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                    cacheableResponse: { statuses: [200] },
                  },
                },
                {
                  urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'google-fonts-webfonts',
                    expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                    cacheableResponse: { statuses: [200] },
                  },
                },
              ],
            },
            manifest: false,
          }),
        ]
      : []),
  ],

  // Electron loads from file:// — all asset paths must be relative
  base: isElectron ? './' : '/',

  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    proxy: {
      '/api/proxy/tts': {
        target: 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1',
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/api\/proxy\/tts/, ''),
        followRedirects: true,
      },
    },
  },
  assetsInclude: ['**/*.wasm'],
  worker: { format: 'es' },
  optimizeDeps: {
    exclude: ['@runanywhere/web-llamacpp'],
  },
});
