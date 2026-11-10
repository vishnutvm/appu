import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Relative asset URLs so the packaged Electron file:// load from app.asar works.
  // Absolute "/assets/..." resolves to file:///assets/... and 404s in production.
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  }
});
