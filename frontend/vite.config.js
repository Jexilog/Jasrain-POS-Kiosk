import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// requests to /api go to the backend, so the browser never blocks them
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
