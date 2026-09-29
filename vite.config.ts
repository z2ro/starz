import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { wgslVitePlugin } from 'vgpu/client';

export default defineConfig({
  root: 'frontend',
  base: '/static/',
  publicDir: 'assets',
  plugins: [wgslVitePlugin(), react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:8000', '/health': 'http://localhost:8000' } },
});
