import { expect, test } from '@playwright/test';
import {
  applyVariant,
  BACKOFFICE_URL,
  settle,
  shotName,
  STORAGE_STATE,
  VARIANTS,
  WEB_URL,
} from './targets';

/** Pages to capture. Grows with each redesign phase. */
const PAGES: { name: string; url: string; auth?: boolean; ready: string; open?: string }[] = [
  { name: 'styleguide', url: `${BACKOFFICE_URL}/styleguide`, auth: true, ready: 'h1' },
  { name: 'web-home', url: `${WEB_URL}/`, ready: 'h1' },
  { name: 'web-catalogue', url: `${WEB_URL}/coops/COOP02`, ready: 'article h2' },
  {
    name: 'web-product',
    // Demo seed product (apps/dev/seed/002_demo_catalogue.sql) or the first product of COOP02.
    url: `${WEB_URL}/coops/COOP02`,
    ready: 'h1',
    open: 'article h2 a',
  },
  { name: 'web-verify-ok', url: `${WEB_URL}/v/DemoToken1234567890Abc`, ready: 'h1' },
  { name: 'web-verify-unknown', url: `${WEB_URL}/v/CeJetonNExistePas000000`, ready: 'h1' },
  { name: 'web-404', url: `${WEB_URL}/nulle-part`, ready: 'h1' },
];

for (const p of PAGES) {
  for (const v of VARIANTS) {
    test(`${p.name} ${v.viewport} ${v.theme} ${v.lang}`, async ({ browser }) => {
      const context = await browser.newContext({
        storageState: p.auth ? STORAGE_STATE : undefined,
        colorScheme: v.theme,
      });
      const page = await context.newPage();
      await applyVariant(page, v);
      await page.goto(p.url);
      if (p.open) {
        // Pages reached by clicking (e.g. the first product of a catalogue).
        await page.locator(p.open).first().click();
      }
      await expect(page.locator(p.ready).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('html')).toHaveAttribute('dir', v.lang === 'ar' ? 'rtl' : 'ltr');
      await settle(page);
      // Quality bar: no horizontal scroll at any width.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
      await page.screenshot({ path: shotName(p.name, v), fullPage: true });
      await context.close();
    });
  }
}
