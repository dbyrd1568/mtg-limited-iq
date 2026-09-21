import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

function packageJsonWatcherPlugin() {
  return {
    name: 'vite-plugin-package-json-watcher',
    configureServer(server: any) {
      server.watcher.add('package.json');
      server.watcher.on('change', (file: string) => {
        if (file.endsWith('package.json')) {
          server.restart();
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    tailwindcss(),
    packageJsonWatcherPlugin(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      '/api/17lands': {
        target: 'https://www.17lands.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/17lands/, ''),
      },
    },
  },
});
