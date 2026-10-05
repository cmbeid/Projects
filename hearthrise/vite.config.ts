import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative, so the same build works under an S3 prefix or a Pages
  // subdirectory without a rebuild.
  base: './',
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
