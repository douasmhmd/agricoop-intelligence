# Schema change proposals

`contracts/db/schema.sql` is the single source of truth and is only changed after **both** CODEOWNERS
approve. Changes are proposed here first as standalone, idempotent-where-possible SQL files:

```
NNN_<short_name>.sql   -- header: status, author, rationale, impact on data plane
```

Once approved, the statements are folded into `schema.sql` and the proposal is marked `MERGED`.
Application code must keep working against `schema.sql` as it is until then.

| #   | File                       | Status   | Summary                                                    |
|-----|----------------------------|----------|------------------------------------------------------------|
| 001 | `001_rls.sql`               | PROPOSED | Row-level security on business tables (`app.coop_id`), roles `agricoop_app` / `agricoop_relay`, `qr_lookup()` |
| 002 | `002_outbox_envelope.sql`  | PROPOSED | `outbox.version`, `outbox.is_synthetic`, `outbox.published_at` |
| 003 | `003_client_compte.sql`    | PROPOSED | Link a `client` to its Keycloak account (`idp_subject`)    |

Proposal 001 is exercised by the api test suite: `apps/api/test/tenant-isolation.int.test.ts` runs every
isolation test with and without it (Testcontainers), as a non-owner `agricoop_app` member.
