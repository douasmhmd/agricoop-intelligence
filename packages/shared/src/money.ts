import Decimal from 'decimal.js';
import { z } from 'zod';

/*
 * Money (MAD) is NUMERIC(10,2) in the database: up to 8 integer digits and 2 decimals.
 * It travels as a string ("75.00") and is computed with decimal.js — never with JS numbers.
 */

/** Isolated Decimal constructor so the global decimal.js config is never mutated. */
export const MadDecimal = Decimal.clone({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
export type MadDecimal = Decimal;

const MONEY_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

/** A non-negative NUMERIC(10,2) amount as a string, e.g. "75" or "75.50". */
export const moneyString = z
  .string()
  .regex(MONEY_PATTERN, 'Montant invalide (format attendu : 1234.56)')
  .describe('Amount in MAD, NUMERIC(10,2) as a string');

/** A strictly positive NUMERIC(10,2) amount (e.g. prix_mad, prix_unitaire_mad). */
export const positiveMoneyString = moneyString.refine(
  // Zod 4 still runs refinements after a failed regex check: guard before parsing.
  (v) => MONEY_PATTERN.test(v) && new MadDecimal(v).gt(0),
  { message: 'Le montant doit être strictement positif' },
);

export function money(value: string | Decimal): Decimal {
  if (typeof value === 'string' && !MONEY_PATTERN.test(value)) {
    throw new RangeError(`Invalid money value: ${JSON.stringify(value)}`);
  }
  return new MadDecimal(value);
}

/** Canonical 2-decimal string, e.g. "75.00". */
export function toMoneyString(value: Decimal): string {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function sumMoney(values: readonly string[]): string {
  return toMoneyString(values.reduce((acc, v) => acc.plus(money(v)), new MadDecimal(0)));
}

/** Line total = unit price × integer quantity. */
export function lineTotal(prixUnitaire: string, quantite: number): string {
  if (!Number.isInteger(quantite) || quantite <= 0) {
    throw new RangeError(`Quantity must be a positive integer, got ${quantite}`);
  }
  return toMoneyString(money(prixUnitaire).times(quantite));
}

/** Gross margin of a product: amount and percentage of the price (null when price is 0). */
export function margin(prix: string, cout: string): { mad: string; pct: string | null } {
  const p = money(prix);
  const diff = p.minus(money(cout));
  return {
    mad: toMoneyString(diff),
    pct: p.isZero() ? null : diff.div(p).times(100).toDecimalPlaces(1).toFixed(1),
  };
}

/** Display helper: "1 234,50 MAD" (fr) or the Arabic-locale equivalent. */
export function formatMad(value: string, locale: 'fr' | 'ar' = 'fr'): string {
  const fixed = toMoneyString(money(value));
  const [int = '0', dec = '00'] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return locale === 'ar' ? `${grouped},${dec} د.م.` : `${grouped},${dec} MAD`;
}
