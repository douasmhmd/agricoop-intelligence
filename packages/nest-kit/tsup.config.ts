import { defineConfig } from 'tsup';

// tsup switches to SWC when emitDecoratorMetadata is enabled in tsconfig, so Nest decorator
// metadata is preserved. Code in this package still uses explicit @Inject() tokens.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2023',
  external: [/^@nestjs\//, 'nestjs-pino', 'nestjs-zod', 'reflect-metadata', 'rxjs', 'zod'],
});
