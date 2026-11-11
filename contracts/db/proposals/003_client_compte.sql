-- =============================================================================
-- Proposal 003 — link a client to its identity-provider account
-- Status   : PROPOSED (needs approval from both CODEOWNERS)
-- Author   : apps
--
-- Rationale
--   Storefront customers and resellers authenticate with Keycloak, but nothing
--   in the schema links a Keycloak account to a `client` row.
--   `client` is per cooperative (coop_id), while one person may buy from several
--   cooperatives. So the link is (coop_id, idp_subject) -> client_id: the first
--   order a user places with a cooperative creates their `client` + `client_pii`
--   rows for that cooperative and this link row.
--
-- Personal data (Law 09-08)
--   `idp_subject` (the Keycloak `sub`) is a pseudonymous identifier: it is
--   treated like client_pii — operational plane only, never in events, logs or
--   analytics. That is why it is a separate table rather than a column on
--   `client` (which is exported to the analytics plane).
--
-- Impact on the data plane
--   None. The table is not exported. The synthetic generator does not need it
--   (synthetic clients have no login).
-- =============================================================================

CREATE TABLE IF NOT EXISTS client_compte (
    client_id     UUID PRIMARY KEY REFERENCES client (client_id) ON DELETE CASCADE,
    coop_id       UUID NOT NULL REFERENCES cooperative (coop_id),
    idp_subject   TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_synthetic  BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (coop_id, idp_subject)
);
