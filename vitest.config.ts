import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { wgslVitePlugin } from 'vgpu/client';

export default defineConfig({
  plugins: [wgslVitePlugin(), react()],
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'], include: ['tests/**/*.test.tsx'] },
});
