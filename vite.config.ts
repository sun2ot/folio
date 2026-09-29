import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fontManifest } from './build/fonts';
export default defineConfig({
  base: './',
  plugins: [react(), fontManifest()],
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'] },
  build: { chunkSizeWarningLimit: 800 },
});
