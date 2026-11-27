/*
 * Back-office happy path for a cooperative manager: add a product and a production lot, then ship
 * the order paid in the storefront project (which runs first).
 */
import { expect, test } from './support/fixtures';
import { signInOnKeycloak } from './support/keycloak';

test('a manager adds a product and a lot, then ships a paid order', async ({ page }) => {
  const suffix = Date.now().toString(36).toUpperCase();
  const code = `E2E-${suffix}`;
  const nom = `Savon E2E ${suffix}`;

  await page.goto('/');
  await signInOnKeycloak(page, 'manager.coop02');
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
  const nav = page.getByRole('navigation');

  // Product. Fields are found by role and the START of their label (a label also contains its hint);
  // money fields are text inputs: amounts stay strings end to end.
  await nav.getByRole('link', { name: 'Produits' }).click();
  await page.getByRole('button', { name: 'Nouveau produit' }).click();
  const productForm = page.getByRole('dialog');
  await productForm.getByRole('textbox', { name: /^Code/ }).fill(code);
  await productForm.getByRole('textbox', { name: /^Nom/ }).fill(nom);
  await productForm.getByRole('combobox', { name: /^Famille/ }).selectOption('cosmetique');
  await productForm.getByRole('textbox', { name: /^Catégorie/ }).fill('savon');
  await productForm.getByRole('textbox', { name: /^Prix/ }).fill('18.50');
  await productForm.getByRole('textbox', { name: /^Coût/ }).fill('9.00');
  await productForm.getByRole('spinbutton', { name: /^Conservation/ }).fill('730');
  await productForm.getByRole('combobox', { name: /^Traçabilité QR/ }).selectOption('lot');
  await productForm.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(productForm).toBeHidden();
  await expect(page.getByRole('cell', { name: code, exact: true })).toBeVisible();

  // Production lot: creating it records a stock entry of the initial quantity.
  await nav.getByRole('link', { name: 'Lots et stock' }).click();
  await page.getByRole('button', { name: 'Nouveau lot' }).click();
  const lotForm = page.getByRole('dialog');
  await lotForm
    .getByRole('combobox', { name: /^Produit/ })
    .selectOption({ label: `${code} — ${nom}` });
  await lotForm.getByRole('textbox', { name: /^Numéro/ }).fill(`${code}-L1`);
  await lotForm.getByRole('spinbutton', { name: /^Quantité/ }).fill('25');
  await lotForm.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Lot créé')).toBeVisible();
  // The new lot opens with its stock entry.
  await expect(page.getByRole('heading', { name: `Lot ${code}-L1` })).toBeVisible();
  await expect(page.getByRole('row', { name: /Entrée \+25/ })).toBeVisible();

  // Ship the most recent paid order.
  await nav.getByRole('link', { name: 'Commandes' }).click();
  await page.getByRole('button', { name: 'Statut' }).click();
  await page.getByRole('menuitemradio', { name: 'Payée' }).click();
  await page.getByRole('row').nth(1).getByRole('link').click();
  await page.getByRole('button', { name: 'Marquer expédiée' }).click();
  await expect(page.getByText('Commande mise à jour')).toBeVisible();
  await expect(page.getByText('Expédiée').first()).toBeVisible();
});
