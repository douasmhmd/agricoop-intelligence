/*
 * The REAL sign-in flow through Keycloak with the agricoop login theme (the JAR built by
 * `pnpm keycloak:theme`, loaded from apps/keycloak/providers/): back office → Keycloak → back office
 * → sign out. Screenshots → apps/e2e/screenshots/login/ (desktop/mobile × light/dark × FR/AR):
 *   login, login-error, reset-password, register, signed-out.
 * Runs against the running stack like the e2e tests; each variant uses a fresh browser context
 * (no SSO cookie), so Keycloak shows its forms.
 */
import { expect, type Page, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { signInOnKeycloak } from '../tests/support/keycloak';
import { applyVariant, BACKOFFICE_URL, VARIANTS, type Variant } from './targets';

const OUT = fileURLToPath(new URL('../screenshots/login/', import.meta.url));
const KEYCLOAK_AUTH = /\/realms\/agricoop\/protocol\/openid-connect\/auth/;

// Back-office strings used to sign out (apps/backoffice/src/i18n/locales).
const BACKOFFICE = {
  fr: { menu: 'Menu du compte', signOut: 'Se déconnecter', signedOut: 'Vous êtes déconnecté.' },
  ar: { menu: 'قائمة الحساب', signOut: 'تسجيل الخروج', signedOut: 'تم تسجيل خروجك.' },
} as const;

async function shoot(page: Page, name: string, v: Variant): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${name}: horizontal overflow in px`).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: `${OUT}${name}-${v.viewport}-${v.theme}-${v.lang}.png`,
    fullPage: true,
  });
}

/** Back office → Keycloak sign-in form, in the variant's language. */
async function openSignIn(page: Page, v: Variant): Promise<void> {
  await page.goto(BACKOFFICE_URL);
  await page.waitForURL(KEYCLOAK_AUTH);
  // Keycloak picks the language from kc_locale (then remembers it for this auth session).
  if (v.lang !== 'fr') await page.goto(`${page.url()}&kc_locale=${v.lang}`);
  await expect(page.locator('#kc-login')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', v.lang);
  await expect(page.locator('html')).toHaveAttribute('dir', v.lang === 'ar' ? 'rtl' : 'ltr');
}

for (const v of VARIANTS) {
  test(`login flow ${v.viewport} ${v.theme} ${v.lang}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      colorScheme: v.theme,
      reducedMotion: 'reduce',
      locale: v.lang === 'ar' ? 'ar-MA' : 'fr-MA',
    });
    const page = await context.newPage();
    // Same theme key on the Keycloak origin as in the apps.
    await applyVariant(page, v);

    await openSignIn(page, v);
    await shoot(page, 'login', v);

    // Unknown account (not a demo user, so brute-force protection never locks a real one).
    await page.locator('#username').fill('inconnu@example.ma');
    await page.locator('#password').fill('pas-le-bon-mot-de-passe');
    await page.locator('#kc-login').click();
    await expect(page.locator('#input-error, [role="alert"]').first()).toBeVisible();
    await shoot(page, 'login-error', v);

    await openSignIn(page, v);
    await page.locator('a[href*="reset-credentials"]').first().click();
    await expect(page.locator('#username')).toBeVisible();
    await shoot(page, 'reset-password', v);

    await openSignIn(page, v);
    await page.locator('a[href*="registration"]').first().click();
    await expect(page.locator('#email')).toBeVisible();
    await shoot(page, 'register', v);

    // Sign in for real, then sign out: the back office's "signed out" screen.
    await openSignIn(page, v);
    await signInOnKeycloak(page, 'manager.coop02');
    const strings = BACKOFFICE[v.lang];
    await page.getByRole('button', { name: strings.menu }).click();
    await page.getByRole('menuitem', { name: strings.signOut }).click();
    await expect(page.getByText(strings.signedOut)).toBeVisible({ timeout: 20_000 });
    await shoot(page, 'signed-out', v);

    await context.close();
  });
}
