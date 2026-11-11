import { Inject, Injectable, Logger } from '@nestjs/common';
import { client, client_pii, type Database, type TenantScope } from '@agricoop/db';
import { AppProblem, type AuthUser, CLOCK, type Clock, DB, today } from '@agricoop/nest-kit';
import type { Coordonnees, TypeClient } from '@agricoop/shared';
import { and, eq, getTableColumns, sql } from 'drizzle-orm';

export type ClientRow = typeof client.$inferSelect;
export type LinkMode = 'client_compte' | 'email';

const emailRequired = () =>
  new AppProblem(
    403,
    'email_non_verifie',
    'Verified e-mail required',
    'Your account needs a verified e-mail address to place orders',
  );

/**
 * Links a storefront account (Keycloak user) to its `client` row in a cooperative.
 * A person has one `client` per cooperative they buy from, created at their first order there.
 *
 * Two modes, detected once at runtime:
 *  - `client_compte` (schema proposal 003 merged): link on (coop_id, Keycloak `sub`);
 *  - `email` (schema.sql as is): link on the token's VERIFIED e-mail = client_pii.email.
 * Personal data (client_pii) never leaves this service except in back-office responses.
 */
@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);
  private mode?: Promise<LinkMode>;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  linkMode(): Promise<LinkMode> {
    this.mode ??= this.db
      .execute<{ present: boolean }>(
        sql`select to_regclass('public.client_compte') is not null as present`,
      )
      .then((res) => {
        const mode: LinkMode = res.rows[0]?.present ? 'client_compte' : 'email';
        this.logger.log(`Storefront account linking mode: ${mode}`);
        return mode;
      });
    return this.mode;
  }

  /** The caller's client in the current tenant, if they ever ordered here. */
  async findForUser(scope: TenantScope, user: AuthUser): Promise<ClientRow | undefined> {
    if ((await this.linkMode()) === 'client_compte') {
      const res = await scope.tx.execute<ClientRow>(sql`
        SELECT c.* FROM client c
        JOIN client_compte cc ON cc.client_id = c.client_id
        WHERE c.coop_id = ${scope.coopId} AND cc.coop_id = ${scope.coopId}
          AND cc.idp_subject = ${user.sub}
        LIMIT 1`);
      return res.rows[0];
    }
    if (!user.email || !user.emailVerified) return undefined;
    const [row] = await scope.tx
      .select(getTableColumns(client))
      .from(client)
      .innerJoin(client_pii, eq(client_pii.client_id, client.client_id))
      .where(and(scope.owns(client), eq(client_pii.email, user.email)))
      .limit(1);
    return row;
  }

  /**
   * Returns the caller's client for an order, creating it (client + client_pii [+ client_compte]) at
   * the first order, and refreshing the delivery details otherwise.
   */
  async upsertForOrder(
    scope: TenantScope,
    user: AuthUser,
    coordonnees: Coordonnees,
    typeClient: TypeClient,
  ): Promise<ClientRow> {
    const mode = await this.linkMode();
    if (mode === 'email' && (!user.email || !user.emailVerified)) throw emailRequired();

    const pii = {
      nom: coordonnees.nom,
      telephone: coordonnees.telephone ?? null,
      adresse: coordonnees.adresse,
      ...(user.email && user.emailVerified ? { email: user.email } : {}),
    };

    const existing = await this.findForUser(scope, user);
    if (existing) {
      const [updated] = await scope.update(
        client,
        { ville: coordonnees.ville },
        eq(client.client_id, existing.client_id),
      );
      await scope.tx
        .update(client_pii)
        .set(pii)
        .where(eq(client_pii.client_id, existing.client_id));
      return updated ?? existing;
    }

    const created = await scope.insert(client, {
      type_client: typeClient,
      ville: coordonnees.ville,
      date_inscription: today(this.clock),
    });
    // client_pii has no coop_id: it is reached only through `client` (and RLS checks that link).
    await scope.tx.insert(client_pii).values({ client_id: created.client_id, ...pii });
    if (mode === 'client_compte') {
      await scope.tx.execute(sql`
        INSERT INTO client_compte (client_id, coop_id, idp_subject)
        VALUES (${created.client_id}, ${scope.coopId}, ${user.sub})`);
    }
    return created;
  }

  /** Back-office only: the personal details of a client of the current tenant. */
  async personalData(
    scope: TenantScope,
    clientId: string,
  ): Promise<typeof client_pii.$inferSelect | undefined> {
    const [row] = await scope.tx
      .select(getTableColumns(client_pii))
      .from(client_pii)
      .innerJoin(client, eq(client.client_id, client_pii.client_id))
      .where(and(scope.owns(client), eq(client_pii.client_id, clientId)))
      .limit(1);
    return row;
  }
}
