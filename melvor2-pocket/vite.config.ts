import fs from 'node:fs';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  // Relative paths so the app works from any subfolder (GitHub Pages serves it under /Projects/melvor2-pocket/).
  base: './',
  plugins: [preact()],
  build: { target: 'es2022', chunkSizeWarningLimit: 6000 },
  test: {
    environment: 'node',
    setupFiles: ['test/setup.ts'],
    // Most tests need the game data, which only exists next to a Steam install; elsewhere (CI) run the rest.
    include: fs.existsSync('data/content.json') ? ['test/**/*.test.ts'] : ['test/**/*.nodata.test.ts'],
  },
});
