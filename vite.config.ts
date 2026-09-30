import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fontManifest } from './build/fonts';
import { distributionLicenses } from './build/licenses';
export default defineConfig({
  base: './',
  plugins: [react(), fontManifest(), distributionLicenses()],
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'] },
  build: { chunkSizeWarningLimit: 800 },
});
