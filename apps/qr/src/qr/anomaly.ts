import type { QrAlerte } from '@agricoop/shared';

export interface AnomalyPolicy {
  /** Unit-level code: more scans than this is suspicious. */
  maxScansUnite: number;
  /** Lot-level code: suspicious above this multiple of the lot's initial quantity. */
  lotScanFactor: number;
  /** Unit-level code: more distinct cities than this within 24 h is suspicious. */
  maxVilles24h: number;
}

export const DEFAULT_ANOMALY_POLICY: AnomalyPolicy = {
  maxScansUnite: 5,
  lotScanFactor: 2,
  maxVilles24h: 2,
};

export interface ScanFacts {
  niveau: 'lot' | 'unite';
  statut: 'actif' | 'desactive' | 'signale';
  expired: boolean;
  /** Total scans including the current one. */
  nbScans: number;
  /** Distinct known cities in the last 24 h, including the current scan's. */
  villes24h: number;
  quantiteInitiale: number;
}

/**
 * Alerts for a scan. Lot-level codes are legitimately scanned by many buyers in many cities (the
 * synthetic data shows it), so the city rule applies to unit-level codes only and the count rule is
 * relative to the lot size.
 */
export function evaluateScan(
  f: ScanFacts,
  policy: AnomalyPolicy = DEFAULT_ANOMALY_POLICY,
): QrAlerte[] {
  const alertes: QrAlerte[] = [];
  if (f.statut !== 'actif') alertes.push('qr_inactif');
  if (f.expired) alertes.push('lot_perime');
  const maxScans =
    f.niveau === 'unite' ? policy.maxScansUnite : policy.lotScanFactor * f.quantiteInitiale;
  if (f.nbScans > maxScans) alertes.push('scans_multiples');
  if (f.niveau === 'unite' && f.villes24h > policy.maxVilles24h) alertes.push('villes_multiples');
  return alertes;
}
