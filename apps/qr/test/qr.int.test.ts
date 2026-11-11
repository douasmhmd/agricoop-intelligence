/*
 * QR service — generation, labels, public verification, anomaly rules and back office, against
 * Postgres with and without RLS proposal 001 (which adds the qr_lookup() function).
 */
import { assertValidEvent, type EventType } from '@agricoop/events';
import { RequestContext } from '@agricoop/nest-kit';
import {
  createTestIssuer,
  ownerQuery,
  startTestDatabase,
  type TestDatabase,
  type TestIssuer,
} from '@agricoop/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderLabelSheet } from '../src/qr/labels-pdf';
import { QrCodesService } from '../src/qr/qr-codes.service';
import { generateQrToken, hashQrToken } from '../src/qr/tokens';
import { createQrTestApp } from './support/test-app';

const COOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COOP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const clock = { now: () => new Date('2026-11-11T12:00:00Z') };
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)';

interface Ids {
  lotHuile: string;
  lotBidon: string;
  lotPerime: string;
  lotB: string;
}

async function seed(db: TestDatabase): Promise<Ids> {
  await ownerQuery(
    db,
    `INSERT INTO cooperative (coop_id, code, nom, province) VALUES
       ($1, 'COOPA', 'Coopérative Zitoun', 'Ouezzane'), ($2, 'COOPB', 'Coopérative B', 'Taounate')`,
    [COOP_A, COOP_B],
  );
  const produit = async (coop: string, code: string, niveau: string) =>
    (
      await ownerQuery<{ id: string }>(
        db,
        `INSERT INTO produit (coop_id, code, nom, famille, categorie, prix_mad, cout_mad, conservation_j, niveau_qr)
         VALUES ($1, $2, $3, 'alimentaire', 'huile', 75, 40, 540, $4) RETURNING produit_id AS id`,
        [coop, code, `Huile ${code}`, niveau],
      )
    )[0]!.id;
  const lot = async (coop: string, produitId: string, numero: string, qty: number, per: string) =>
    (
      await ownerQuery<{ id: string }>(
        db,
        `INSERT INTO lot (coop_id, produit_id, numero, date_fabrication, date_peremption, quantite_initiale)
         VALUES ($1, $2, $3, '2026-01-01', $4, $5) RETURNING lot_id AS id`,
        [coop, produitId, numero, per, qty],
      )
    )[0]!.id;
  const huile = await produit(COOP_A, 'HVE-1L', 'lot');
  const bidon = await produit(COOP_A, 'HVE-5L', 'unite');
  const ids = {
    lotHuile: await lot(COOP_A, huile, 'HVE-1L-001', 2, '2027-06-01'),
    lotBidon: await lot(COOP_A, bidon, 'HVE-5L-001', 4, '2027-06-01'),
    lotPerime: await lot(COOP_A, huile, 'HVE-1L-OLD', 10, '2026-11-01'),
    lotB: await lot(COOP_B, await produit(COOP_B, 'B-1', 'lot'), 'B-001', 5, '2027-06-01'),
  };
  await ownerQuery(
    db,
    `INSERT INTO unite (coop_id, lot_id, numero_serie) SELECT $1, $2, g FROM generate_series(1, 4) g`,
    [COOP_A, ids.lotBidon],
  );
  return ids;
}

describe.each([{ rls: false }, { rls: true }])('QR service (rls: $rls)', ({ rls }) => {
  let db: TestDatabase;
  let issuer: TestIssuer;
  let app: NestFastifyApplication;
  let ids: Ids;
  const t: Record<string, string> = {};
  const tokens: Record<string, string[]> = {};

  const api = () => request(app.getHttpServer());
  const as = (who: string) => ({ authorization: `Bearer ${t[who]}` });
  const verify = (token: string, ville?: string) => {
    const req = api().get(`/qr/v1/verify/${token}`).set('user-agent', IPHONE);
    return ville ? req.set('x-agricoop-city', ville) : req;
  };
  /** Issues codes through the service to get the clear tokens (normally only in the PDF). */
  const issue = async (lotId: string): Promise<string[]> => {
    const sheet = await RequestContext.run({ requestId: 'test', coopId: COOP_A }, () =>
      app.get(QrCodesService).generate(lotId, true),
    );
    return sheet.labels.map((l) => l.token);
  };

  beforeAll(async () => {
    process.env.QR_VERIFY_RATE_PER_MIN = '1000';
    [db, issuer] = await Promise.all([startTestDatabase({ rls }), createTestIssuer()]);
    ids = await seed(db);
    app = await createQrTestApp(db, issuer, { clock });
    t.a = await issuer.sign({ roles: ['coop_manager'], tenantId: COOP_A });
    t.b = await issuer.sign({ roles: ['coop_manager'], tenantId: COOP_B });
  });

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  describe('generation', () => {
    it('issues one code per unit and returns a printable PDF', async () => {
      const res = await api()
        .post(`/qr/v1/lots/${ids.lotBidon}/qr-codes`)
        .set(as('a'))
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(201);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toBe('attachment; filename="qr-HVE-5L-001.pdf"');
      const pdf = res.body as Buffer;
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      const rows = await ownerQuery<{
        niveau: string;
        token_hash: string;
        unite_id: string | null;
      }>(
        db,
        `SELECT q.niveau, q.token_hash, q.unite_id FROM qr_code q JOIN unite u USING (unite_id) WHERE u.lot_id = $1`,
        [ids.lotBidon],
      );
      expect(rows).toHaveLength(4);
      for (const r of rows) {
        expect(r.niveau).toBe('unite');
        expect(r.token_hash).toMatch(/^[0-9a-f]{64}$/);
      }
    });

    it('refuses to print twice unless regenerating, which deactivates the old codes', async () => {
      const again = await api()
        .post(`/qr/v1/lots/${ids.lotBidon}/qr-codes`)
        .set(as('a'))
        .expect(409);
      expect(again.body).toMatchObject({ code: 'qr_deja_generes', nb_actifs: 4 });
      await api()
        .post(`/qr/v1/lots/${ids.lotBidon}/qr-codes?regenerer=true`)
        .set(as('a'))
        .expect(201);
      const counts = await ownerQuery<{ statut: string; n: number }>(
        db,
        `SELECT q.statut, count(*)::int AS n FROM qr_code q JOIN unite u USING (unite_id)
          WHERE u.lot_id = $1 GROUP BY q.statut ORDER BY q.statut`,
        [ids.lotBidon],
      );
      expect(counts).toEqual([
        { statut: 'actif', n: 4 },
        { statut: 'desactive', n: 4 },
      ]);
    });

    it("issues a single code for lot-level products and hides other cooperatives' lots", async () => {
      await api().post(`/qr/v1/lots/${ids.lotHuile}/qr-codes`).set(as('a')).expect(201);
      const [row] = await ownerQuery<{ n: number }>(
        db,
        `SELECT count(*)::int AS n FROM qr_code WHERE lot_id = $1 AND niveau = 'lot'`,
        [ids.lotHuile],
      );
      expect(row?.n).toBe(1);
      await api().post(`/qr/v1/lots/${ids.lotB}/qr-codes`).set(as('a')).expect(404);
    });

    it('paginates labels on A4 sheets of 24', async () => {
      const labels = Array.from({ length: 30 }, (_, i) => ({
        token: generateQrToken(),
        numeroSerie: i + 1,
      }));
      const pdf = await renderLabelSheet({
        coopNom: 'Coopérative Zitoun',
        produitNom: "Huile d'olive vierge extra 5 L",
        lotNumero: 'L-1',
        datePeremption: '2027-06-01',
        verifyBaseUrl: 'https://boutique.agricoop.test',
        labels,
      });
      expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
    });
  });

  describe('public verification', () => {
    beforeAll(async () => {
      tokens.bidon = await issue(ids.lotBidon);
      tokens.huile = await issue(ids.lotHuile);
      tokens.perime = await issue(ids.lotPerime);
    });

    it('never stores a token in clear, anywhere', async () => {
      const dump = await ownerQuery<{ t: string }>(
        db,
        `SELECT string_agg(row_to_json(x)::text, '') AS t FROM (
           SELECT * FROM qr_code) x
         UNION ALL SELECT string_agg(row_to_json(o)::text, '') FROM outbox o
         UNION ALL SELECT string_agg(row_to_json(s)::text, '') FROM scan_qr s`,
      );
      const all = dump.map((d) => d.t ?? '').join('');
      for (const token of [...tokens.bidon!, ...tokens.huile!]) {
        expect(all).not.toContain(token);
        expect(all).toContain(hashQrToken(token));
      }
    });

    it('confirms an authentic product and records the scan without the IP', async () => {
      const res = await verify(tokens.bidon![0]!, 'casablanca')
        .set('x-forwarded-for', '203.0.113.7')
        .expect(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toEqual({
        resultat: 'authentique',
        alertes: [],
        statut_qr: 'actif',
        niveau: 'unite',
        produit: { nom: 'Huile HVE-5L', famille: 'alimentaire', categorie: 'huile' },
        cooperative: { code: 'COOPA', nom: 'Coopérative Zitoun', province: 'Ouezzane' },
        lot: {
          numero: 'HVE-5L-001',
          date_fabrication: '2026-01-01',
          date_peremption: '2027-06-01',
        },
        numero_serie: 1,
        nb_scans: 1,
      });
      const scans = await ownerQuery<Record<string, unknown>>(db, 'SELECT * FROM scan_qr');
      expect(scans).toHaveLength(1);
      expect(scans[0]).toMatchObject({ ville: 'Casablanca', appareil: 'iPhone', coop_id: COOP_A });
      expect(JSON.stringify(scans)).not.toContain('203.0.113.7');
    });

    it('emits a valid qr_scanne event', async () => {
      const [row] = await ownerQuery<{
        event_id: string;
        type: EventType;
        coop_id: string;
        created_at: Date;
        payload: Record<string, unknown>;
      }>(db, `SELECT * FROM outbox WHERE type = 'qr_scanne' ORDER BY created_at LIMIT 1`);
      expect(row?.payload).toMatchObject({
        niveau: 'unite',
        ville: 'Casablanca',
        appareil: 'iPhone',
        resultat: 'authentique',
      });
      expect(() =>
        assertValidEvent({
          event_id: row!.event_id,
          type: row!.type,
          version: 1,
          coop_id: row!.coop_id,
          occurred_at: row!.created_at.toISOString(),
          is_synthetic: false,
          payload: row!.payload,
        }),
      ).not.toThrow();
    });

    it('answers 404 qr_inconnu for codes that were never issued', async () => {
      const res = await verify(generateQrToken()).expect(404);
      expect(res.body.code).toBe('qr_inconnu');
      await verify('not-a-token').expect(404);
    });

    it('flags a unit code seen in more than 2 cities within 24 h', async () => {
      const token = tokens.bidon![1]!;
      expect((await verify(token, 'Rabat').expect(200)).body.resultat).toBe('authentique');
      expect((await verify(token, 'Tanger').expect(200)).body.resultat).toBe('authentique');
      const third = await verify(token, 'Agadir').expect(200);
      expect(third.body).toMatchObject({
        resultat: 'alerte',
        alertes: ['villes_multiples'],
        nb_scans: 3,
      });
    });

    it('flags a unit code scanned more than 5 times', async () => {
      const token = tokens.bidon![2]!;
      for (let i = 0; i < 5; i++) await verify(token, 'Fès').expect(200);
      expect((await verify(token, 'Fès').expect(200)).body.alertes).toEqual(['scans_multiples']);
    });

    it('tolerates many cities for a lot-level code, up to twice the lot size', async () => {
      const token = tokens.huile![0]!;
      for (const ville of ['Rabat', 'Fès', 'Tanger']) {
        expect((await verify(token, ville).expect(200)).body.resultat).toBe('authentique');
      }
      expect((await verify(token, 'Agadir').expect(200)).body.alertes).toEqual([]);
      // Lot of 2 units: a 5th scan exceeds 2 × 2.
      expect((await verify(token, 'Oujda').expect(200)).body.alertes).toEqual(['scans_multiples']);
    });

    it('warns about expired lots', async () => {
      expect((await verify(tokens.perime![0]!).expect(200)).body.alertes).toEqual(['lot_perime']);
    });
  });

  describe('back office', () => {
    it('lists codes with scan statistics and current alerts', async () => {
      const page = await api()
        .get(`/qr/v1/qr-codes?lot_id=${ids.lotBidon}&statut=actif`)
        .set(as('a'))
        .expect(200);
      expect(page.body.total).toBe(4);
      const items = page.body.items as {
        numero_serie: number;
        nb_scans: number;
        nb_villes: number;
        alertes: string[];
      }[];
      expect(items.map((i) => [i.numero_serie, i.nb_scans, i.nb_villes, i.alertes])).toEqual([
        [1, 1, 1, []],
        [2, 3, 3, ['villes_multiples']],
        [3, 6, 1, ['scans_multiples']],
        [4, 0, 0, []],
      ]);
    });

    it('deactivates a code; the public page then warns', async () => {
      const page = await api()
        .get(`/qr/v1/qr-codes?lot_id=${ids.lotBidon}&statut=actif`)
        .set(as('a'));
      const qrId = (page.body.items as { qr_id: string }[])[3]!.qr_id;
      const res = await api()
        .patch(`/qr/v1/qr-codes/${qrId}`)
        .set(as('a'))
        .send({ statut: 'signale' })
        .expect(200);
      expect(res.body).toMatchObject({ statut: 'signale', alertes: ['qr_inactif'] });
      expect((await verify(tokens.bidon![3]!).expect(200)).body).toMatchObject({
        resultat: 'alerte',
        statut_qr: 'signale',
        alertes: ['qr_inactif'],
      });
      // Other cooperatives can neither read nor change it.
      await api().get(`/qr/v1/qr-codes/${qrId}`).set(as('b')).expect(404);
      await api()
        .patch(`/qr/v1/qr-codes/${qrId}`)
        .set(as('b'))
        .send({ statut: 'actif' })
        .expect(404);
    });

    it('shows the scan history and scans per city', async () => {
      const page = await api()
        .get(`/qr/v1/qr-codes?lot_id=${ids.lotBidon}&statut=actif`)
        .set(as('a'));
      const qrId = (page.body.items as { qr_id: string }[])[1]!.qr_id;
      const scans = await api().get(`/qr/v1/qr-codes/${qrId}/scans`).set(as('a')).expect(200);
      expect((scans.body as { ville: string }[]).map((s) => s.ville).sort()).toEqual([
        'Agadir',
        'Rabat',
        'Tanger',
      ]);
      const villes = await api().get('/qr/v1/scans/villes?jours=7').set(as('a')).expect(200);
      expect(villes.body).toContainEqual({ ville: 'Fès', nb_scans: 7, nb_qr: 2 });
      expect(villes.body).toContainEqual({ ville: 'Inconnue', nb_scans: 2, nb_qr: 2 });
      expect((await api().get('/qr/v1/scans/villes').set(as('b')).expect(200)).body).toEqual([]);
    });
  });
});

describe('QR verification rate limit', () => {
  let db: TestDatabase;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const [database, issuer] = await Promise.all([startTestDatabase(), createTestIssuer()]);
    db = database;
    process.env.QR_VERIFY_RATE_PER_MIN = '3';
    app = await createQrTestApp(db, issuer, { clock });
  });

  afterAll(async () => {
    process.env.QR_VERIFY_RATE_PER_MIN = '1000';
    await app?.close();
    await db?.stop();
  });

  it('answers 429 once a client exceeds the per-minute budget', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      statuses.push(
        (await request(app.getHttpServer()).get(`/qr/v1/verify/${generateQrToken()}`)).status,
      );
    }
    expect(statuses).toEqual([404, 404, 404, 429]);
  });
});
