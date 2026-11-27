import type { CommandeResume, Lot, Previsions, Produit } from '@agricoop/shared';
import { describe, expect, it } from 'vitest';
import {
  deltaPct,
  forecastTotals,
  ordersWindow,
  scanSummary,
  stockSummary,
} from '../src/dashboard/metrics';

// Before 2026-09-20 every tz data version agrees on Casablanca's offset (see docs/conventions.md).
const TODAY = '2026-06-30';

function order(
  date: string,
  montant: string,
  statut: CommandeResume['statut'] = 'livree',
): CommandeResume {
  return {
    commande_id: crypto.randomUUID(),
    client_id: crypto.randomUUID(),
    canal: 'web',
    date_commande: date,
    statut,
    montant_total_mad: montant,
    nb_lignes: 1,
    ville: 'Fès',
    type_client: 'particulier',
    is_synthetic: false,
  };
}

describe('dashboard metrics', () => {
  it('splits revenue into the last 30 days and the 30 before, exactly, without cancelled orders', () => {
    const w = ordersWindow(
      [
        order('2026-06-30T10:00:00Z', '10.10'),
        order('2026-06-01T10:00:00Z', '20.20'), // first day of the window
        order('2026-06-15T10:00:00Z', '999.00', 'annulee'),
        order('2026-05-31T10:00:00Z', '5.05'), // previous window
        order('2026-03-01T10:00:00Z', '1.00'), // too old
      ],
      TODAY,
      true,
    );
    expect(w.revenue).toBe('30.30');
    expect(w.revenuePrevious).toBe('5.05');
    expect(w.count).toBe(2);
    expect(w.countPrevious).toBe(1);
    expect(w.dailyRevenue).toHaveLength(30);
    expect(w.dailyRevenue.at(-1)).toEqual({ date: '2026-06-30', value: 10.1 });
  });

  it('counts an order on its Casablanca day (late UTC evening = next day)', () => {
    const w = ordersWindow([order('2026-06-29T23:30:00Z', '7.00')], TODAY, true);
    expect(w.dailyCount.at(-1)).toEqual({ date: '2026-06-30', value: 1 });
  });

  it('computes deltas, null without a previous value', () => {
    expect(deltaPct('150.00', '100.00')).toBe(50);
    expect(deltaPct(3, 4)).toBe(-25);
    expect(deltaPct('10.00', '0.00')).toBeNull();
  });

  it('values available stock at cost price, by famille', () => {
    const produit = (id: string, famille: Produit['famille'], cout: string) =>
      ({ produit_id: id, famille, cout_mad: cout }) as Produit;
    const lot = (produit_id: string, stock: number, statut: Lot['statut'] = 'disponible') =>
      ({ produit_id, stock, statut }) as Lot;
    const s = stockSummary(
      [lot('a', 10), lot('b', 3), lot('a', 5, 'perime'), lot('a', 0, 'epuise')],
      [produit('a', 'alimentaire', '44.10'), produit('b', 'cosmetique', '7.50')],
    );
    expect(s.valueAtCost).toBe('463.50'); // 10 × 44.10 + 3 × 7.50
    expect(s.units).toBe(13);
    expect(s.byFamille.map((f) => [f.famille, f.units, f.value])).toEqual([
      ['alimentaire', 10, '441.00'],
      ['cosmetique', 3, '22.50'],
    ]);
  });

  it('derives the previous 30 days of scans from the 60-day window', () => {
    const s = scanSummary(
      [
        { ville: 'Fès', nb_scans: 4, nb_qr: 1 },
        { ville: 'Rabat', nb_scans: 6, nb_qr: 2 },
      ],
      [
        { ville: 'Fès', nb_scans: 9, nb_qr: 1 },
        { ville: 'Rabat', nb_scans: 6, nb_qr: 2 },
      ],
    );
    expect(s).toEqual({
      total: 10,
      previous: 5,
      top: [
        { ville: 'Rabat', scans: 6 },
        { ville: 'Fès', scans: 4 },
      ],
    });
  });

  it('sums forecasts and sales across familles, keeping gaps', () => {
    const p: Previsions = {
      version_modele: 'v2',
      depuis: '2026-06-01',
      jusqua: '2026-06-08',
      series: [
        {
          famille: 'alimentaire',
          points: [
            { semaine: '2026-06-01', quantite_prevue: '12.50', quantite_vendue: 4 },
            { semaine: '2026-06-08', quantite_prevue: null, quantite_vendue: 2 },
          ],
        },
        {
          famille: 'cosmetique',
          points: [
            { semaine: '2026-06-01', quantite_prevue: '3.25', quantite_vendue: 1 },
            { semaine: '2026-06-08', quantite_prevue: null, quantite_vendue: 0 },
          ],
        },
      ],
    };
    expect(forecastTotals(p)).toEqual([
      { semaine: '2026-06-01', vendues: 5, prevues: 15.75 },
      { semaine: '2026-06-08', vendues: 2, prevues: null },
    ]);
  });
});
