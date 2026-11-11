import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CANAUX,
  COMMANDE_STATUTS,
  FAMILLES,
  NIVEAUX_QR,
  QR_STATUTS,
  TYPES_CLIENT,
  TYPES_MOUVEMENT,
  canTransition,
} from '../src/index.js';

const schemaSql = readFileSync(
  fileURLToPath(new URL('../../../contracts/db/schema.sql', import.meta.url)),
  'utf8',
);

/** Returns { "table.column": [values] } for every `CHECK (column IN (...))` in schema.sql. */
function checkConstraints(sql: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const tables = sql.split(/CREATE TABLE\s+/i).slice(1);
  for (const block of tables) {
    const table = /^(\w+)/.exec(block)?.[1];
    if (!table) continue;
    for (const m of block.matchAll(/CHECK\s*\(\s*(\w+)\s+IN\s*\(([^)]*)\)\s*\)/gi)) {
      const values = [...(m[2] ?? '').matchAll(/'([^']*)'/g)].map((v) => v[1] ?? '');
      result[`${table}.${m[1]}`] = values;
    }
  }
  return result;
}

describe('enums mirror schema.sql CHECK constraints', () => {
  const checks = checkConstraints(schemaSql);

  it.each([
    ['produit.famille', FAMILLES],
    ['produit.niveau_qr', NIVEAUX_QR],
    ['qr_code.niveau', NIVEAUX_QR],
    ['qr_code.statut', QR_STATUTS],
    ['client.type_client', TYPES_CLIENT],
    ['commande.canal', CANAUX],
    ['commande.statut', COMMANDE_STATUTS],
    ['mouvement_stock.type_mouvement', TYPES_MOUVEMENT],
  ])('%s', (key, values) => {
    expect(checks[key]).toBeDefined();
    expect([...values].sort()).toEqual([...(checks[key] ?? [])].sort());
  });

  it('covers every enum CHECK constraint in the schema', () => {
    expect(Object.keys(checks).sort()).toEqual(
      [
        'client.type_client',
        'commande.canal',
        'commande.statut',
        'mouvement_stock.type_mouvement',
        'produit.famille',
        'produit.niveau_qr',
        'qr_code.niveau',
        'qr_code.statut',
      ].sort(),
    );
  });
});

describe('commande status machine', () => {
  it('follows creee → payee → expediee → livree', () => {
    expect(canTransition('creee', 'payee')).toBe(true);
    expect(canTransition('payee', 'expediee')).toBe(true);
    expect(canTransition('expediee', 'livree')).toBe(true);
  });

  it('allows annulee only from creee and payee', () => {
    expect(canTransition('creee', 'annulee')).toBe(true);
    expect(canTransition('payee', 'annulee')).toBe(true);
    expect(canTransition('expediee', 'annulee')).toBe(false);
    expect(canTransition('livree', 'annulee')).toBe(false);
  });

  it('rejects skipping steps and leaving terminal states', () => {
    expect(canTransition('creee', 'expediee')).toBe(false);
    expect(canTransition('livree', 'creee')).toBe(false);
    expect(canTransition('annulee', 'payee')).toBe(false);
  });
});
