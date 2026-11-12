import { expect, type Page } from '@playwright/test';

/** Demo users of apps/keycloak/realm-agricoop.json (password: KC_DEMO_PASSWORD, local only). */
export type DemoUser = 'client.demo' | 'manager.coop02';

export function demoPassword(): string {
  const password = process.env.KC_DEMO_PASSWORD;
  if (!password) {
    throw new Error('KC_DEMO_PASSWORD is not set: copy .env.example to .env or export it.');
  }
  return password;
}

/** Fills the Keycloak sign-in form (the app has already redirected there). */
export async function signInOnKeycloak(page: Page, user: DemoUser): Promise<void> {
  await page.waitForURL(/\/realms\/agricoop\/protocol\/openid-connect\/auth/);
  await page.locator('#username').fill(user);
  await page.locator('#password').fill(demoPassword());
  await page.locator('#kc-login').click();
  await expect(page).not.toHaveURL(/\/realms\/agricoop\//);
}
