import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite — WHY: fast dev/build without shipping a heavy toolchain in the final nginx image
// (we only copy static `dist/` into nginx).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Local dev: same-origin feel as Docker nginx `/api` proxy.
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
