/*
 * /api/analytics (contracts/api/analytics.yaml) against the data plane's real gold layer:
 * schema.sql + the notebooks' ML tables + data/bi/01..04_*.sql, unchanged.
 */
import {
  createTestIssuer,
  loadGoldLayer,
  ownerQuery,
  queryUrl,
  startTestDatabase,
  type TestDatabase,
  type TestIssuer,
} from '@agricoop/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './support/test-app';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [P1, P2, P3, PB] = [id(1), id(2), id(3), id(4)];
const [C1, C2, CB] = [id(11), id(12), id(13)];
const [L1, L2, L3, L4, L5, LB] = [id(21), id(22), id(23), id(24), id(25), id(26)];
const [Q1, Q2, Q3] = [id(31), id(32), id(33)];

async function seed(db: TestDatabase): Promise<void> {
  const q = (sql: string, params: unknown[] = []) => ownerQuery(db, sql, params);
  await q(
    `INSERT INTO cooperative (coop_id, code, nom, province) VALUES
       ($1, 'COOPA', 'A', 'Ouezzane'), ($2, 'COOPB', 'B', 'Taounate')`,
    [A, B],
  );
  await q(
    `INSERT INTO produit (produit_id, coop_id, code, nom, famille, categorie, prix_mad, cout_mad,
                          conservation_j, huile_ml_par_unite, niveau_qr) VALUES
       ($1, $5, 'HVE-1L',  'Huile',   'alimentaire', 'huile',   80.00,  40.00, 540, 1000, 'lot'),
       ($2, $5, 'SAV-100G','Savon',   'cosmetique',  'savon',   15.00,   6.00, 730,   60, 'lot'),
       ($3, $5, 'COF-CAD', 'Coffret', 'coffret',     'coffret', 220.00, 120.00, 365, 300, 'lot'),
       ($4, $6, 'HV-5L',   'Huile B', 'alimentaire', 'huile',   300.00, 200.00, 540, 5000, 'lot')`,
    [P1, P2, P3, PB, A, B],
  );
  await q(
    `INSERT INTO client (client_id, coop_id, type_client, ville, date_inscription) VALUES
       ($1, $4, 'particulier', 'Fès', '2026-01-01'),
       ($2, $4, 'revendeur', 'Rabat', '2026-01-01'),
       ($3, $5, 'particulier', 'Tanger', '2026-01-01')`,
    [C1, C2, CB, A, B],
  );
  // Lots (A): L1 expires 29 days after the reference date; L3 already expired; L4 has more
  // stock than it produced (an anomaly).
  await q(
    `INSERT INTO lot (lot_id, coop_id, produit_id, numero, date_fabrication, date_peremption,
                      quantite_initiale) VALUES
       ($1, $7, $8,  'HVE-1L-A',   '2026-01-10', '2026-07-20', 100),
       ($2, $7, $9,  'SAV-A',      '2026-02-01', '2028-01-01',  30),
       ($3, $7, $8,  'HVE-1L-OLD', '2025-01-01', '2026-03-01',  10),
       ($4, $7, $9,  'SAV-BAD',    '2026-02-01', '2028-01-01',   5),
       ($5, $7, $10, 'COF-A',      '2026-02-01', '2027-01-01',   5),
       ($6, $11, $12, 'HV-5L-B',   '2026-01-01', '2027-06-01',  20)`,
    [L1, L2, L3, L4, L5, LB, A, P1, P2, P3, B, PB],
  );
  await q(
    `INSERT INTO mouvement_stock (coop_id, lot_id, type_mouvement, quantite, date_mouvement)
     SELECT coop_id, lot_id, 'entree',
            CASE WHEN lot_id = $1 THEN 8 ELSE quantite_initiale END, date_fabrication + time '08:00'
       FROM lot`,
    [L4],
  );
  // Orders (A): May 10 (C1) and June 20 (C2) → reference date 2026-06-21. (B): March 1.
  const order = async (
    coop: string,
    client: string,
    at: string,
    lines: [produit: string, lot: string, qty: number, prix: string][],
  ) => {
    const [o] = await ownerQuery<{ id: string }>(
      db,
      `INSERT INTO commande (coop_id, client_id, canal, date_commande, statut)
       VALUES ($1, $2, 'web', $3, 'livree') RETURNING commande_id AS id`,
      [coop, client, at],
    );
    for (const [produit, lot, qty, prix] of lines) {
      await q(
        `INSERT INTO ligne_commande (coop_id, commande_id, produit_id, lot_id, quantite, prix_unitaire_mad)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [coop, o!.id, produit, lot, qty, prix],
      );
      await q(
        `INSERT INTO mouvement_stock (coop_id, lot_id, type_mouvement, quantite, date_mouvement)
         VALUES ($1, $2, 'sortie', $3, $4)`,
        [coop, lot, qty, at],
      );
    }
  };
  await order(A, C1, '2026-05-10T12:00:00Z', [
    [P1, L1, 2, '80.00'],
    [P2, L2, 3, '15.00'],
  ]);
  await order(A, C2, '2026-06-20T12:00:00Z', [
    [P1, L1, 10, '80.00'],
    [P2, L2, 20, '15.00'],
    [P3, L5, 5, '220.00'],
  ]);
  await order(B, CB, '2026-03-01T12:00:00Z', [[PB, LB, 1, '300.00']]);

  // Forecasts (written back by the data plane): the week of 05-04 (order of May 10) is over;
  // 06-22 is upcoming. (A week counts as over only once it ends before the reference date.)
  await q(
    `INSERT INTO prevision (coop_id, famille, semaine, quantite_prevue, version_modele) VALUES
       ($1, 'alimentaire', '2026-05-04', 12.4, 'v1'),
       ($1, 'alimentaire', '2026-06-22', 9, 'v1'),
       ($1, 'cosmetique',  '2026-05-04', 18, 'v1')`,
    [A],
  );
  // ML outputs (gold tables of the notebooks): an older analysis that must be ignored.
  await q(
    `INSERT INTO gold.segment_client (coop_id, client_id, segment, recence_j, frequence,
                                      montant_mad, panier_moyen, date_analyse, version_modele) VALUES
       ($1, $2, 'Récents',    80, 1,  205.00,  205.00, '2026-05-01', 'v0'),
       ($1, $2, 'Fidèles',    42, 1,  205.00,  205.00, '2026-06-21', 'v1'),
       ($1, $3, 'Revendeurs',  1, 1, 2200.00, 2200.00, '2026-06-21', 'v1'),
       ($4, $5, 'Récents',   112, 1,  300.00,  300.00, '2026-06-21', 'v1')`,
    [A, C1, C2, B, CB],
  );
  await q(
    `INSERT INTO gold.alerte_qr (coop_id, qr_id, niveau, nb_scans, nb_villes, distance_max_km,
                                 duree_jours, date_analyse, regle) VALUES
       ($1, $2, 'signalé',    9, 4, 512.3, 2.5, '2026-06-21', 'nb_villes >= 3'),
       ($1, $3, 'à vérifier', 3, 2,  87.0, 1.0, '2026-06-21', 'nb_villes == 2'),
       ($1, $4, 'signalé',    5, 3, 300.0, 4.0, '2026-05-01', 'nb_villes >= 3')`,
    [A, Q1, Q2, Q3],
  );
}

describe('analytics API (gold layer)', () => {
  let db: TestDatabase;
  let issuer: TestIssuer;
  let app: NestFastifyApplication;
  let readerUrl: string;
  const t: Record<string, string> = {};
  const get = (path: string, who = 'a') =>
    request(app.getHttpServer())
      .get(path)
      .set({ authorization: `Bearer ${t[who]}` });

  beforeAll(async () => {
    [db, issuer] = await Promise.all([startTestDatabase(), createTestIssuer()]);
    readerUrl = await loadGoldLayer(db);
    await seed(db);
    app = await createTestApp(db, issuer, { analyticsUrl: readerUrl });
    t.a = await issuer.sign({ roles: ['coop_manager'], tenantId: A });
    t.b = await issuer.sign({ roles: ['coop_manager'], tenantId: B });
    t.customer = await issuer.sign({ roles: ['customer'] });
  });

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it('serves the contract paths (outside /api/v1), for coop managers only', async () => {
    await get('/api/analytics/kpi-mensuels').expect(200);
    await get('/api/v1/analytics/kpi-mensuels').expect(404);
    await get('/api/analytics/kpi-mensuels', 'customer').expect(403);
    await request(app.getHttpServer()).get('/api/analytics/kpi-mensuels').expect(401);
  });

  it('monthly KPIs: exact figures, per cooperative, filtered by campaign', async () => {
    const res = await get('/api/analytics/kpi-mensuels').expect(200);
    expect(res.body).toEqual([
      {
        mois: '2026-05-01',
        commandes: 1,
        ca_mad: 205,
        marge_mad: 107,
        taux_marge: 0.522,
        panier_moyen_mad: 205,
        clients_actifs: 1,
        nouveaux_clients: 1,
      },
      {
        mois: '2026-06-01',
        commandes: 1,
        ca_mad: 2200,
        marge_mad: 1080,
        taux_marge: 0.4909,
        panier_moyen_mad: 2200,
        clients_actifs: 1,
        nouveaux_clients: 1,
      },
    ]);
    expect((await get('/api/analytics/kpi-mensuels?campagne=2024-2025').expect(200)).body).toEqual(
      [],
    );
    expect(
      (await get('/api/analytics/kpi-mensuels?campagne=2025-2026').expect(200)).body,
    ).toHaveLength(2);
    await get('/api/analytics/kpi-mensuels?campagne=2025-2027').expect(400);
    const b = await get('/api/analytics/kpi-mensuels', 'b').expect(200);
    expect((b.body as { mois: string }[]).map((k) => k.mois)).toEqual(['2026-03-01']);
  });

  it('stock coverage with the alert level computed by the API, and X-Date-Reference', async () => {
    const res = await get('/api/analytics/stocks').expect(200);
    expect(res.headers['x-date-reference']).toBe('2026-06-21');
    const byProduit = Object.fromEntries(
      (res.body as { produit: string }[]).map((s) => [s.produit, s]),
    );
    expect(byProduit['HVE-1L']).toMatchObject({ stock_disponible: 88, niveau_alerte: 'ok' });
    // SAV: 7 left in SAV-A + 8 in the anomalous lot, 20 sold in 28 days → 21 days of cover.
    expect(byProduit['SAV-100G']).toMatchObject({
      stock_disponible: 15,
      couverture_jours: 21,
      niveau_alerte: 'attention',
    });
    expect(byProduit['COF-CAD']).toMatchObject({ stock_disponible: 0, niveau_alerte: 'rupture' });
  });

  it('lots to watch, unsold risk and stock anomalies', async () => {
    const lots = await get('/api/analytics/lots-a-surveiller').expect(200);
    expect(lots.headers['x-date-reference']).toBe('2026-06-21');
    expect(lots.body).toEqual([
      {
        produit: 'HVE-1L',
        lot: 'HVE-1L-A',
        date_peremption: '2026-07-20',
        stock_actuel: 88,
        jours_avant_peremption: 29,
      },
    ]);
    const risque = await get('/api/analytics/risque-invendus').expect(200);
    expect(risque.body[0]).toMatchObject({ produit: 'HVE-1L', lot: 'HVE-1L-A', stock_actuel: 88 });
    expect(risque.body[0].unites_a_risque).toBeGreaterThan(0);
    const anomalies = await get('/api/analytics/anomalies-stock').expect(200);
    expect(anomalies.body).toEqual([
      {
        produit: 'SAV-100G',
        lot: 'SAV-BAD',
        stock_actuel: 8,
        anomalie: 'stock supérieur à la quantité produite',
      },
    ]);
  });

  it('forecasts against sales, with upcoming weeks and a famille filter', async () => {
    const res = await get('/api/analytics/previsions?famille=alimentaire').expect(200);
    expect(res.body).toEqual([
      {
        famille: 'alimentaire',
        semaine: '2026-05-04',
        quantite_prevue: 12,
        ventes: 2,
        ecart: -10,
        semaine_a_venir: false,
        version_modele: 'v1',
      },
      {
        famille: 'alimentaire',
        semaine: '2026-06-22',
        quantite_prevue: 9,
        ventes: null,
        ecart: null,
        semaine_a_venir: true,
        version_modele: 'v1',
      },
    ]);
    expect((await get('/api/analytics/previsions').expect(200)).body).toHaveLength(3);
    await get('/api/analytics/previsions?famille=bijoux').expect(400);
  });

  it('QR alerts and customer segments from the latest analysis only', async () => {
    const alertes = await get('/api/analytics/alertes-qr').expect(200);
    expect((alertes.body as { qr_id: string }[]).map((a) => a.qr_id)).toEqual([Q1, Q2]);
    const signales = await get(`/api/analytics/alertes-qr?niveau=${encodeURIComponent('signalé')}`);
    expect(signales.body).toEqual([
      {
        qr_id: Q1,
        niveau: 'signalé',
        nb_scans: 9,
        nb_villes: 4,
        distance_max_km: 512.3,
        duree_jours: 2.5,
        date_analyse: '2026-06-21',
      },
    ]);

    const segments = await get('/api/analytics/segments').expect(200);
    expect(segments.body).toEqual([
      { segment: 'Revendeurs', clients: 1, part_clients: 0.5, part_ca: 0.9148 },
      { segment: 'Fidèles', clients: 1, part_clients: 0.5, part_ca: 0.0852 },
    ]);
    const fideles = await get(`/api/analytics/segments/${encodeURIComponent('Fidèles')}/clients`);
    expect(fideles.body).toEqual([
      { client_id: C1, recence_j: 42, frequence: 1, montant_mad: 205 },
    ]);
    await get('/api/analytics/segments/Inconnus/clients').expect(400);
    // Another cooperative never sees A's segments.
    const b = await get('/api/analytics/segments', 'b').expect(200);
    expect(b.body).toEqual([{ segment: 'Récents', clients: 1, part_clients: 1, part_ca: 1 }]);
  });

  it('the reader role sees the gold schema only — never application tables or client_pii', async () => {
    await expect(queryUrl(readerUrl, 'SELECT * FROM client_pii')).rejects.toThrow(
      /permission denied/,
    );
    await expect(queryUrl(readerUrl, 'SELECT * FROM commande')).rejects.toThrow(
      /permission denied/,
    );
    const [row] = await queryUrl<{ n: number }>(
      readerUrl,
      'SELECT count(*)::int AS n FROM gold.v_kpi_mensuel',
    );
    expect(row!.n).toBeGreaterThan(0);
  });

  it('answers 503 when no analytics connection is configured', async () => {
    const bare = await createTestApp(db, issuer);
    try {
      const res = await request(bare.getHttpServer())
        .get('/api/analytics/stocks')
        .set({ authorization: `Bearer ${t.a}` })
        .expect(503);
      expect(res.body.code).toBe('analytics_indisponible');
    } finally {
      await bare.close();
    }
  });
});
