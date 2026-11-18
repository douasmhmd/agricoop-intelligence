/*
 * Login theme (apps/keycloak-theme) previewed WITHOUT Keycloak: its dev server renders each page
 * with a Keycloakify mock context (/?page=…&lang=…&state=…). Start it first:
 *   pnpm --filter @agricoop/keycloak-theme dev        (port 5176)
 * Screenshots → apps/e2e/screenshots/login/preview/ (desktop/mobile × light/dark × FR/AR/EN).
 */
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { applyVariant, LANGS, THEMES, VIEWPORTS, type Variant } from './targets';

const THEME_URL = process.env.E2E_KEYCLOAK_THEME_URL ?? 'http://localhost:5176';
const OUT = fileURLToPath(new URL('../screenshots/login/preview/', import.meta.url));

const PAGES = [
  { name: 'login', query: 'page=login.ftl' },
  { name: 'login-error', query: 'page=login.ftl&state=error' },
  { name: 'login-info', query: 'page=login.ftl&state=info' },
  { name: 'register', query: 'page=register.ftl' },
  { name: 'reset-password', query: 'page=login-reset-password.ftl' },
  { name: 'update-password', query: 'page=login-update-password.ftl' },
  { name: 'otp', query: 'page=login-otp.ftl' },
  { name: 'config-totp', query: 'page=login-config-totp.ftl' },
  { name: 'verify-email', query: 'page=login-verify-email.ftl' },
  { name: 'error', query: 'page=error.ftl' },
  { name: 'info', query: 'page=info.ftl' },
  { name: 'logout-confirm', query: 'page=logout-confirm.ftl' },
  { name: 'page-expired', query: 'page=login-page-expired.ftl' },
  { name: 'select-authenticator', query: 'page=select-authenticator.ftl' },
];

const variants = (Object.keys(VIEWPORTS) as Variant['viewport'][]).flatMap((viewport) =>
  THEMES.flatMap((theme) => [...LANGS, 'en' as const].map((lang) => ({ viewport, theme, lang }))),
);

// Only with the theme's dev server running (skipped otherwise, e.g. in CI).
let serverUp: boolean | undefined;
test.beforeEach(async () => {
  serverUp ??= await fetch(THEME_URL).then(
    (r) => r.ok,
    () => false,
  );
  test.skip(!serverUp, `login theme dev server not running on ${THEME_URL}`);
});

for (const p of PAGES) {
  for (const v of variants) {
    test(`${p.name} ${v.viewport} ${v.theme} ${v.lang}`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme: v.theme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      // applyVariant stores the theme (same key as ThemeProvider); the language comes from the URL.
      await applyVariant(page, { ...v, lang: v.lang === 'en' ? 'fr' : v.lang });
      await page.goto(`${THEME_URL}/?${p.query}&lang=${v.lang}`);
      await expect(page.locator('#kc-page-title, #kc-username').first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator('html')).toHaveAttribute('dir', v.lang === 'ar' ? 'rtl' : 'ltr');
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
      await page.screenshot({
        path: `${OUT}${p.name}-${v.viewport}-${v.theme}-${v.lang}.png`,
        fullPage: true,
      });
      await context.close();
    });
  }
}
