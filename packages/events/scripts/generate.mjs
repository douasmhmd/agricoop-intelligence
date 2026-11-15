// Generates TS types from the shared event contract (contracts/events/evenements.schema.json,
// written with the data plane) into src/generated/: one payload type per `$defs` entry, plus the
// contract itself, embedded so runtime validation never reads files.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';

const contractFile = fileURLToPath(
  new URL('../../../contracts/events/evenements.schema.json', import.meta.url),
);
const outDir = fileURLToPath(new URL('../src/generated/', import.meta.url));
const banner =
  '/* eslint-disable */\n// GENERATED from contracts/events/evenements.schema.json by scripts/generate.mjs. Do not edit.\n';

const contract = JSON.parse(await readFile(contractFile, 'utf8'));
const pascal = (s) => s.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const parts = [];
for (const [type, schema] of Object.entries(contract.$defs)) {
  const name = `${pascal(type)}Payload`;
  const ts = await compile({ ...schema, title: name }, name, {
    bannerComment: '',
    additionalProperties: false,
  });
  parts.push(ts.trim());
}

await writeFile(
  join(outDir, 'index.ts'),
  `${banner}\n${parts.join('\n\n')}\n\n/** The contract, as written in contracts/events. */\nexport const EVENT_CONTRACT = ${JSON.stringify(contract)} as const;\n`,
);
console.warn(`events: generated ${Object.keys(contract.$defs).length} payload type(s)`);
