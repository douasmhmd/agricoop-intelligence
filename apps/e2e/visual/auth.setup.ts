/*
 * Signs in to the back office once and keeps the Keycloak session cookie. The apps keep their
 * tokens in sessionStorage (not captured), but with the SSO cookie Keycloak sends every new page
 * straight back without the login form.
 */
import { test as setup } from '@playwright/test';
import { signInOnKeycloak } from '../tests/support/keycloak';
import { BACKOFFICE_URL, STORAGE_STATE } from './targets';

setup('sign in to the back office', async ({ page }) => {
  await page.goto(BACKOFFICE_URL);
  await signInOnKeycloak(page, 'manager.coop02');
  await page.context().storageState({ path: STORAGE_STATE });
});
