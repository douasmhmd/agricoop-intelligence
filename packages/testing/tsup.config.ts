import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2023',
  // import.meta.url is used to locate contracts/; tsup shims it in the CJS build.
  shims: true,
});
