import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative, so one build works under an S3 prefix, a Pages subdirectory and
  // a plain origin root without rebuilding. Everything this app resolves at
  // runtime — the service worker, the manifest, the vendored art — goes
  // through document.baseURI for the same reason.
  base: './',
  build: {
    // The source is hand-written ES2022 modules with no transpilation step;
    // there is nothing to gain from targeting lower.
    target: 'es2022',
  },
  test: {
    // Every module under test is deliberately DOM-free, which is the property
    // the suite is there to protect — a DOM import creeping into the
    // simulation or the formatters should fail here rather than in a browser.
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
