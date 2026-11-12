/*
 * Visual capture of the purchase journey: cart drawer → checkout → paid order. Places a real
 * (local) order each run, like the e2e test. Two variants keep it quick.
 */
import { expect, test } from '@playwright/test';
import { applyVariant, OUT_DIR, STORAGE_STATE, type Variant, WEB_URL } from './targets';

const FLOW_VARIANTS: Variant[] = [
  { viewport: 'desktop', theme: 'light', lang: 'fr' },
  { viewport: 'mobile', theme: 'dark', lang: 'ar' },
];

for (const v of FLOW_VARIANTS) {
  test(`purchase journey ${v.viewport} ${v.theme} ${v.lang}`, async ({ browser }) => {
    // The Keycloak session cookie from the setup project signs the storefront in silently.
    const context = await browser.newContext({ storageState: STORAGE_STATE, colorScheme: v.theme });
    const page = await context.newPage();
    await applyVariant(page, v);
    const name = (step: string) => `${OUT_DIR}flow-${step}-${v.viewport}-${v.theme}-${v.lang}.png`;

    await page.goto(`${WEB_URL}/coops/COOP02`);
    await page.locator('article button:not([disabled])').first().click();
    await page.locator('[data-cart-target]').click();
    await expect(page.locator('a[href$="/commander"]')).toBeVisible();
    await page.waitForTimeout(900);
    await page.screenshot({ path: name('drawer') });

    await page.locator('a[href$="/commander"]').click();
    await page.getByRole('main').getByRole('button').first().click(); // sign in (SSO round trip)
    await expect(page.locator('form input[name="nom"]')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: name('checkout'), fullPage: true });

    await page.locator('input[name="nom"]').fill('Client démo (fictif)');
    await page.locator('textarea[name="adresse"]').fill('12 rue des Oliviers');
    await page.locator('input[name="ville"]').fill('Fès');
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/paiements\/mock\//);
    await page.locator('button[value="approve"]').click();
    await page.waitForURL(/paiement=ok/);
    await page.waitForTimeout(700); // mid-confetti
    await page.screenshot({ path: name('order'), fullPage: true });
    await context.close();
  });
}
