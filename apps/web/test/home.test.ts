import type { CooperativePublique, ProduitCatalogue } from '@agricoop/shared';
import { describe, expect, it } from 'vitest';
import {
  groupeOf,
  type ProduitVitrine,
  selectFeatured,
  summarizeCoop,
  summarizeGroupes,
} from '../src/lib/home';
import { productPhoto } from '../src/lib/images';

const coopA: CooperativePublique = { code: 'COOPA', nom: 'A', province: 'Ouezzane' };
const coopB: CooperativePublique = { code: 'COOPB', nom: 'B', province: 'Taounate' };

let n = 0;
function produit(coop: CooperativePublique, over: Partial<ProduitCatalogue> = {}): ProduitVitrine {
  n += 1;
  return {
    produit_id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    code: `P${n}`,
    nom: `Produit ${n}`,
    famille: 'alimentaire',
    categorie: 'huile',
    prix_mad: '10.00',
    niveau_qr: 'lot',
    disponible: 5,
    ...over,
    coop,
  };
}

describe('home page data', () => {
  it('groups products the way the category tiles do', () => {
    expect(groupeOf({ categorie: 'huile', famille: 'alimentaire' })).toBe('huile');
    expect(groupeOf({ categorie: 'olives_table', famille: 'alimentaire' })).toBe('olives');
    expect(groupeOf({ categorie: 'savon', famille: 'cosmetique' })).toBe('soins');
    expect(groupeOf({ categorie: 'coffret', famille: 'coffret' })).toBe('coffrets');
    expect(groupeOf({ categorie: 'infusion', famille: 'alimentaire' })).toBeNull();
  });

  it('features available products only, alternating cooperatives', () => {
    const a = [produit(coopA), produit(coopA), produit(coopA, { disponible: 0 }), produit(coopA)];
    const b = [produit(coopB)];
    const featured = selectFeatured([...a, ...b], 3);
    expect(featured.map((p) => p.coop.code)).toEqual(['COOPA', 'COOPB', 'COOPA']);
    expect(featured.every((p) => p.disponible > 0)).toBe(true);
  });

  it('sends each tile to the cooperative with the most products of that kind', () => {
    const groupes = summarizeGroupes([
      produit(coopA, { categorie: 'savon', famille: 'cosmetique' }),
      produit(coopB, { categorie: 'savon', famille: 'cosmetique' }),
      produit(coopB, { categorie: 'soin', famille: 'cosmetique' }),
    ]);
    expect(groupes.find((g) => g.groupe === 'soins')).toEqual({
      groupe: 'soins',
      count: 3,
      coopCode: 'COOPB',
    });
    expect(groupes.find((g) => g.groupe === 'huile')).toEqual({
      groupe: 'huile',
      count: 0,
      coopCode: null,
    });
  });

  it('summarizes a cooperative with exact money (lowest available price)', () => {
    const s = summarizeCoop(coopA, [
      produit(coopA, { prix_mad: '75.00' }),
      produit(coopA, { prix_mad: '15.10', famille: 'cosmetique', categorie: 'savon' }),
      produit(coopA, { prix_mad: '1.00', disponible: 0 }),
    ]);
    expect(s.prixMin).toBe('15.10');
    expect(s.produits).toBe(3);
    expect(s.familles).toEqual(['alimentaire', 'cosmetique']);
    expect(summarizeCoop(coopB, []).prixMin).toBeNull();
  });

  it('alternates photos within a category and falls back by famille', () => {
    expect(productPhoto('huile', 'alimentaire', 0)).not.toBe(
      productPhoto('huile', 'alimentaire', 1),
    );
    expect(productPhoto('huile', 'alimentaire', 2)).toBe(productPhoto('huile', 'alimentaire', 0));
    expect(productPhoto('unknown', 'coffret')).toBe('coffret');
  });
});
