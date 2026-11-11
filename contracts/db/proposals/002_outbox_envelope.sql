-- =============================================================================
-- Proposal 002 — outbox envelope metadata
-- Status   : PROPOSED (needs approval from both CODEOWNERS)
-- Author   : apps
--
-- Rationale
--   Every event published to Redpanda uses the envelope
--     { event_id, type, version, coop_id, occurred_at, is_synthetic, payload }
--   (see contracts/events/README.md). Today `outbox` carries event_id, type,
--   coop_id, created_at (= occurred_at) and payload, but not:
--     * version       — schema version of the payload, so the data plane can
--                       route v1 / v2 without parsing the payload;
--     * is_synthetic  — so events produced by the demo seed (is_synthetic = true)
--                       can be filtered out of real analytics, consistently with
--                       every business table;
--     * published_at  — when the relay published the row (observability: relay
--                       lag, replay audits). `publie` stays the source of truth.
--
-- Until this is merged the relay emits version = 1 and is_synthetic = false.
--
-- Impact on the data plane
--   None on existing consumers: the envelope shape is unchanged, only its
--   source becomes explicit. The synthetic generator does not write `outbox`.
-- =============================================================================

ALTER TABLE outbox
    ADD COLUMN IF NOT EXISTS version      SMALLINT    NOT NULL DEFAULT 1 CHECK (version > 0),
    ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
