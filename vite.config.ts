import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));

function copyWasmPlugin(): Plugin {
  const llamacppWasm = path.resolve(__dir, 'node_modules/@runanywhere/web-llamacpp/wasm');

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
    },
  };
}

export default defineConfig({
  plugins: [react(), copyWasmPlugin()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  assetsInclude: ['**/*.wasm'],
  worker: { format: 'es' },
  optimizeDeps: {
    exclude: ['@runanywhere/web-llamacpp'],
  },
});
