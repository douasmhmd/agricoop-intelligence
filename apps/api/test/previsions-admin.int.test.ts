/*
 * Forecasts vs sales, and platform administration (cooperatives + identity provisioning).
 */
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
import { IDENTITY_ADMIN, InMemoryIdentityAdmin } from '../src/admin/identity-admin';
import { createTestApp } from './support/test-app';

const COOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COOP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
// June 2026 on purpose: before 2026-09-20 every tz data version agrees Morocco is UTC+1 (it moved to
// permanent UTC+0 on that date, tzdb 2026c), so the week-boundary case below is version-independent.
const clock = { now: () => new Date('2026-06-10T12:00:00Z') }; // Wednesday; week of 2026-06-08

describe.each([{ rls: false }, { rls: true }])('previsions & admin (rls: $rls)', ({ rls }) => {
  let db: TestDatabase;
  let issuer: TestIssuer;
  let app: NestFastifyApplication;
  const identity = new InMemoryIdentityAdmin();
  const t: Record<string, string> = {};
  const api = () => request(app.getHttpServer());
  const as = (who: string) => ({ authorization: `Bearer ${t[who]}` });

  beforeAll(async () => {
    [db, issuer] = await Promise.all([startTestDatabase({ rls }), createTestIssuer()]);
    await ownerQuery(
      db,
      `INSERT INTO cooperative (coop_id, code, nom, province) VALUES
         ($1, 'COOPA', 'A', 'Ouezzane'), ($2, 'COOPB', 'B', 'Taounate')`,
      [COOP_A, COOP_B],
    );
    // Forecasts: two model versions for A, one row for B.
    await ownerQuery(
      db,
      `INSERT INTO prevision (coop_id, famille, semaine, quantite_prevue, version_modele, date_calcul) VALUES
         ($1, 'alimentaire', '2026-06-01', 10, 'v1', '2026-05-01'),
         ($1, 'alimentaire', '2026-06-01', 12.5, 'v2', '2026-05-20'),
         ($1, 'alimentaire', '2026-06-08', 14, 'v2', '2026-05-20'),
         ($1, 'cosmetique', '2026-06-15', 3, 'v2', '2026-05-20'),
         ($2, 'alimentaire', '2026-06-01', 99, 'vB', '2026-05-25')`,
      [COOP_A, COOP_B],
    );
    // Sales of A: week of 11-02 (Sunday 23:30 UTC = Monday 00:30 in Casablanca → week of 11-09),
    // one cancelled order (ignored) and one synthetic order.
    const [p] = await ownerQuery<{ id: string }>(
      db,
      `INSERT INTO produit (coop_id, code, nom, famille, categorie, prix_mad, cout_mad, conservation_j, niveau_qr)
       VALUES ($1, 'P', 'P', 'alimentaire', 'huile', 10, 5, 100, 'lot') RETURNING produit_id AS id`,
      [COOP_A],
    );
    const [c] = await ownerQuery<{ id: string }>(
      db,
      `INSERT INTO client (coop_id, type_client, ville, date_inscription) VALUES ($1, 'particulier', 'Rabat', '2026-01-01') RETURNING client_id AS id`,
      [COOP_A],
    );
    const sale = async (date: string, qty: number, statut = 'livree', synthetic = false) => {
      const [o] = await ownerQuery<{ id: string }>(
        db,
        `INSERT INTO commande (coop_id, client_id, canal, date_commande, statut, is_synthetic)
         VALUES ($1, $2, 'web', $3, $4, $5) RETURNING commande_id AS id`,
        [COOP_A, c!.id, date, statut, synthetic],
      );
      await ownerQuery(
        db,
        `INSERT INTO ligne_commande (coop_id, commande_id, produit_id, quantite, prix_unitaire_mad, is_synthetic)
         VALUES ($1, $2, $3, $4, 10, $5)`,
        [COOP_A, o!.id, p!.id, qty, synthetic],
      );
    };
    await sale('2026-06-02T10:00:00Z', 4);
    await sale('2026-06-07T23:30:00Z', 2); // Sunday 23:30 UTC = Monday 00:30 in Casablanca
    await sale('2026-06-03T10:00:00Z', 50, 'annulee');
    await sale('2026-06-09T10:00:00Z', 7, 'livree', true);

    app = await createTestApp(db, issuer, {
      clock,
      providers: [{ token: IDENTITY_ADMIN, value: identity }],
    });
    t.a = await issuer.sign({ roles: ['coop_manager'], tenantId: COOP_A });
    t.b = await issuer.sign({ roles: ['coop_manager'], tenantId: COOP_B });
    t.admin = await issuer.sign({ roles: ['saas_admin'] });
  });

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  describe('previsions', () => {
    it('lists model versions, newest first, per tenant', async () => {
      const a = await api().get('/api/v1/previsions/versions').set(as('a')).expect(200);
      expect((a.body as { version_modele: string }[]).map((v) => v.version_modele)).toEqual([
        'v2',
        'v1',
      ]);
      const b = await api().get('/api/v1/previsions/versions').set(as('b')).expect(200);
      expect((b.body as { version_modele: string }[]).map((v) => v.version_modele)).toEqual(['vB']);
    });

    it('aligns forecasts with weekly sales (Morocco weeks, no cancelled orders)', async () => {
      const res = await api()
        .get('/api/v1/previsions?depuis=2026-06-01&jusqua=2026-06-15')
        .set(as('a'))
        .expect(200);
      expect(res.body.version_modele).toBe('v2');
      expect(res.body.series).toEqual([
        {
          famille: 'alimentaire',
          points: [
            { semaine: '2026-06-01', quantite_prevue: '12.50', quantite_vendue: 4 },
            { semaine: '2026-06-08', quantite_prevue: '14.00', quantite_vendue: 9 },
            { semaine: '2026-06-15', quantite_prevue: null, quantite_vendue: 0 },
          ],
        },
        {
          famille: 'cosmetique',
          points: [
            { semaine: '2026-06-01', quantite_prevue: null, quantite_vendue: 0 },
            { semaine: '2026-06-08', quantite_prevue: null, quantite_vendue: 0 },
            { semaine: '2026-06-15', quantite_prevue: '3.00', quantite_vendue: 0 },
          ],
        },
      ]);
    });

    it('selects a model version and hides synthetic sales on request', async () => {
      const res = await api()
        .get(
          '/api/v1/previsions?depuis=2026-06-01&jusqua=2026-06-08&version_modele=v1&synthetic=exclude',
        )
        .set(as('a'))
        .expect(200);
      expect(res.body.series[0].points).toEqual([
        { semaine: '2026-06-01', quantite_prevue: '10.00', quantite_vendue: 4 },
        { semaine: '2026-06-08', quantite_prevue: null, quantite_vendue: 2 },
      ]);
    });
  });

  describe('platform admin', () => {
    const create = (code: string, email: string) =>
      api()
        .post('/api/v1/admin/cooperatives')
        .set(as('admin'))
        .send({
          code,
          nom: `Coopérative ${code}`,
          province: 'Meknès',
          gestionnaire: { email, prenom: 'Sara', nom: 'Idrissi' },
        });
    const coopCount = async (code: string) =>
      (
        await ownerQuery<{ n: number }>(
          db,
          'SELECT count(*)::int AS n FROM cooperative WHERE code = $1',
          [code],
        )
      )[0]!.n;

    it('is reserved to saas_admin', async () => {
      await api().get('/api/v1/admin/cooperatives').set(as('a')).expect(403);
      const res = await api().get('/api/v1/admin/cooperatives').set(as('admin')).expect(200);
      expect((res.body as { code: string }[]).map((c) => c.code)).toEqual(['COOPA', 'COOPB']);
    });

    it('creates the tenant and provisions its group and manager with the same coop_id', async () => {
      const res = await create('COOPC', 'sara@coopc.ma').expect(201);
      expect(res.body).toMatchObject({ code: 'COOPC', province: 'Meknès', is_synthetic: false });
      expect(identity.cooperatives.get('COOPC')).toMatchObject({
        coopId: res.body.coop_id,
        manager: { email: 'sara@coopc.ma', firstName: 'Sara' },
      });
      // The new tenant is immediately usable by its manager.
      const manager = await issuer.sign({
        roles: ['coop_manager'],
        tenantId: res.body.coop_id as string,
      });
      await api()
        .get('/api/v1/produits')
        .set({ authorization: `Bearer ${manager}` })
        .expect(200);
    });

    it('rejects duplicates and rolls back when the identity provider fails', async () => {
      expect((await create('COOPC', 'other@coopc.ma').expect(409)).body.code).toBe(
        'coop_code_existe',
      );
      expect((await create('COOPD', 'sara@coopc.ma').expect(409)).body.code).toBe(
        'gestionnaire_existe',
      );
      expect(await coopCount('COOPD')).toBe(0);
      identity.failNext = true;
      expect((await create('COOPE', 'e@coope.ma').expect(502)).body.code).toBe('idp_indisponible');
      expect(await coopCount('COOPE')).toBe(0);
    });
  });
});
