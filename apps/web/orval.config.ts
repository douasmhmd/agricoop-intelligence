import { defineConfig } from 'orval';

// Client and TanStack Query hooks generated from the shared contract. Never hand-write fetch calls:
// the only fetch lives in src/api/fetcher.ts (the Orval mutator).
export default defineConfig({
  agricoop: {
    input: { target: '../../contracts/api/openapi.yaml' },
    output: {
      mode: 'tags-split',
      target: 'src/api/generated/endpoints.ts',
      schemas: 'src/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: { path: 'src/api/fetcher.ts', name: 'apiFetch' },
      },
    },
  },
});
