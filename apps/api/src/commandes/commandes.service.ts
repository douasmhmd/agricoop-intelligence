import { Inject, Injectable } from '@nestjs/common';
import {
  client,
  commande,
  ligne_commande,
  lockLotsForAllocation,
  lot,
  lotStock,
  mouvement_stock,
  produit,
  type TenantScope,
} from '@agricoop/db';
import {
  AppProblem,
  appendEvent,
  type AuthUser,
  CLOCK,
  type Clock,
  hasRole,
  Problems,
  TenantDb,
  today,
} from '@agricoop/nest-kit';
import {
  aggregateDemande,
  allocateFefo,
  canTransition,
  type Canal,
  type Commande,
  type CommandeCreate,
  type CommandeDetail,
  type CommandeListQuery,
  type CommandePage,
  type CommandeStatut,
  type LigneCommande,
  lineTotal,
  sumMoney,
  toIsoTimestamp,
  type TypeClient,
} from '@agricoop/shared';
import { and, asc, desc, eq, inArray, type SQL, sql } from 'drizzle-orm';
import { ClientsService } from '../clients/clients.service';

export type CommandeRow = typeof commande.$inferSelect;

export interface TransitionResult {
  commande: CommandeRow;
  /** False when the order already had the target status (idempotent no-op). */
  changed: boolean;
}

const transitionInvalide = (de: string, vers: string) =>
  new AppProblem(
    409,
    'transition_invalide',
    'Invalid status transition',
    `An order cannot go from ${de} to ${vers}`,
    { de, vers },
  );

/**
 * Orders. Placing an order is ONE transaction: lock candidate lots (global FEFO order), allocate,
 * insert commande + lignes (with lot_id) + `sortie` movements + outbox events. Status changes lock the
 * order row; cancellation re-locks the lots and writes compensating `entree` movements.
 */
@Injectable()
export class CommandesService {
  constructor(
    @Inject(TenantDb) private readonly tenantDb: TenantDb,
    @Inject(ClientsService) private readonly clients: ClientsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /* ------------------------------------------------------------------------------------------
   * Storefront
   * ---------------------------------------------------------------------------------------- */

  async place(code: string, user: AuthUser, input: CommandeCreate): Promise<Commande> {
    const day = today(this.clock);
    const now = this.clock.now().toISOString();
    // Every account also has `customer`: check reseller first.
    const typeClient: TypeClient = hasRole(user, 'reseller') ? 'revendeur' : 'particulier';
    const canal: Canal = typeClient === 'revendeur' ? 'revendeur' : 'web';

    return this.tenantDb.runForCode(code, async (scope) => {
      const demande = aggregateDemande(input.lignes);
      const ids = [...demande.keys()].sort();
      const produits = await scope.list(produit, { where: inArray(produit.produit_id, ids) });
      if (produits.length !== ids.length) throw Problems.notFound('Produit');
      if (produits.some((p) => !p.actif)) {
        throw Problems.conflict('produit_inactif', 'An ordered product is no longer sold');
      }

      const lots = await lockLotsForAllocation(scope, ids, day);
      const { allocations, manquants } = allocateFefo(lots, demande);
      if (manquants.length > 0) {
        throw new AppProblem(
          409,
          'stock_insuffisant',
          'Insufficient stock',
          'Not enough stock for some products',
          { manquants },
        );
      }

      const acheteur = await this.clients.upsertForOrder(
        scope,
        user,
        input.coordonnees,
        typeClient,
      );
      const cmd = await scope.insert(commande, {
        client_id: acheteur.client_id,
        canal,
        date_commande: now,
        statut: 'creee',
      });

      const produitById = new Map(produits.map((p) => [p.produit_id, p]));
      const lotById = new Map(lots.map((l) => [l.lot_id, l]));
      const lignes: LigneCommande[] = [];
      const sorties: {
        mouvementId: string;
        date: string;
        lotId: string;
        produitId: string;
        quantite: number;
        stockApres: number;
      }[] = [];
      for (const a of allocations) {
        const p = produitById.get(a.produit_id)!;
        const l = lotById.get(a.lot_id)!;
        const ligne = await scope.insert(ligne_commande, {
          commande_id: cmd.commande_id,
          produit_id: a.produit_id,
          lot_id: a.lot_id,
          quantite: a.quantite,
          prix_unitaire_mad: p.prix_mad,
        });
        const mvt = await scope.insert(mouvement_stock, {
          lot_id: a.lot_id,
          type_mouvement: 'sortie',
          quantite: a.quantite,
          date_mouvement: now,
        });
        lignes.push({
          ligne_id: ligne.ligne_id,
          produit_id: p.produit_id,
          produit_code: p.code,
          produit_nom: p.nom,
          lot_id: l.lot_id,
          lot_numero: l.numero,
          quantite: a.quantite,
          prix_unitaire_mad: ligne.prix_unitaire_mad,
          montant_mad: lineTotal(ligne.prix_unitaire_mad, a.quantite),
        });
        l.stock -= a.quantite; // running stock of the locked lot
        sorties.push({
          mouvementId: mvt.mouvement_id,
          date: toIsoTimestamp(mvt.date_mouvement),
          lotId: l.lot_id,
          produitId: p.produit_id,
          quantite: a.quantite,
          stockApres: l.stock,
        });
      }
      const montant = sumMoney(lignes.map((l) => l.montant_mad));
      const evtLignes = lignes.map((l) => ({
        ligne_id: l.ligne_id,
        produit_id: l.produit_id,
        lot_id: l.lot_id!,
        quantite: l.quantite,
        prix_unitaire_mad: l.prix_unitaire_mad,
        montant_mad: l.montant_mad,
      }));
      // An order always has at least one line (allocations of a non-empty demand).
      const [premiere, ...autres] = evtLignes;
      if (!premiere) throw new Error('Order without lines');

      await appendEvent(scope, 'commande_creee', {
        commande_id: cmd.commande_id,
        client_id: acheteur.client_id,
        type_client: typeClient,
        ville: acheteur.ville,
        canal,
        date_commande: toIsoTimestamp(cmd.date_commande),
        statut: 'creee',
        montant_total_mad: montant,
        lignes: [premiere, ...autres],
      });
      for (const s of sorties) {
        await appendEvent(scope, 'stock_modifie', {
          mouvement_id: s.mouvementId,
          lot_id: s.lotId,
          produit_id: s.produitId,
          type_mouvement: 'sortie',
          quantite: s.quantite,
          stock_apres: s.stockApres,
          motif: 'commande',
          commande_id: cmd.commande_id,
          date_mouvement: s.date,
        });
      }

      return this.toCommande(cmd, lignes);
    });
  }

  /** The caller's orders in a cooperative, newest first. */
  async listMine(code: string, user: AuthUser): Promise<Commande[]> {
    return this.tenantDb.runForCode(code, async (scope) => {
      const acheteur = await this.clients.findForUser(scope, user);
      if (!acheteur) return [];
      const rows = await scope.list(commande, {
        where: eq(commande.client_id, acheteur.client_id),
        orderBy: [desc(commande.date_commande)],
        limit: 50,
      });
      const lignes = await this.loadLignes(
        scope,
        rows.map((r) => r.commande_id),
      );
      return rows.map((r) => this.toCommande(r, lignes.get(r.commande_id) ?? []));
    });
  }

  async getMine(code: string, user: AuthUser, commandeId: string): Promise<Commande> {
    return this.tenantDb.runForCode(code, async (scope) => {
      const cmd = await this.findMine(scope, user, commandeId);
      return this.toCommande(
        cmd,
        (await this.loadLignes(scope, [cmd.commande_id])).get(cmd.commande_id) ?? [],
      );
    });
  }

  /** Customer cancellation (from creee or payee; payee is refunded by the payment provider). */
  async cancelMine(code: string, user: AuthUser, commandeId: string): Promise<Commande> {
    return this.tenantDb.runForCode(code, async (scope) => {
      await this.findMine(scope, user, commandeId);
      const { commande: cmd } = await this.transition(scope, commandeId, 'annulee');
      return this.toCommande(
        cmd,
        (await this.loadLignes(scope, [commandeId])).get(commandeId) ?? [],
      );
    });
  }

  /* ------------------------------------------------------------------------------------------
   * Back office
   * ---------------------------------------------------------------------------------------- */

  async list(query: CommandeListQuery): Promise<CommandePage> {
    return this.tenantDb.run(async (scope) => {
      const where: SQL | undefined = and(
        scope.owns(commande),
        query.statut ? eq(commande.statut, query.statut) : undefined,
        query.canal ? eq(commande.canal, query.canal) : undefined,
        query.synthetic === 'exclude' ? eq(commande.is_synthetic, false) : undefined,
      );
      const rows = await scope.tx
        .select({
          commande_id: commande.commande_id,
          client_id: commande.client_id,
          canal: commande.canal,
          date_commande: commande.date_commande,
          statut: commande.statut,
          is_synthetic: commande.is_synthetic,
          ville: client.ville,
          type_client: client.type_client,
          montant: sql<string>`(coalesce(sum(${ligne_commande.quantite} * ${ligne_commande.prix_unitaire_mad}), 0))::numeric(12,2)::text`,
          nb_lignes: sql<number>`count(${ligne_commande.ligne_id})::int`,
          total: sql<number>`(count(*) over ())::int`,
        })
        .from(commande)
        .innerJoin(client, and(eq(client.client_id, commande.client_id), scope.owns(client)))
        .leftJoin(
          ligne_commande,
          and(eq(ligne_commande.commande_id, commande.commande_id), scope.owns(ligne_commande)),
        )
        .where(where)
        .groupBy(commande.commande_id, client.client_id)
        .orderBy(desc(commande.date_commande), asc(commande.commande_id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return {
        items: rows.map((r) => ({
          commande_id: r.commande_id,
          client_id: r.client_id,
          canal: r.canal as Canal,
          date_commande: toIsoTimestamp(r.date_commande),
          statut: r.statut as CommandeStatut,
          montant_total_mad: r.montant,
          nb_lignes: r.nb_lignes,
          ville: r.ville,
          type_client: r.type_client as TypeClient,
          is_synthetic: r.is_synthetic,
        })),
        total: rows[0]?.total ?? 0,
        page: query.page,
        pageSize: query.pageSize,
      };
    });
  }

  /** Order with its lines and the customer's details (operational plane only). */
  async get(commandeId: string): Promise<CommandeDetail> {
    return this.tenantDb.run(async (scope) => this.detail(scope, commandeId));
  }

  async changeStatut(
    commandeId: string,
    statut: Exclude<CommandeStatut, 'creee'>,
  ): Promise<CommandeDetail> {
    return this.tenantDb.run(async (scope) => {
      await this.transition(scope, commandeId, statut, { idempotent: false });
      return this.detail(scope, commandeId);
    });
  }

  /* ------------------------------------------------------------------------------------------
   * Status machine
   * ---------------------------------------------------------------------------------------- */

  /**
   * Moves an order to `to` inside the caller's transaction: row lock on the order, transition check,
   * compensating stock entries on cancellation, outbox events. With `idempotent` (default), asking for
   * the current status is a no-op (payment callbacks may be replayed).
   */
  async transition(
    scope: TenantScope,
    commandeId: string,
    to: CommandeStatut,
    options: { idempotent?: boolean } = {},
  ): Promise<TransitionResult> {
    const [cmd] = await scope.list(commande, {
      where: eq(commande.commande_id, commandeId),
      forUpdate: true,
    });
    if (!cmd) throw Problems.notFound('Commande');
    const from = cmd.statut as CommandeStatut;
    if (from === to && (options.idempotent ?? true)) return { commande: cmd, changed: false };
    if (!canTransition(from, to)) throw transitionInvalide(from, to);

    const now = this.clock.now().toISOString();
    const lignes = await scope.list(ligne_commande, {
      where: eq(ligne_commande.commande_id, commandeId),
    });

    if (to === 'annulee') await this.restock(scope, cmd, lignes, now);

    const [updated] = await scope.update(
      commande,
      { statut: to },
      eq(commande.commande_id, commandeId),
    );
    await appendEvent(scope, 'commande_statut_modifie', {
      commande_id: commandeId,
      client_id: cmd.client_id,
      ancien_statut: from,
      nouveau_statut: to,
      date_changement: now,
      montant_total_mad: sumMoney(lignes.map((l) => lineTotal(l.prix_unitaire_mad, l.quantite))),
    });
    return { commande: updated ?? cmd, changed: true };
  }

  /** Compensating `entree` movements for a cancelled order. Locks lots in the global FEFO order. */
  private async restock(
    scope: TenantScope,
    cmd: CommandeRow,
    lignes: (typeof ligne_commande.$inferSelect)[],
    now: string,
  ): Promise<void> {
    const withLot = lignes.filter((l): l is typeof l & { lot_id: string } => l.lot_id !== null);
    if (withLot.length === 0) return;
    const lots = await scope.list(lot, {
      where: inArray(lot.lot_id, [...new Set(withLot.map((l) => l.lot_id))]),
      orderBy: [asc(lot.date_peremption), asc(lot.lot_id)],
      forUpdate: true,
    });
    const stock = new Map<string, number>();
    for (const l of lots) stock.set(l.lot_id, await lotStock(scope, l.lot_id));
    for (const ligne of withLot) {
      const mvt = await scope.insert(mouvement_stock, {
        lot_id: ligne.lot_id,
        type_mouvement: 'entree',
        quantite: ligne.quantite,
        date_mouvement: now,
      });
      const after = (stock.get(ligne.lot_id) ?? 0) + ligne.quantite;
      stock.set(ligne.lot_id, after);
      await appendEvent(scope, 'stock_modifie', {
        mouvement_id: mvt.mouvement_id,
        lot_id: ligne.lot_id,
        produit_id: ligne.produit_id,
        type_mouvement: 'entree',
        quantite: ligne.quantite,
        stock_apres: after,
        motif: 'annulation_commande',
        commande_id: cmd.commande_id,
        date_mouvement: toIsoTimestamp(mvt.date_mouvement),
      });
    }
  }

  /* ------------------------------------------------------------------------------------------
   * Helpers
   * ---------------------------------------------------------------------------------------- */

  async montant(scope: TenantScope, commandeId: string): Promise<string> {
    const lignes = await scope.list(ligne_commande, {
      where: eq(ligne_commande.commande_id, commandeId),
    });
    return sumMoney(lignes.map((l) => lineTotal(l.prix_unitaire_mad, l.quantite)));
  }

  private async findMine(
    scope: TenantScope,
    user: AuthUser,
    commandeId: string,
  ): Promise<CommandeRow> {
    const acheteur = await this.clients.findForUser(scope, user);
    const cmd = acheteur
      ? await scope.findOne(
          commande,
          and(eq(commande.commande_id, commandeId), eq(commande.client_id, acheteur.client_id))!,
        )
      : undefined;
    // Someone else's order is indistinguishable from a missing one.
    if (!cmd) throw Problems.notFound('Commande');
    return cmd;
  }

  private async detail(scope: TenantScope, commandeId: string): Promise<CommandeDetail> {
    const cmd = await scope.findOne(commande, eq(commande.commande_id, commandeId));
    if (!cmd) throw Problems.notFound('Commande');
    const [acheteur, pii, lignes] = await Promise.all([
      scope.findOne(client, eq(client.client_id, cmd.client_id)),
      this.clients.personalData(scope, cmd.client_id),
      this.loadLignes(scope, [commandeId]),
    ]);
    return {
      ...this.toCommande(cmd, lignes.get(commandeId) ?? []),
      client: {
        type_client: (acheteur?.type_client ?? 'particulier') as TypeClient,
        ville: acheteur?.ville ?? '',
        nom: pii?.nom ?? null,
        telephone: pii?.telephone ?? null,
        email: pii?.email ?? null,
        adresse: pii?.adresse ?? null,
      },
    };
  }

  private async loadLignes(
    scope: TenantScope,
    commandeIds: string[],
  ): Promise<Map<string, LigneCommande[]>> {
    const result = new Map<string, LigneCommande[]>();
    if (commandeIds.length === 0) return result;
    const rows = await scope.tx
      .select({
        commande_id: ligne_commande.commande_id,
        ligne_id: ligne_commande.ligne_id,
        produit_id: ligne_commande.produit_id,
        produit_code: produit.code,
        produit_nom: produit.nom,
        lot_id: ligne_commande.lot_id,
        lot_numero: lot.numero,
        quantite: ligne_commande.quantite,
        prix_unitaire_mad: ligne_commande.prix_unitaire_mad,
      })
      .from(ligne_commande)
      .innerJoin(
        produit,
        and(eq(produit.produit_id, ligne_commande.produit_id), scope.owns(produit)),
      )
      .leftJoin(lot, and(eq(lot.lot_id, ligne_commande.lot_id), scope.owns(lot)))
      .where(and(scope.owns(ligne_commande), inArray(ligne_commande.commande_id, commandeIds)))
      .orderBy(asc(produit.code), asc(lot.date_peremption));
    for (const r of rows) {
      const list = result.get(r.commande_id) ?? [];
      list.push({
        ligne_id: r.ligne_id,
        produit_id: r.produit_id,
        produit_code: r.produit_code,
        produit_nom: r.produit_nom,
        lot_id: r.lot_id,
        lot_numero: r.lot_numero,
        quantite: r.quantite,
        prix_unitaire_mad: r.prix_unitaire_mad,
        montant_mad: lineTotal(r.prix_unitaire_mad, r.quantite),
      });
      result.set(r.commande_id, list);
    }
    return result;
  }

  private toCommande(cmd: CommandeRow, lignes: LigneCommande[]): Commande {
    return {
      commande_id: cmd.commande_id,
      client_id: cmd.client_id,
      canal: cmd.canal as Canal,
      date_commande: toIsoTimestamp(cmd.date_commande),
      statut: cmd.statut as CommandeStatut,
      montant_total_mad: sumMoney(lignes.map((l) => l.montant_mad)),
      lignes,
      is_synthetic: cmd.is_synthetic,
    };
  }
}
