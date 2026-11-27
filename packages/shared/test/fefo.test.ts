import { describe, expect, it } from 'vitest';
import { aggregateDemande, allocateFefo } from '../src/index.js';

// Already FEFO-sorted, as returned by lockLotsForAllocation.
const lots = [
  { lot_id: 'L1', produit_id: 'P', stock: 3 }, // expires first
  { lot_id: 'Q1', produit_id: 'Q', stock: 10 },
  { lot_id: 'L2', produit_id: 'P', stock: 0 },
  { lot_id: 'L3', produit_id: 'P', stock: 5 },
];

describe('allocateFefo', () => {
  it('serves the earliest-expiring lot first and splits across lots', () => {
    const { allocations, manquants } = allocateFefo(lots, new Map([['P', 6]]));
    expect(manquants).toEqual([]);
    expect(allocations).toEqual([
      { produit_id: 'P', lot_id: 'L1', quantite: 3 },
      { produit_id: 'P', lot_id: 'L3', quantite: 3 },
    ]);
  });

  it('allocates several products independently', () => {
    const { allocations } = allocateFefo(
      lots,
      new Map([
        ['P', 2],
        ['Q', 4],
      ]),
    );
    expect(allocations).toEqual([
      { produit_id: 'P', lot_id: 'L1', quantite: 2 },
      { produit_id: 'Q', lot_id: 'Q1', quantite: 4 },
    ]);
  });

  it('is all-or-nothing: any shortage returns no allocation', () => {
    const result = allocateFefo(
      lots,
      new Map([
        ['P', 9],
        ['Q', 1],
        ['R', 1],
      ]),
    );
    expect(result.allocations).toEqual([]);
    expect(result.manquants).toEqual([
      { produit_id: 'P', demande: 9, disponible: 8 },
      { produit_id: 'R', demande: 1, disponible: 0 },
    ]);
  });

  it('aggregates duplicate lines and rejects invalid quantities', () => {
    expect(
      aggregateDemande([
        { produit_id: 'P', quantite: 1 },
        { produit_id: 'P', quantite: 2 },
      ]),
    ).toEqual(new Map([['P', 3]]));
    expect(() => allocateFefo(lots, new Map([['P', 0]]))).toThrow(RangeError);
  });
});
