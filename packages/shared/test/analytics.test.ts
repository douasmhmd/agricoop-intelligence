import { describe, expect, it } from 'vitest';
import { campagneBounds, kpiMensuelQuery, niveauAlerteStock } from '../src/index.js';

describe('analytics helpers (contracts/api/analytics.yaml)', () => {
  it('computes the stock alert level as the contract defines it', () => {
    expect(niveauAlerteStock(0, 10)).toBe('rupture');
    expect(niveauAlerteStock(5, 13)).toBe('critique');
    expect(niveauAlerteStock(5, 14)).toBe('attention');
    expect(niveauAlerteStock(5, 30)).toBe('attention');
    expect(niveauAlerteStock(5, 31)).toBe('ok');
    expect(niveauAlerteStock(5, null)).toBe('ok'); // no recent sales
  });

  it('maps an olive campaign to October → September months', () => {
    expect(campagneBounds('2025-2026')).toEqual({ debut: '2025-10-01', fin: '2026-09-01' });
    expect(kpiMensuelQuery.safeParse({ campagne: '2025-2026' }).success).toBe(true);
    expect(kpiMensuelQuery.safeParse({ campagne: '2025-2027' }).success).toBe(false);
    expect(kpiMensuelQuery.safeParse({ campagne: '25-26' }).success).toBe(false);
  });
});
