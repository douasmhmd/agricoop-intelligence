/*
 * Signs in to the back office once and keeps the Keycloak session cookie. The apps keep their
 * tokens in sessionStorage (not captured), but with the SSO cookie Keycloak sends every new page
 * straight back without the login form. VISUAL_USER picks the account (default manager.coop02;
 * manager.coop01 owns the data plane's seed, needed for the Analyses pages).
 */
import { test as setup } from '@playwright/test';
import { type DemoUser, signInOnKeycloak } from '../tests/support/keycloak';
import { BACKOFFICE_URL, STORAGE_STATE } from './targets';

setup('sign in to the back office', async ({ page }) => {
  await page.goto(BACKOFFICE_URL);
  const user: DemoUser =
    process.env.VISUAL_USER === 'manager.coop01' ? 'manager.coop01' : 'manager.coop02';
  await signInOnKeycloak(page, user);
  await page.context().storageState({ path: STORAGE_STATE });
});
