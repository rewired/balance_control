import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config with dev proxy to the server
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/health': 'http://localhost:3001',
      '/api': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
  preview: {
    port: 5173,
  },
});