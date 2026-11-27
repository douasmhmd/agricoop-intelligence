// Pre-renders the home page's first screen into dist/index.html (run after `vite build`).
//
// 1. SSR-builds src/prerender/entry.tsx (same Vite config, every dependency bundled) into a
//    temporary folder outside dist/ (never served).
// 2. Renders it and puts the HTML inside #root, wrapped in <div id="prerender">.
// 3. Deletes the temporary build.
//
// theme-init.js decides before the first paint whether the shell may show (home page, French).
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = fileURLToPath(new URL('../.prerender/', import.meta.url));
const indexHtml = fileURLToPath(new URL('../dist/index.html', import.meta.url));

await build({
  root,
  logLevel: 'warn',
  build: {
    ssr: 'src/prerender/entry.tsx',
    outDir,
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'entry.mjs' } },
  },
  // Bundle everything (workspace TypeScript packages included) so Node can run it as is.
  ssr: { noExternal: true },
});

try {
  const { render } = await import(pathToFileURL(`${outDir}entry.mjs`).href);
  const html = await render();
  const page = readFileSync(indexHtml, 'utf8');
  const marker = '<div id="root"></div>';
  if (!page.includes(marker)) throw new Error(`${marker} not found in dist/index.html`);
  writeFileSync(
    indexHtml,
    page.replace(marker, `<div id="root"><div id="prerender">${html}</div></div>`),
  );
  console.warn(
    `Pre-rendered the home shell into dist/index.html (${(html.length / 1024).toFixed(1)} KB).`,
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
