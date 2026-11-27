/*
 * Storefront happy path on a phone: browse a cooperative, fill the cart, sign in at checkout, pay
 * with the mock gateway, then verify a product's QR code.
 */
import { expect, test } from './support/fixtures';
import { signInOnKeycloak } from './support/keycloak';

const COOP = 'Coopérative Al Baraka (fictive)';
const PRODUCT = "Huile d'olive vierge extra 1 L";
/** Demo token of apps/dev/seed/002_demo_catalogue.sql (lot HVE-1L-DEMO-A, active). */
const DEMO_TOKEN = 'DemoToken1234567890Abc';

test('a customer orders and pays, and the order is confirmed', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: COOP }).click();

  const card = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: PRODUCT, exact: true }) });
  await card.getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByRole('link', { name: 'Panier (1 article)' })).toBeVisible();

  await page.getByRole('link', { name: 'Panier (1 article)' }).click();
  await expect(page.getByText(`Commande auprès de ${COOP}`)).toBeVisible();
  await page.getByRole('link', { name: 'Commander' }).click();

  // Checkout requires an account: the app sends the customer to Keycloak and back.
  await page.getByRole('main').getByRole('button', { name: 'Se connecter' }).click();
  await signInOnKeycloak(page, 'client.demo');
  await expect(page.getByRole('heading', { name: 'Finaliser la commande' })).toBeVisible();

  await page.getByLabel('Nom complet').fill('Client E2E (fictif)');
  await page.getByLabel('Adresse').fill('12 rue des Oliviers');
  await page.getByLabel('Ville').fill('Fès');
  await page.getByRole('button', { name: 'Payer' }).click();

  // CMI-style mock payment page (served by the API through the storefront origin).
  await page.waitForURL(/\/api\/v1\/coops\/COOP02\/paiements\/mock\//);
  await page.getByRole('button', { name: 'Payer', exact: true }).click();

  await expect(page.getByText(/Paiement accepté/)).toBeVisible();
  await expect(page.getByText('Payée').first()).toBeVisible();
  // The cart was emptied once the order was placed.
  await expect(page.getByRole('link', { name: /^Panier \(0/ })).toBeVisible();
});

test('a QR code on a label proves the product is authentic', async ({ page }) => {
  await page.goto(`/v/${DEMO_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Authentique ✓' })).toBeVisible();
  await expect(page.getByText(PRODUCT)).toBeVisible();

  await page.goto('/v/CeJetonNExistePas000000');
  await expect(page.getByRole('heading', { name: 'Code inconnu ⚠' })).toBeVisible();
});
