-- =============================================================================
-- DEV ONLY — demo cooperatives with FIXED ids, aligned with the Keycloak realm
-- (apps/keycloak/realm-agricoop.json, group attribute `tenant_id`).
--
-- Run by the `db-seed` service of docker-compose.apps.yml. Idempotent.
-- Rows are demo data, hence is_synthetic = true.
--
-- COOP01 is also the cooperative used by the synthetic generator
-- (data/synthetic-factory), which upserts it ON CONFLICT (code): run this seed
-- before the generator on a fresh database and both share the same coop_id.
-- =============================================================================

INSERT INTO cooperative (coop_id, code, nom, province, is_synthetic)
VALUES
    ('11111111-1111-4111-8111-111111111111', 'COOP01', 'Coopérative Zitoun (fictive)', 'Ouezzane', TRUE),
    ('22222222-2222-4222-8222-222222222222', 'COOP02', 'Coopérative Al Baraka (fictive)', 'Taounate', TRUE)
ON CONFLICT (code) DO NOTHING;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM cooperative
        WHERE (code = 'COOP01' AND coop_id <> '11111111-1111-4111-8111-111111111111')
           OR (code = 'COOP02' AND coop_id <> '22222222-2222-4222-8222-222222222222')
    ) THEN
        RAISE WARNING 'Demo cooperative ids differ from the Keycloak realm (tenant_id). '
                      'Recreate the database volume and run this seed before the synthetic generator.';
    END IF;
END $$;
