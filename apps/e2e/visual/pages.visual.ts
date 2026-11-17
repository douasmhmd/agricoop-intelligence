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
const PAGES: {
  name: string;
  url: string;
  auth?: boolean;
  ready: string;
  open?: string;
  /** Clicked once the page is ready (e.g. submit an empty form to show validation). */
  then?: string;
}[] = [
  { name: 'styleguide', url: `${BACKOFFICE_URL}/styleguide`, auth: true, ready: 'h1' },
  { name: 'bo-dashboard', url: `${BACKOFFICE_URL}/`, auth: true, ready: 'h1' },
  { name: 'bo-produits', url: `${BACKOFFICE_URL}/produits`, auth: true, ready: 'h1' },
  // Phase 5: data pages (richest with VISUAL_USER=manager.coop01 on the shared seed).
  { name: 'bo-lots', url: `${BACKOFFICE_URL}/lots`, auth: true, ready: 'h1' },
  { name: 'bo-lot', url: `${BACKOFFICE_URL}/lots`, auth: true, ready: 'h1', open: 'main tbody a' },
  { name: 'bo-alertes', url: `${BACKOFFICE_URL}/stock/alertes`, auth: true, ready: 'h1' },
  { name: 'bo-commandes', url: `${BACKOFFICE_URL}/commandes`, auth: true, ready: 'h1' },
  {
    name: 'bo-commande',
    url: `${BACKOFFICE_URL}/commandes`,
    auth: true,
    ready: 'h1',
    open: 'main tbody a',
  },
  { name: 'bo-qr', url: `${BACKOFFICE_URL}/qr`, auth: true, ready: 'h1' },
  { name: 'bo-previsions', url: `${BACKOFFICE_URL}/previsions`, auth: true, ready: 'h1' },
  {
    name: 'bo-produit-form',
    url: `${BACKOFFICE_URL}/produits?nouveau=1`,
    auth: true,
    ready: '[role="dialog"]',
    then: '[role="dialog"] button[type="submit"]',
  },
  { name: 'bo-404', url: `${BACKOFFICE_URL}/nulle-part`, auth: true, ready: 'main p' },
  // Gold-layer data: run with VISUAL_USER=manager.coop01 after `pnpm db:restore`.
  { name: 'bo-analyses-ventes', url: `${BACKOFFICE_URL}/analyses`, auth: true, ready: 'h1' },
  ...(['stocks', 'clients', 'qr'] as const).map((onglet) => ({
    name: `bo-analyses-${onglet}`,
    url: `${BACKOFFICE_URL}/analyses?onglet=${onglet}`,
    auth: true,
    ready: 'h1',
  })),
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
        // Final states, not mid-animation (full-page captures resize the page, which replays
        // chart entry animations). Motion design is reviewed in the browser, not here.
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await applyVariant(page, v);
      await page.goto(p.url);
      if (p.open) {
        // Pages reached by clicking (e.g. the first product of a catalogue).
        await page.locator(p.open).first().click();
      }
      await expect(page.locator(p.ready).first()).toBeVisible({ timeout: 30_000 });
      if (p.then) await page.locator(p.then).first().click();
      await expect(page.locator('html')).toHaveAttribute('dir', v.lang === 'ar' ? 'rtl' : 'ltr');
      // Back office: data loaded once no <Loading> indicator is left (the storefront uses
      // role="status" for lasting messages too).
      if (p.auth) {
        await expect(page.locator('main [role="status"]')).toHaveCount(0, { timeout: 30_000 });
      }
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
