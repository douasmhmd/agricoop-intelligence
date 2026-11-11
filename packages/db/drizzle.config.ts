import { defineConfig } from 'drizzle-kit';

// Drizzle is used for INTROSPECTION ONLY (`pnpm db:pull`). contracts/db/schema.sql owns the schema;
// never run `drizzle-kit generate/migrate/push` against a shared database.
export default defineConfig({
  dialect: 'postgresql',
  out: './src/generated',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://agricoop:agricoop_dev@localhost:5433/agricoop',
  },
  schemaFilter: ['public'],
  introspect: { casing: 'preserve' },
});
