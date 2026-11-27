/*
 * Shaping of the analytics API responses (contracts/api/analytics.yaml) for the "Analyses" pages.
 * Pure and unit-tested. The API returns aggregates as JSON numbers; sums here go through decimal
 * arithmetic so totals stay exact to the cent.
 */
import {
  type ClientSegment,
  formatMad,
  type KpiMensuel,
  MadDecimal,
  SEGMENTS,
  type Segment,
  type StockProduit,
} from '@agricoop/shared';

/** Olive campaign of a month ("YYYY-MM-DD"): October → September, e.g. "2025-2026". */
export function campaignOf(mois: string): string {
  const year = Number(mois.slice(0, 4));
  const month = Number(mois.slice(5, 7));
  const start = month >= 10 ? year : year - 1;
  return `${start}-${start + 1}`;
}

/** Campaigns present in the data, most recent first. */
export function campaigns(kpis: KpiMensuel[]): string[] {
  return [...new Set(kpis.map((k) => campaignOf(k.mois)))].sort().reverse();
}

export interface CampaignTotals {
  ca: number;
  marge: number;
  /** marge / ca, null without revenue. */
  tauxMarge: number | null;
  commandes: number;
  /** ca / commandes, null without orders. */
  panierMoyen: number | null;
  nouveauxClients: number;
  mois: number;
}

/** Exact sum of amounts, rounded to the cent. */
export const sumAmounts = (values: number[]): number =>
  values
    .reduce((acc, v) => acc.plus(v), new MadDecimal(0))
    .toDecimalPlaces(2)
    .toNumber();

export function campaignTotals(months: KpiMensuel[]): CampaignTotals {
  const ca = sumAmounts(months.map((m) => m.ca_mad));
  const marge = sumAmounts(months.map((m) => m.marge_mad));
  const commandes = months.reduce((n, m) => n + m.commandes, 0);
  return {
    ca,
    marge,
    tauxMarge: ca === 0 ? null : new MadDecimal(marge).div(ca).toDecimalPlaces(4).toNumber(),
    commandes,
    panierMoyen:
      commandes === 0 ? null : new MadDecimal(ca).div(commandes).toDecimalPlaces(2).toNumber(),
    nouveauxClients: months.reduce((n, m) => n + m.nouveaux_clients, 0),
    mois: months.length,
  };
}

const SEVERITY: Record<StockProduit['niveau_alerte'], number> = {
  rupture: 0,
  critique: 1,
  attention: 2,
  ok: 3,
};

/** Most urgent products first (rupture → critique → attention → ok), then shortest cover. */
export function bySeverity(stocks: StockProduit[]): StockProduit[] {
  return [...stocks].sort(
    (a, b) =>
      SEVERITY[a.niveau_alerte] - SEVERITY[b.niveau_alerte] ||
      (a.couverture_jours ?? Infinity) - (b.couverture_jours ?? Infinity) ||
      a.produit.localeCompare(b.produit),
  );
}

/** Segments in the contract's order (Revendeurs, Fidèles, …), unknown ones last. */
export function inContractOrder(segments: Segment[]): Segment[] {
  const rank = (s: string) => {
    const i = (SEGMENTS as readonly string[]).indexOf(s);
    return i === -1 ? SEGMENTS.length : i;
  };
  return [...segments].sort((a, b) => rank(a.segment) - rank(b.segment));
}

const SEGMENT_KEYS = ['revendeurs', 'fideles', 'a_reactiver', 'recents', 'occasionnels_inactifs'];

/** i18n key of a segment name from the model (`analyses.segments.<key>`), null if unknown. */
export function segmentKey(segment: string): string | null {
  const i = (SEGMENTS as readonly string[]).indexOf(segment);
  return i === -1 ? null : (SEGMENT_KEYS[i] ?? null);
}

/** i18n key of a QR alert level ('signalé' | 'à vérifier'). */
export function qrNiveauKey(niveau: 'signalé' | 'à vérifier'): 'signale' | 'a_verifier' {
  return niveau === 'signalé' ? 'signale' : 'a_verifier';
}

/** Total revenue of a segment's customers (exact). */
export function segmentRevenue(clients: ClientSegment[]): number {
  return sumAmounts(clients.map((c) => c.montant_mad));
}

/** "1 234,50 MAD" for any amount, negative included (formatMad takes non-negative strings). */
export function formatAmount(value: number, locale: 'fr' | 'ar'): string {
  const abs = new MadDecimal(value).abs().toFixed(2);
  return `${value < 0 ? '−' : ''}${formatMad(abs, locale)}`;
}

/** "37,2 %" from a ratio (0.372). */
export function formatPercent(ratio: number | null, locale: 'fr' | 'ar'): string {
  if (ratio === null) return '—';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-MA-u-nu-latn' : 'fr-FR', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(ratio);
}

/** The analysis date the API sends in `X-Date-Reference` (stock routes), if any. */
export function dateReference(response: unknown): string | null {
  const headers = (response as { headers?: Headers } | undefined)?.headers;
  return headers?.get?.('x-date-reference') ?? null;
}

/** "oct. 25": short month of a "YYYY-MM-DD" month start (fr-FR: fr-MA abbreviates June and July alike). */
export function monthLabel(mois: string, locale: 'fr' | 'ar'): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${mois}T00:00:00Z`));
}
