import { sql } from 'drizzle-orm';
import {
  check,
  date,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { produit } from './generated/schema.js';

/**
 * Prévisions hebdomadaires par produit.
 * Table alimentée par le write-back du pipeline Azure.
 */
export const previsionProduit = pgTable(
  'prevision_produit',
  {
    coop_id: uuid('coop_id').notNull(),

    produit_id: uuid('produit_id')
      .notNull()
      .references(() => produit.produit_id),

    semaine: date('semaine').notNull(),

    type_prevision: text('type_prevision').notNull(),

    quantite_prevue: numeric('quantite_prevue', {
      precision: 12,
      scale: 2,
    }).notNull(),

    version_modele: text('version_modele').notNull(),

    date_calcul: timestamp('date_calcul', {
      withTimezone: true,
      mode: 'string',
    })
      .notNull()
      .defaultNow(),
  },

  (table) => [
    primaryKey({
      columns: [table.coop_id, table.produit_id, table.semaine, table.type_prevision],
      name: 'prevision_produit_pkey',
    }),

    check('prevision_produit_quantite_prevue_check', sql`${table.quantite_prevue} >= 0`),
  ],
);
