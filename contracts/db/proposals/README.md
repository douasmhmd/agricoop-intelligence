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
| 002 | `002_outbox_envelope.sql`  | PROPOSED | `outbox.version`, `outbox.is_synthetic`, `outbox.published_at` |
| 003 | `003_client_compte.sql`    | PROPOSED | Link a `client` to its Keycloak account (`idp_subject`)    |

Proposal 001 (row-level security) is written in apps phase 3.
