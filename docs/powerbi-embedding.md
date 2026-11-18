# Power BI Embedded — setup guide

The back office shows the data plane's Power BI report in **Analyses → Power BI**, filtered on the
signed-in manager's cooperative. Pattern: **"embed for your customers" (app owns data)**. Users
never sign in to Power BI: the API authenticates as a **service principal** and gives the browser a
short-lived **embed token** carrying a row-level-security identity. Power BI secrets never reach the
front end.

Without the settings below, everything runs in **demo mode**: the API answers `mode: "demo"` and the
tab explains what is missing. Local development and CI need no Azure.

```
browser (back office)                api (apps/api/src/powerbi)                 Power BI / Entra ID
  │ GET /api/v1/analytics/powerbi/embed/ventes ─▶ coop_id from the JWT (never from the request)
  │                                     │ client credentials (msal-node) ───────▶ Entra ID token
  │                                     │ GET  /groups/{ws}/reports/{id} ────────▶ embedUrl, datasetId
  │                                     │ POST /GenerateToken  identities: [{ username: coop_id,
  │                                     │        roles: ["Cooperative"], datasets: [datasetId] }]
  │ ◀── { embedUrl, embedToken, expiresAt }
  │ iframe app.powerbi.com (token refreshed in place 5 min before expiry)
```

## 1. Microsoft Entra ID: app registration

1. Entra admin center → **App registrations → New registration** (e.g. `agricoop-powerbi-embed`),
   single tenant, no redirect URI.
2. Note the **Application (client) ID** and the **Directory (tenant) ID**.
3. **Certificates & secrets → New client secret**; copy the value once (it is not shown again).
4. No API permissions need to be granted for this pattern (Power BI uses workspace access, below).
   Optional but recommended: put the app in a dedicated security group, e.g.
   `sg-powerbi-embedding`.

## 2. Power BI / Fabric tenant settings (Fabric admin portal)

- **Developer settings → Service principals can use Fabric APIs** (formerly "Allow service
  principals to use Power BI APIs"): **enabled**, ideally restricted to the security group above.
- If the tenant restricts embedding: **Embed content in apps** enabled.

## 3. Workspace

1. Create (or pick) the workspace that holds the report and its semantic model.
2. **Manage access → Add** the service principal (or its group) as **Member** (Contributor also
   works; Viewer does not allow token generation).
3. Note the **workspace ID** (in the URL: `app.powerbi.com/groups/<workspaceId>/…`).

## 4. Capacity

Embed tokens for "embed for your customers" require the workspace to be on a **capacity**:

- **Production:** a Fabric **F SKU** or Power BI Embedded **A SKU** (EM/P SKUs also work).
- **Demo / development:** a **Fabric trial capacity** is enough. Without any capacity, Power BI
  only issues a limited number of development tokens, and they stop working.

Assign the capacity in **Workspace settings → License info**.

## 5. The report and its semantic model — request to the data plane

> **The dataset belongs to the data plane** (`data/bi`, `data/bi/reports/AgriCoop_Dashboard.pbix`,
> owned by the data team). The steps below are a **request to them**; the apps never change
> `data/`.

1. **Publish** `AgriCoop_Dashboard.pbix` to the workspace (report + semantic model). Its pages:
   _Contrôles_, _Vue d'ensemble_, _Stocks_, _Prévisions_.
2. In Power BI Desktop, **Modeling → Manage roles**, create:
   - **`Cooperative`** — on the table that carries the tenant (every gold view has `coop_id`; filter
     the tenant dimension, or each fact table if there is none):
     ```dax
     [coop_id] = USERNAME()
     ```
   - **`Admin`** — no filter (platform administration, all cooperatives).
3. Republish. In the service, the dataset's **Security** page lists the roles; members do not need
   to be added for embedding (the API passes the identity in the token).
4. Optional, for the back office's "hide synthetic data" toggle: expose an `is_synthetic` column in
   the model (the gold views do not have it today; the tab says so instead of filtering).

Why `USERNAME()`: with an embed token, `USERNAME()` returns the `username` of the effective
identity, which the API sets to the caller's `coop_id` **taken from the verified token / tenant
context, never from the request**. A manager therefore only ever sees their own cooperative; a
`saas_admin` gets the selected cooperative (`X-Coop-Id`), or the `Admin` role when none is selected.

## 6. API settings

In the API's environment (`.env` for `pnpm dev`, or the `api` service of
`docker-compose.apps.yml`, which forwards them). **All five or none** — a partial configuration
stops the API at startup:

| Variable                | Value                                                                |
| ----------------------- | -------------------------------------------------------------------- |
| `POWERBI_TENANT_ID`     | Directory (tenant) ID                                                |
| `POWERBI_CLIENT_ID`     | Application (client) ID                                              |
| `POWERBI_CLIENT_SECRET` | Client secret value (a secret: never commit it)                      |
| `POWERBI_WORKSPACE_ID`  | Workspace ID                                                         |
| `POWERBI_REPORTS`       | JSON: report key → report ID, or → `{ "reportId", "page", "title" }` |

Report keys become the tab's picker. One report with several pages maps naturally to one key per
page (page names are the `ReportSection…`/hex names visible in the report URL, or via
`GET /groups/{ws}/reports/{id}/pages`):

```env
POWERBI_REPORTS={"vue":{"reportId":"<report-id>","page":"8485840412cc550dd870"},"stocks":{"reportId":"<report-id>","page":"1eb2609e6bbc87b085bd"},"previsions":{"reportId":"<report-id>","page":"3d05dc30617d16c5535a"},"controles":{"reportId":"<report-id>","page":"149af13286ce520b9194"}}
```

(The page names above are those of the current `.pbix`; check them after publishing.) Titles come
from `title`, else the page display name, else the report name.

Optional: `POWERBI_TOKEN_MINUTES` (10–60, default 60), `POWERBI_API_URL` and
`POWERBI_AUTHORITY_HOST` (sovereign clouds only).

## 7. Front end and Content-Security-Policy

- The back office's nginx adds `frame-src https://app.powerbi.com` through `CSP_EXTRA_FRAME_SRC`
  (set for the `backoffice` service in `docker-compose.apps.yml`; empty for the storefront). Set
  the same variable in any other deployment. Sovereign clouds use other hosts
  (e.g. `https://app.powerbigov.us`): list them there.
- The Vite dev server sets no CSP, so nothing to configure locally.
- The report is themed from the design tokens (`apps/backoffice/scripts/powerbi-theme.ts` →
  `src/analytics/powerbi/theme-{light,dark}.json`, applied with `report.applyTheme`, following the
  app's light/dark theme). The same files are in `apps/backoffice/public/powerbi-theme*.json` for
  report authors: **Power BI Desktop → View → Themes → Browse for themes**. Power BI cannot load web
  fonts: the theme uses Georgia (titles) and Segoe UI (text).
- The report follows the app language (`localeSettings` fr / ar). A mobile layout is used on small
  screens when the report has one (Power BI Desktop → View → Mobile layout).

## 8. Checking it works

1. Restart the API with the settings; `GET /api/v1/analytics/powerbi/reports` (as a manager) now
   answers `mode: "live"` with the report list.
2. Open **Analyses → Power BI** as `manager.coop01`: the report renders, and the card header says
   _Filtré sur votre coopérative_.
3. Sign in as `manager.coop02`: only COOP02's figures (none in the shared seed) — proof that RLS
   applies. If both managers see the same totals, the `Cooperative` role is missing or its DAX
   filter is not on the right table.

Troubleshooting: `401`/`403` from `GenerateToken` → tenant setting or workspace membership;
`"Creating embed token with effective identity requires dataset to provide roles"` → the RLS roles
are missing; `InvalidCapacity`/token limits → no capacity assigned. The API maps any Power BI error
to `502 powerbi_indisponible` and logs the Power BI status and error code (never the token).
