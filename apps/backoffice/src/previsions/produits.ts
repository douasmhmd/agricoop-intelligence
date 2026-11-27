import { MadDecimal, type PrevisionProduit } from '@agricoop/shared';

/*
 * Per-product AI forecasts (GET /api/v1/previsions/produits). Quantities are NUMERIC(12,2)
 * strings: summed with decimal.js and formatted from the string, never through JS numbers.
 */

/** Weeks present in the forecasts, most recent first. */
export function weeksOf(rows: readonly PrevisionProduit[]): string[] {
  return [...new Set(rows.map((r) => r.semaine))].sort().reverse();
}

/** Product families present in the forecasts, sorted. */
export function famillesOf(rows: readonly PrevisionProduit[]): string[] {
  return [...new Set(rows.map((r) => r.famille))].sort();
}

/** Model versions of the rows, in order of appearance, without duplicates. */
export function versionsOf(rows: readonly PrevisionProduit[]): string[] {
  return [...new Set(rows.map((r) => r.version_modele))];
}

/** Most recent calculation time of the rows (ISO timestamp), or null when there are none. */
export function latestCalcul(rows: readonly PrevisionProduit[]): string | null {
  return rows.reduce<string | null>(
    (latest, r) =>
      latest === null || Date.parse(r.date_calcul) > Date.parse(latest) ? r.date_calcul : latest,
    null,
  );
}

/** Rows of one week, optionally of one family (the API's order is kept). */
export function forWeek(
  rows: readonly PrevisionProduit[],
  semaine: string,
  famille = '',
): PrevisionProduit[] {
  return rows.filter((r) => r.semaine === semaine && (!famille || r.famille === famille));
}

/** Sum of the forecast quantities, as a decimal string ("23.50"). */
export function totalPrevu(rows: readonly PrevisionProduit[]): string {
  return rows
    .reduce((sum, r) => sum.plus(new MadDecimal(r.quantite_prevue)), new MadDecimal(0))
    .toFixed(2);
}

/**
 * Display a quantity string: grouped thousands, decimal comma, no trailing zeros
 * ("1234.50" → "1 234,5", "3.00" → "3"). Same separators in French and Arabic as `formatMad`.
 */
export function formatQuantite(value: string): string {
  const [int = '0', dec] = new MadDecimal(value).toDecimalPlaces(2).toString().split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return dec ? `${grouped},${dec}` : grouped;
}

/**
 * Forecasts replayed on past sales (e.g. `simulation_apres_historique`) test the model; they are
 * not predictions for the weeks to come and the page says so.
 */
export function isSimulation(type: string): boolean {
  return type.startsWith('simulation');
}
