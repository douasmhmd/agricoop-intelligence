/*
 * Visual review screenshots (not assertions): every page × desktop/mobile × light/dark × FR/AR,
 * written to screenshots/redesign/<phase>/ for a human to look at.
 *
 *   pnpm --filter @agricoop/e2e screenshots              # all pages
 *   VISUAL_PHASE=phase2 pnpm --filter @agricoop/e2e screenshots
 *
 * Runs against a running stack, like the e2e tests.
 */
import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (!process.env.CI && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export default defineConfig({
  testDir: './visual',
  testMatch: /.*\.visual\.ts/,
  fullyParallel: true,
  workers: 4,
  timeout: 90_000,
  reporter: [['list']],
  use: { locale: 'fr-MA', timezoneId: 'Africa/Casablanca' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'visual', dependencies: ['setup'] },
  ],
});
