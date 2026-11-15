-- =============================================================================
-- DEV ONLY — demo cooperatives with FIXED ids, aligned with the Keycloak realm
-- (apps/keycloak/realm-agricoop.json, group attribute `tenant_id`).
--
-- Run by the `db-seed` service of docker-compose.apps.yml. Idempotent.
-- Rows are demo data, hence is_synthetic = true.
--
-- COOP01 belongs to the data plane: its rows come from the shared seed dump
-- (synthetic generator + ML outputs, restored with `pnpm db:restore`), and its
-- coop_id is the one in that dump. This seed only adds COOP01 if it is missing
-- (fresh database without the dump) and COOP02, the apps' own demo cooperative.
-- =============================================================================

INSERT INTO cooperative (coop_id, code, nom, province, is_synthetic)
VALUES
    ('56783517-58a9-42ee-b9d5-c8b946b6b6e3', 'COOP01', 'Coopérative Zitoun (fictive)', 'Ouezzane', TRUE),
    ('22222222-2222-4222-8222-222222222222', 'COOP02', 'Coopérative Al Baraka (fictive)', 'Taounate', TRUE)
ON CONFLICT (code) DO NOTHING;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM cooperative
        WHERE (code = 'COOP01' AND coop_id <> '56783517-58a9-42ee-b9d5-c8b946b6b6e3')
           OR (code = 'COOP02' AND coop_id <> '22222222-2222-4222-8222-222222222222')
    ) THEN
        RAISE WARNING 'Demo cooperative ids differ from the Keycloak realm (tenant_id). '
                      'Restore the shared seed dump (pnpm db:restore) or recreate the database.';
    END IF;
END $$;
