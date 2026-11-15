import type { KpiMensuel, StockProduit } from '@agricoop/shared';
import { describe, expect, it } from 'vitest';
import {
  bySeverity,
  campaignOf,
  campaigns,
  campaignTotals,
  dateReference,
  formatAmount,
  inContractOrder,
  monthLabel,
  qrNiveauKey,
  segmentKey,
  segmentRevenue,
} from '../src/analytics/insights';

const kpi = (mois: string, ca: number, marge: number, commandes: number): KpiMensuel => ({
  mois,
  commandes,
  ca_mad: ca,
  marge_mad: marge,
  taux_marge: marge / ca,
  panier_moyen_mad: ca / commandes,
  clients_actifs: commandes,
  nouveaux_clients: 1,
});

const stock = (
  produit: string,
  niveau_alerte: StockProduit['niveau_alerte'],
  couverture_jours: number | null,
): StockProduit => ({
  produit,
  famille: 'alimentaire',
  stock_disponible: 1,
  vente_moy_jour: 1,
  couverture_jours,
  niveau_alerte,
});

describe('analytics insights', () => {
  it('maps months to October → September campaigns', () => {
    expect(campaignOf('2025-10-01')).toBe('2025-2026');
    expect(campaignOf('2026-09-01')).toBe('2025-2026');
    expect(campaignOf('2026-10-01')).toBe('2026-2027');
    expect(campaigns([kpi('2024-11-01', 1, 1, 1), kpi('2025-10-01', 1, 1, 1)])).toEqual([
      '2025-2026',
      '2024-2025',
    ]);
  });

  it('totals a campaign exactly (no float drift)', () => {
    const t = campaignTotals([kpi('2025-10-01', 0.1, 0.05, 1), kpi('2025-11-01', 0.2, 0.1, 2)]);
    expect(t).toEqual({
      ca: 0.3,
      marge: 0.15,
      tauxMarge: 0.5,
      commandes: 3,
      panierMoyen: 0.1,
      nouveauxClients: 2,
      mois: 2,
    });
    expect(campaignTotals([])).toMatchObject({ tauxMarge: null, panierMoyen: null });
  });

  it('puts the most urgent products first', () => {
    const sorted = bySeverity([
      stock('A', 'ok', null),
      stock('B', 'attention', 20),
      stock('C', 'critique', 9),
      stock('D', 'rupture', 0),
      stock('E', 'critique', 3),
    ]);
    expect(sorted.map((s) => s.produit)).toEqual(['D', 'E', 'C', 'B', 'A']);
  });

  it('orders segments as the contract lists them', () => {
    const s = (segment: string) => ({ segment, clients: 1, part_clients: 0, part_ca: 0 });
    expect(
      inContractOrder([s('Récents'), s('Autre'), s('Revendeurs')]).map((x) => x.segment),
    ).toEqual(['Revendeurs', 'Récents', 'Autre']);
    expect(
      segmentRevenue([
        { client_id: 'a', recence_j: 1, frequence: 1, montant_mad: 0.1 },
        { client_id: 'b', recence_j: 1, frequence: 1, montant_mad: 0.2 },
      ]),
    ).toBe(0.3);
  });

  it('labels months unambiguously', () => {
    expect(monthLabel('2026-06-01', 'fr')).toBe('juin 26');
    expect(monthLabel('2026-07-01', 'fr')).toBe('juil. 26');
  });

  it('maps model labels to translation keys', () => {
    expect(segmentKey('Fidèles')).toBe('fideles');
    expect(segmentKey('Occasionnels inactifs')).toBe('occasionnels_inactifs');
    expect(segmentKey('Autre')).toBeNull();
    expect(qrNiveauKey('signalé')).toBe('signale');
    expect(qrNiveauKey('à vérifier')).toBe('a_verifier');
  });

  it('formats negative amounts and reads the reference date header', () => {
    expect(formatAmount(-1234.5, 'fr')).toBe('−1\u202f234,50 MAD');
    expect(formatAmount(15, 'ar')).toBe('15,00 د.م.');
    expect(dateReference({ headers: new Headers({ 'x-date-reference': '2026-10-01' }) })).toBe(
      '2026-10-01',
    );
    expect(dateReference(undefined)).toBeNull();
  });
});
