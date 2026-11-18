/*
 * Power BI Embedded: demo mode without settings; in live mode (fake Power BI REST layer) the embed
 * token's effective identity is always the caller's cooperative, whatever the request says.
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
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { apiEnv } from '../src/env';
import { parseEnv } from '@agricoop/nest-kit';
import { powerBiConfig } from '../src/powerbi/config';
import {
  type GenerateTokenRequest,
  POWERBI_API,
  type PowerBiApi,
  PowerBiApiError,
} from '../src/powerbi/powerbi.client';
import { createTestApp } from './support/test-app';

const COOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COOP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REPORT = '11111111-1111-4111-8111-111111111111';
const DATASET = '22222222-2222-4222-8222-222222222222';
const WORKSPACE = '33333333-3333-4333-8333-333333333333';

const LIVE_ENV = {
  POWERBI_TENANT_ID: '44444444-4444-4444-8444-444444444444',
  POWERBI_CLIENT_ID: '55555555-5555-4555-8555-555555555555',
  POWERBI_CLIENT_SECRET: 'test-secret-not-used',
  POWERBI_WORKSPACE_ID: WORKSPACE,
  POWERBI_REPORTS: JSON.stringify({
    ventes: { reportId: REPORT, page: 'page-overview' },
    stocks: { reportId: REPORT, page: 'page-stocks', title: 'Stocks et couverture' },
    complet: REPORT,
  }),
};

/** Records every GenerateToken request; can be told to fail. */
class FakePowerBi implements PowerBiApi {
  tokenRequests: GenerateTokenRequest[] = [];
  fail = false;
  getReport(workspaceId: string, reportId: string) {
    expect(workspaceId).toBe(WORKSPACE);
    return Promise.resolve({
      id: reportId,
      name: 'AgriCoop Dashboard',
      embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${reportId}`,
      datasetId: DATASET,
    });
  }
  getPages() {
    return Promise.resolve([
      { name: 'page-overview', displayName: "Vue d'ensemble" },
      { name: 'page-stocks', displayName: 'Stocks' },
    ]);
  }
  getLastRefresh() {
    return Promise.resolve('2026-11-17T06:00:00Z');
  }
  generateToken(req: GenerateTokenRequest) {
    if (this.fail) return Promise.reject(new PowerBiApiError(401, 'Power BI POST → 401'));
    this.tokenRequests.push(req);
    return Promise.resolve({ token: 'embed-token-for-test', expiration: '2026-11-18T12:00:00Z' });
  }
}

describe('power bi embedding', () => {
  let db: TestDatabase;
  let issuer: TestIssuer;
  let demoApp: NestFastifyApplication;
  let liveApp: NestFastifyApplication;
  const fake = new FakePowerBi();
  const t: Record<string, string> = {};
  const as = (who: string, headers: Record<string, string> = {}) => ({
    authorization: `Bearer ${t[who]}`,
    ...headers,
  });

  beforeAll(async () => {
    [db, issuer] = await Promise.all([startTestDatabase({ rls: false }), createTestIssuer()]);
    await ownerQuery(
      db,
      `INSERT INTO cooperative (coop_id, code, nom, province) VALUES
         ($1, 'COOPA', 'A', 'Ouezzane'), ($2, 'COOPB', 'B', 'Taounate')`,
      [COOP_A, COOP_B],
    );
    demoApp = await createTestApp(db, issuer);
    liveApp = await createTestApp(db, issuer, {
      env: LIVE_ENV,
      providers: [{ token: POWERBI_API, value: fake }],
    });
    t.a = await issuer.sign({ roles: ['coop_manager'], tenantId: COOP_A });
    t.admin = await issuer.sign({ roles: ['saas_admin'] });
    t.customer = await issuer.sign({ roles: ['customer'], tenantId: COOP_A });
    t.reseller = await issuer.sign({ roles: ['reseller', 'customer'], tenantId: COOP_A });
  }, 120_000);

  afterAll(async () => {
    await demoApp?.close();
    await liveApp?.close();
    await db?.stop();
  });

  beforeEach(() => {
    fake.tokenRequests = [];
    fake.fail = false;
  });

  const live = () => request(liveApp.getHttpServer());
  const embedPath = (key: string) => `/api/v1/analytics/powerbi/embed/${key}`;

  describe('demo mode (no POWERBI_* settings)', () => {
    it('answers demo and names the missing settings', async () => {
      const reports = await request(demoApp.getHttpServer())
        .get('/api/v1/analytics/powerbi/reports')
        .set(as('a'));
      expect(reports.status).toBe(200);
      expect(reports.body).toEqual({
        mode: 'demo',
        reports: [],
        missing: [
          'POWERBI_TENANT_ID',
          'POWERBI_CLIENT_ID',
          'POWERBI_CLIENT_SECRET',
          'POWERBI_WORKSPACE_ID',
          'POWERBI_REPORTS',
        ],
      });
      const embed = await request(demoApp.getHttpServer()).get(embedPath('ventes')).set(as('a'));
      expect(embed.status).toBe(200);
      expect(embed.body).toMatchObject({ mode: 'demo', embed: null });
    });

    it('treats blank settings (compose without Power BI) as demo mode', () => {
      const env = parseEnv(apiEnv, {
        DATABASE_URL: 'postgres://x',
        OIDC_ISSUER: 'http://issuer',
        OIDC_AUDIENCE: 'aud',
        POWERBI_TENANT_ID: '',
        POWERBI_CLIENT_ID: '',
        POWERBI_CLIENT_SECRET: '',
        POWERBI_WORKSPACE_ID: '',
        POWERBI_REPORTS: '',
      });
      expect(powerBiConfig(env)).toBeUndefined();
    });

    it('refuses a partial configuration at startup', () => {
      expect(() =>
        parseEnv(apiEnv, {
          DATABASE_URL: 'postgres://x',
          OIDC_ISSUER: 'http://issuer',
          OIDC_AUDIENCE: 'aud',
          POWERBI_TENANT_ID: LIVE_ENV.POWERBI_TENANT_ID,
        }),
      ).toThrow(/POWERBI/);
    });
  });

  describe('live mode', () => {
    it('lists the reports with page titles and last refresh', async () => {
      const res = await live().get('/api/v1/analytics/powerbi/reports').set(as('a'));
      expect(res.status).toBe(200);
      expect(res.body.mode).toBe('live');
      expect(res.body.reports).toEqual([
        {
          key: 'ventes',
          title: "Vue d'ensemble",
          pageName: 'page-overview',
          lastRefresh: '2026-11-17T06:00:00Z',
        },
        {
          key: 'stocks',
          title: 'Stocks et couverture',
          pageName: 'page-stocks',
          lastRefresh: '2026-11-17T06:00:00Z',
        },
        {
          key: 'complet',
          title: 'AgriCoop Dashboard',
          pageName: null,
          lastRefresh: '2026-11-17T06:00:00Z',
        },
      ]);
    });

    it("binds the token's effective identity to the caller's cooperative", async () => {
      const res = await live().get(embedPath('ventes')).set(as('a'));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        mode: 'live',
        embed: {
          reportKey: 'ventes',
          reportId: REPORT,
          pageName: 'page-overview',
          embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${REPORT}`,
          embedToken: 'embed-token-for-test',
          expiresAt: '2026-11-18T12:00:00.000Z',
          rls: 'Cooperative',
        },
        missing: [],
      });
      expect(fake.tokenRequests).toEqual([
        {
          datasets: [{ id: DATASET, xmlaPermissions: 'Off' }],
          reports: [{ id: REPORT, allowEdit: false }],
          targetWorkspaces: [],
          identities: [{ username: COOP_A, roles: ['Cooperative'], datasets: [DATASET] }],
          lifetimeInMinutes: 60,
        },
      ]);
    });

    it('offers no way to request another tenant', async () => {
      // Query parameters and a body are ignored…
      const injected = await live()
        .get(`${embedPath('ventes')}?username=${COOP_B}&coop_id=${COOP_B}&roles=Admin`)
        .set(as('a'));
      expect(injected.status).toBe(200);
      expect(fake.tokenRequests.at(-1)?.identities).toEqual([
        { username: COOP_A, roles: ['Cooperative'], datasets: [DATASET] },
      ]);
      // …and a manager's X-Coop-Id for another cooperative is refused before Power BI is called.
      const before = fake.tokenRequests.length;
      const header = await live()
        .get(embedPath('ventes'))
        .set(as('a', { 'x-coop-id': COOP_B }));
      expect(header.status).toBe(403);
      expect(header.body.code).toBe('tenant_mismatch');
      expect(fake.tokenRequests).toHaveLength(before);
    });

    it('gives a saas_admin the selected cooperative, or the Admin role without one', async () => {
      const scoped = await live()
        .get(embedPath('stocks'))
        .set(as('admin', { 'x-coop-id': COOP_B }));
      expect(scoped.status).toBe(200);
      expect(scoped.body.embed.rls).toBe('Cooperative');
      expect(fake.tokenRequests.at(-1)?.identities[0]).toMatchObject({
        username: COOP_B,
        roles: ['Cooperative'],
      });

      const all = await live().get(embedPath('stocks')).set(as('admin'));
      expect(all.status).toBe(200);
      expect(all.body.embed.rls).toBe('Admin');
      const identity = fake.tokenRequests.at(-1)?.identities[0];
      expect(identity?.roles).toEqual(['Admin']);
      expect([COOP_A, COOP_B]).not.toContain(identity?.username);
    });

    it('only lets coop managers and the platform admin in', async () => {
      for (const who of ['customer', 'reseller']) {
        const res = await live().get(embedPath('ventes')).set(as(who));
        expect(res.status, who).toBe(403);
      }
      expect((await live().get(embedPath('ventes'))).status).toBe(401);
      expect(
        (await live().get('/api/v1/analytics/powerbi/reports').set(as('customer'))).status,
      ).toBe(403);
      expect(fake.tokenRequests).toHaveLength(0);
    });

    it('rejects unknown and malformed report keys', async () => {
      const unknown = await live().get(embedPath('inconnu')).set(as('a'));
      expect(unknown.status).toBe(404);
      expect(unknown.body.code).toBe('rapport_powerbi_inconnu');
      // Inherited object keys are not report keys.
      expect((await live().get(embedPath('constructor')).set(as('a'))).status).toBe(404);
      expect((await live().get(embedPath('Not%20A%20Key')).set(as('a'))).status).toBe(400);
    });

    it('maps a Power BI failure to 502 without leaking details', async () => {
      fake.fail = true;
      const res = await live().get(embedPath('ventes')).set(as('a'));
      expect(res.status).toBe(502);
      expect(res.body.code).toBe('powerbi_indisponible');
      expect(JSON.stringify(res.body)).not.toContain('401');
    });

    it('rate-limits embed token requests', async () => {
      let limited = false;
      for (let i = 0; i < 40 && !limited; i++) {
        limited = (await live().get(embedPath('complet')).set(as('a'))).status === 429;
      }
      expect(limited).toBe(true);
    });
  });
});
