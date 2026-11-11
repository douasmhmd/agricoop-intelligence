import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    // *.int.test.ts start Postgres with Testcontainers (Docker required).
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
