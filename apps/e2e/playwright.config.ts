/*
 * End-to-end happy paths against a RUNNING stack (they do not start it):
 *   docker compose -f docker-compose.yml -f docker-compose.apps.yml --profile apps up -d --wait
 *   pnpm --filter @agricoop/e2e e2e
 * Demo data comes from apps/dev/seed (COOP02) and the demo users of the Keycloak realm.
 */
import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Local runs reuse the repository .env (KC_DEMO_PASSWORD); CI passes the variables directly.
const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (!process.env.CI && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const webURL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';
const backofficeURL = process.env.E2E_BACKOFFICE_URL ?? 'http://localhost:5174';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    locale: 'fr-MA',
    timezoneId: 'Africa/Casablanca',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // Mobile-first: most customers and QR scans are on phones.
      name: 'storefront',
      testMatch: /storefront\.spec\.ts/,
      use: { ...devices['Pixel 7'], baseURL: webURL },
    },
    {
      // Ships the order the storefront project has just paid.
      name: 'backoffice',
      testMatch: /backoffice\.spec\.ts/,
      dependencies: ['storefront'],
      use: { ...devices['Desktop Chrome'], baseURL: backofficeURL },
    },
  ],
});
