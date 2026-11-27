/* Back-office shell states: command palette open, sidebar collapsed (desktop). */
import { expect, test } from '@playwright/test';
import { applyVariant, BACKOFFICE_URL, OUT_DIR, STORAGE_STATE, type Variant } from './targets';

const SHELL_VARIANTS: Variant[] = [
  { viewport: 'desktop', theme: 'light', lang: 'fr' },
  { viewport: 'desktop', theme: 'dark', lang: 'ar' },
];

for (const v of SHELL_VARIANTS) {
  test(`back-office shell ${v.theme} ${v.lang}`, async ({ browser }) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE, colorScheme: v.theme });
    const page = await context.newPage();
    await applyVariant(page, v);
    await page.goto(`${BACKOFFICE_URL}/commandes`);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);

    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.type('lo');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT_DIR}bo-palette-${v.theme}-${v.lang}.png` });
    await page.keyboard.press('Escape');

    await page.locator('aside button[aria-expanded]').click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT_DIR}bo-collapsed-${v.theme}-${v.lang}.png` });
    // Leave the preference as it was for the next runs.
    await page.locator('aside button[aria-expanded]').click();
    await context.close();
  });
}
