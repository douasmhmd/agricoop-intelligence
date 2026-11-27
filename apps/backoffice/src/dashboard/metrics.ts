/*
 * Dashboard figures computed in the browser from the existing endpoints (pure, unit-tested).
 * Money stays in strings / decimal.js (`@agricoop/shared` helpers); charts get numbers only for
 * drawing, never for amounts shown as text.
 */
import {
  addDays,
  type CommandeResume,
  isoDateInZone,
  type Lot,
  MadDecimal,
  money,
  type Previsions,
  type Produit,
  type ScansParVille,
  sumMoney,
  toMoneyString,
} from '@agricoop/shared';

export const WINDOW_DAYS = 30;

export interface OrdersWindow {
  revenue: string;
  revenuePrevious: string;
  count: number;
  countPrevious: number;
  /** One point per day of the current window (oldest first), for sparklines. */
  dailyRevenue: { date: string; value: number }[];
  dailyCount: { date: string; value: number }[];
  /** False when the order history fetched did not reach back the full 2 × 30 days. */
  complete: boolean;
}

/**
 * Revenue and order counts for the last 30 days and the 30 days before, by Casablanca calendar
 * day. Cancelled orders are left out. `orders` are the most recent orders (any order).
 */
export function ordersWindow(
  orders: CommandeResume[],
  today: string,
  complete: boolean,
): OrdersWindow {
  const start = addDays(today, -(WINDOW_DAYS - 1));
  const previousStart = addDays(start, -WINDOW_DAYS);
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(start, i));
  const byDay = new Map<string, string[]>(days.map((d) => [d, []]));
  const previous: string[] = [];
  for (const o of orders) {
    if (o.statut === 'annulee') continue;
    const day = isoDateInZone(new Date(o.date_commande));
    if (day >= start && day <= today) byDay.get(day)?.push(o.montant_total_mad);
    else if (day >= previousStart && day < start) previous.push(o.montant_total_mad);
  }
  const current = [...byDay.values()].flat();
  return {
    revenue: sumMoney(current),
    revenuePrevious: sumMoney(previous),
    count: current.length,
    countPrevious: previous.length,
    dailyRevenue: days.map((date) => ({
      date,
      value: money(sumMoney(byDay.get(date) ?? [])).toNumber(),
    })),
    dailyCount: days.map((date) => ({ date, value: byDay.get(date)?.length ?? 0 })),
    complete,
  };
}

/** Relative change in percent (one decimal), or null when there is no previous value. */
export function deltaPct(current: string | number, previous: string | number): number | null {
  // Works for amounts ("12.50") and counts (7) alike.
  const prev = new MadDecimal(previous);
  if (prev.isZero()) return null;
  return new MadDecimal(current).minus(prev).div(prev).times(100).toDecimalPlaces(1).toNumber();
}

export interface StockSummary {
  /** Σ stock × cost price of available lots. */
  valueAtCost: string;
  units: number;
  byFamille: { famille: Produit['famille']; units: number; value: string }[];
}

export function stockSummary(lots: Lot[], produits: Produit[]): StockSummary {
  const byId = new Map(produits.map((p) => [p.produit_id, p]));
  const familles = new Map<Produit['famille'], { units: number; values: string[] }>();
  const values: string[] = [];
  let units = 0;
  for (const lot of lots) {
    if (lot.statut !== 'disponible' || lot.stock <= 0) continue;
    const produit = byId.get(lot.produit_id);
    if (!produit) continue;
    const value = toMoneyString(money(produit.cout_mad).times(lot.stock));
    values.push(value);
    units += lot.stock;
    const f = familles.get(produit.famille) ?? { units: 0, values: [] };
    f.units += lot.stock;
    f.values.push(value);
    familles.set(produit.famille, f);
  }
  return {
    valueAtCost: sumMoney(values),
    units,
    byFamille: [...familles.entries()]
      .map(([famille, f]) => ({ famille, units: f.units, value: sumMoney(f.values) }))
      .sort((a, b) => b.units - a.units),
  };
}

export interface ScanSummary {
  total: number;
  previous: number;
  top: { ville: string; scans: number }[];
}

/** `last30` / `last60`: scans per city over 30 and 60 days (the API's `jours` window). */
export function scanSummary(
  last30: ScansParVille[],
  last60: ScansParVille[],
  top = 6,
): ScanSummary {
  const total = last30.reduce((n, v) => n + v.nb_scans, 0);
  const total60 = last60.reduce((n, v) => n + v.nb_scans, 0);
  return {
    total,
    previous: Math.max(0, total60 - total),
    top: [...last30]
      .sort((a, b) => b.nb_scans - a.nb_scans)
      .slice(0, top)
      .map((v) => ({ ville: v.ville, scans: v.nb_scans })),
  };
}

export interface ForecastPoint {
  semaine: string;
  vendues: number;
  /** Null when the model has no forecast for that week (gap in the dashed line). */
  prevues: number | null;
}

/** Weekly totals across familles: units sold and forecast units. */
export function forecastTotals(previsions: Previsions | undefined): ForecastPoint[] {
  if (!previsions) return [];
  const weeks = new Map<string, { vendues: number; prevues: string[] }>();
  for (const serie of previsions.series) {
    for (const p of serie.points) {
      const w = weeks.get(p.semaine) ?? { vendues: 0, prevues: [] };
      w.vendues += p.quantite_vendue;
      if (p.quantite_prevue !== null) w.prevues.push(p.quantite_prevue);
      weeks.set(p.semaine, w);
    }
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semaine, w]) => ({
      semaine,
      vendues: w.vendues,
      prevues: w.prevues.length ? money(sumMoney(w.prevues)).toNumber() : null,
    }));
}
