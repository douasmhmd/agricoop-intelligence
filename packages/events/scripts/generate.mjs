// Generates TS types from contracts/events/*.schema.json into src/generated/.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';

const contractsDir = fileURLToPath(new URL('../../../contracts/events/', import.meta.url));
const outDir = fileURLToPath(new URL('../src/generated/', import.meta.url));

const banner =
  '/* eslint-disable */\n// GENERATED from contracts/events by scripts/generate.mjs. Do not edit.\n';

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const files = (await readdir(contractsDir)).filter((f) => f.endsWith('.schema.json')).sort();
const modules = [];
for (const file of files) {
  const schema = JSON.parse(await readFile(join(contractsDir, file), 'utf8'));
  const moduleName = basename(file, '.schema.json').replace(/\./g, '_');
  const ts = await compile(schema, schema.title ?? moduleName, {
    bannerComment: banner,
    additionalProperties: false,
    cwd: contractsDir,
  });
  await writeFile(join(outDir, `${moduleName}.ts`), ts);
  modules.push(moduleName);
}

const index =
  banner +
  (modules.length === 0
    ? 'export {};\n'
    : modules.map((m) => `export * from './${m}.js';`).join('\n') + '\n');
await writeFile(join(outDir, 'index.ts'), index);
console.warn(`events: generated ${modules.length} type module(s)`);
