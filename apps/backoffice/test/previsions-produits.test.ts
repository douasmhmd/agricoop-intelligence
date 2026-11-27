import type { PrevisionProduit } from '@agricoop/shared';
import { describe, expect, it } from 'vitest';
import {
  famillesOf,
  formatQuantite,
  forWeek,
  isSimulation,
  latestCalcul,
  totalPrevu,
  versionsOf,
  weeksOf,
} from '../src/previsions/produits';

const row = (
  code: string,
  famille: string,
  semaine: string,
  quantite_prevue: string,
): PrevisionProduit => ({
  produit_id: '00000000-0000-4000-8000-000000000001',
  code_produit: code,
  nom_produit: code,
  famille,
  semaine,
  quantite_prevue,
  type_prevision: 'simulation_apres_historique',
  version_modele: 'lightgbm/1',
  date_calcul: '2026-11-22T16:47:22.000Z',
});

const rows = [
  row('HV-5L', 'alimentaire', '2026-09-28', '3.56'),
  row('CREME-50ML', 'cosmetique', '2026-09-28', '17.59'),
  row('COF-CAD', 'coffret', '2026-09-28', '2.35'),
  row('HV-5L', 'alimentaire', '2026-09-21', '4.10'),
];

describe('per-product forecasts', () => {
  it('lists weeks newest first and families sorted, without duplicates', () => {
    expect(weeksOf(rows)).toEqual(['2026-09-28', '2026-09-21']);
    expect(famillesOf(rows)).toEqual(['alimentaire', 'coffret', 'cosmetique']);
    expect(weeksOf([])).toEqual([]);
  });

  it('keeps one week, optionally one family, in the API order', () => {
    expect(forWeek(rows, '2026-09-28').map((r) => r.code_produit)).toEqual([
      'HV-5L',
      'CREME-50ML',
      'COF-CAD',
    ]);
    expect(forWeek(rows, '2026-09-28', 'alimentaire')).toHaveLength(1);
    expect(forWeek(rows, '2026-09-14')).toEqual([]);
  });

  it('sums quantities exactly (decimal, not floating point)', () => {
    // With JS numbers, 0.1 + 0.2 would be 0.30000000000000004.
    expect(totalPrevu(forWeek(rows, '2026-09-28'))).toBe('23.50');
    expect(
      totalPrevu([row('A', 'x', '2026-09-28', '0.1'), row('B', 'x', '2026-09-28', '0.2')]),
    ).toBe('0.30');
    expect(totalPrevu([])).toBe('0.00');
  });

  it('formats quantity strings with grouping, a decimal comma and no trailing zeros', () => {
    expect(formatQuantite('17.59')).toBe('17,59');
    expect(formatQuantite('3.00')).toBe('3');
    expect(formatQuantite('23.50')).toBe('23,5');
    expect(formatQuantite('1234567.25')).toBe('1 234 567,25');
    // NUMERIC(12,2) goes beyond the money helpers' 8 integer digits.
    expect(formatQuantite('9999999999.99')).toBe('9 999 999 999,99');
  });

  it('tells historical simulations from forecasts', () => {
    expect(isSimulation('simulation_apres_historique')).toBe(true);
    expect(isSimulation('prevision')).toBe(false);
  });
});

describe('per-product forecast metadata', () => {
  it('lists model versions once and finds the latest calculation', () => {
    const a = { ...row('A', 'x', '2026-09-28', '1'), version_modele: 'v1' };
    const b = {
      ...row('B', 'x', '2026-09-28', '1'),
      version_modele: 'v2',
      date_calcul: '2026-11-23T08:00:00.000Z',
    };
    expect(versionsOf([a, b, a])).toEqual(['v1', 'v2']);
    expect(latestCalcul([a, b])).toBe('2026-11-23T08:00:00.000Z');
    expect(latestCalcul([])).toBeNull();
  });
});
