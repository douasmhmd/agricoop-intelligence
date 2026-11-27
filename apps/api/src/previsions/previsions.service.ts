import { Inject, Injectable } from '@nestjs/common';
import { commande, ligne_commande, prevision, produit, previsionProduit } from '@agricoop/db';
import { CLOCK, type Clock, TenantDb, today } from '@agricoop/nest-kit';
import {
  addDays,
  isoDateInZone,
  mondayOf,
  type Previsions,
  type PrevisionsQuery,
  toIsoTimestamp,
  type VersionModele,
  weeksBetween,
  type PrevisionProduit,
  type PrevisionsProduitsQuery,
} from '@agricoop/shared';
import { and, desc, eq, gte, lte, ne, sql } from 'drizzle-orm';

/**
 * Read side of the analytics write-back: forecasts per famille and week (table `prevision`, filled
 * by the data plane) next to actual weekly sales computed from ligne_commande.
 */
@Injectable()
export class PrevisionsService {
  constructor(
    @Inject(TenantDb) private readonly tenantDb: TenantDb,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  versions(): Promise<VersionModele[]> {
    return this.tenantDb.run(async (scope) => {
      const rows = await scope.tx
        .select({
          version_modele: prevision.version_modele,
          date_calcul: sql<string>`max(${prevision.date_calcul})`,
        })
        .from(prevision)
        .where(scope.owns(prevision))
        .groupBy(prevision.version_modele)
        .orderBy(desc(sql`max(${prevision.date_calcul})`), desc(prevision.version_modele));
      return rows.map((r) => ({
        version_modele: r.version_modele,
        date_calcul: toIsoTimestamp(r.date_calcul),
      }));
    });
  }

  async series(query: PrevisionsQuery): Promise<Previsions> {
    const day = today(this.clock);
    const depuis = mondayOf(query.depuis ?? addDays(day, -26 * 7));
    const jusqua = mondayOf(query.jusqua ?? addDays(day, 12 * 7));
    const semaines = weeksBetween(depuis, jusqua);

    return this.tenantDb.run(async (scope) => {
      const version = query.version_modele ?? (await this.versions())[0]?.version_modele ?? null;

      const prevues = version
        ? await scope.tx
            .select({
              famille: prevision.famille,
              semaine: prevision.semaine,
              quantite: prevision.quantite_prevue,
            })
            .from(prevision)
            .where(
              and(
                scope.owns(prevision),
                eq(prevision.version_modele, version),
                gte(prevision.semaine, depuis),
                lte(prevision.semaine, jusqua),
              ),
            )
        : [];

      // Week bucketing happens in the application, not in SQL: the Postgres image ships tzdata that
      // disagrees with current Moroccan time (UTC+1 outside Ramadan), while Node's ICU is up to date.
      // SQL sums per UTC hour; each hour is then mapped to its Monday in Africa/Casablanca.
      const heure = sql<string>`date_trunc('hour', ${commande.date_commande})`;
      const ventesParHeure = await scope.tx
        .select({
          famille: produit.famille,
          heure,
          quantite: sql<number>`sum(${ligne_commande.quantite})::int`,
        })
        .from(ligne_commande)
        .innerJoin(
          commande,
          and(eq(commande.commande_id, ligne_commande.commande_id), scope.owns(commande)),
        )
        .innerJoin(
          produit,
          and(eq(produit.produit_id, ligne_commande.produit_id), scope.owns(produit)),
        )
        .where(
          and(
            scope.owns(ligne_commande),
            ne(commande.statut, 'annulee'),
            // A day of margin on each side; exact week membership is decided below.
            gte(commande.date_commande, `${addDays(depuis, -1)}T00:00:00Z`),
            lte(commande.date_commande, `${addDays(jusqua, 8)}T00:00:00Z`),
            query.synthetic === 'exclude' ? eq(commande.is_synthetic, false) : undefined,
          ),
        )
        .groupBy(produit.famille, heure);

      const venteMap = new Map<string, number>();
      for (const v of ventesParHeure) {
        const semaine = mondayOf(isoDateInZone(new Date(toIsoTimestamp(v.heure))));
        if (semaine < depuis || semaine > jusqua) continue;
        const k = `${v.famille}|${semaine}`;
        venteMap.set(k, (venteMap.get(k) ?? 0) + v.quantite);
      }
      const ventes = [...venteMap.keys()].map((k) => ({ famille: k.split('|')[0]! }));

      const familles = [...new Set([...prevues, ...ventes].map((r) => r.famille))].sort();
      const key = (f: string, s: string) => `${f}|${s}`;
      const prevuMap = new Map(prevues.map((p) => [key(p.famille, p.semaine), p.quantite]));

      return {
        version_modele: version,
        depuis,
        jusqua,
        series: familles.map((famille) => ({
          famille,
          points: semaines.map((s) => ({
            semaine: s,
            quantite_prevue: prevuMap.get(key(famille, s)) ?? null,
            quantite_vendue: venteMap.get(key(famille, s)) ?? 0,
          })),
        })),
      };
    });
  }

  /**
   * Prévisions IA par produit pour la coopérative authentifiée.
   * Le contexte tenant est déterminé par TenantDb.
   */
  async produits(query: PrevisionsProduitsQuery): Promise<PrevisionProduit[]> {
    return this.tenantDb.run(async (scope) => {
      const rows = await scope.tx
        .select({
          produit_id: previsionProduit.produit_id,
          code_produit: produit.code,
          nom_produit: produit.nom,
          famille: produit.famille,
          semaine: previsionProduit.semaine,
          quantite_prevue: previsionProduit.quantite_prevue,
          type_prevision: previsionProduit.type_prevision,
          version_modele: previsionProduit.version_modele,
          date_calcul: previsionProduit.date_calcul,
        })
        .from(previsionProduit)
        .innerJoin(
          produit,
          and(
            eq(previsionProduit.produit_id, produit.produit_id),
            eq(previsionProduit.coop_id, produit.coop_id),
            scope.owns(produit),
          ),
        )
        .where(
          and(
            scope.owns(previsionProduit),
            query.semaine ? eq(previsionProduit.semaine, query.semaine) : undefined,
            query.famille ? eq(produit.famille, query.famille) : undefined,
          ),
        )
        .orderBy(desc(previsionProduit.semaine), produit.code);

      return rows.map((row) => ({
        ...row,
        date_calcul: toIsoTimestamp(row.date_calcul),
      }));
    });
  }
}
