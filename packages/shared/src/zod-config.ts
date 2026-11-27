import { z } from 'zod';

/*
 * In browsers, validate without Zod's JIT. The JIT compiles validators with `new Function`, which
 * the front ends' CSP (script-src 'self', no 'unsafe-eval') forbids; even Zod's feature check is
 * then reported as a CSP violation. The setting must be in place before any schema is created
 * (Zod reads it at creation), hence this module is the first import of index.ts. Node services
 * keep the JIT.
 */
// No DOM types in this package: detect a browser through globalThis.
if ('window' in globalThis && 'document' in globalThis) z.config({ jitless: true });
