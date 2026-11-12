# ConnectWise Manage MCP Server

TypeScript MCP server for ConnectWise Manage (PSA). Supports stdio and HTTP transports with optional Entra ID OAuth.

## Commands

```bash
npm run build        # tsc → dist/
npm run dev          # tsc --watch
npm test             # vitest (passWithNoTests)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint src
npm run secretlint   # scan for accidental secrets
npm run pack:mcpb    # build MCPB bundle for distribution
```

## Architecture

```
src/
  index.ts          # Entry: stdio + HTTP transports, OAuth middleware wiring
  api-client.ts     # CW Manage REST client + config loader
  context.ts        # AsyncLocalStorage correlation IDs
  tools/            # MCP tools by domain (tickets, companies, contacts, …)
    profiles.ts     # L1 / L2 / full tool-set definitions
    middleware.ts   # Per-tool auth + audit injection
    routes.ts       # HTTP route → tool dispatch
  auth/
    middleware.ts   # Entra ID JWT validation (jose)
    routes.ts       # OAuth 2.1 endpoints (metadata, authorize, token)
    types.ts
  audit/
    log.ts          # Structured audit trail → /home/cwmanage/.cw-mcp-sentinel
```

## Auth Modes

| `AUTH_MODE` | Credentials source |
|-------------|-------------------|
| `env`       | Env vars `CW_MANAGE_PUBLIC_KEY` / `CW_MANAGE_PRIVATE_KEY` |
| `gateway`   | HTTP headers injected by upstream proxy |

Entra ID OAuth is opt-in: set `MCP_OAUTH_ENABLED=true` and provide `AZURE_*` vars.

## Required Env Vars (stdio / env mode)

```
CW_MANAGE_COMPANY_ID
CW_MANAGE_PUBLIC_KEY
CW_MANAGE_PRIVATE_KEY
CW_MANAGE_CLIENT_ID
CW_MANAGE_URL          # default: https://api-na.myconnectwise.net
```

## Tool Profiles

URL path takes precedence over JWT role / env var:

| Path      | Profile        | Tools |
|-----------|----------------|-------|
| `/mcp/l1` | L1 helpdesk    | 73 tools |
| `/mcp/l2` | L2 management  | 71 tools |
| `/mcp/l3` | L3 finance/accounting | 72 tools |
| `/mcp`    | full or JWT role | all |

`MCP_TOOL_PROFILE=l1|l2|l3|full` sets the default when hitting `/mcp` directly.

`UNIVERSAL_READ_TOOLS` in `profiles.ts` is unioned into every profile's allowlist,
so those tools are exposed even when a profile doesn't list them. Currently just
`cw_list_work_roles` — the labour rate card is reference data every tier reads.
Keep it lean — each entry costs a slot in every profile, and the domain profiles
are capped at 40. Work roles are read-only by design — the create/update/delete
tools are not registered, so `full` can't mutate them either.

The 70-tool Copilot Studio cap applies only to the **domain** profiles. No Copilot
agent binds to `/mcp/l1|l2|l3` (check `copilot-agents/agents/*.yaml`) — the role
tiers are served to claude.ai connectors, where L1 and L3 both run at 72.

## Output shaping

Large ConnectWise results overflow the claude.ai client, which refuses a tool result near 50,000 characters. Shaped profiles keep every result under a 40,000-character budget. The logic is in `src/tools/shaping.ts`, wired up in `src/tools/profiles.ts`.

**Which endpoints are shaped.** `l1`, `l2`, `l3`, `opportunities`, `sales` and `pricing` (`SHAPED_PROFILES_DEFAULT`). `pricing` is reserved for the planned read-only pricing tier. Until that tier exists, the path serves the full tool set, shaped. `MCP_SHAPED_PROFILES` is a comma list that replaces this default when set, even to an empty string. The `full` profile, an unset profile and every other domain profile stay raw and byte-identical to before, unless the caller passes `fields`. The cockpit reads the untiered `/mcp` endpoint and depends on that. One cockpit call changes: it passes `fields` to `cw_search_members`, which never declared it, so the SDK used to drop it and return whole member records. That call now gets the projected records. The Copilot agents bound to the `opportunities` and `sales` domain profiles now get shaped output.

**What shaping does.**
- Drops nulls, empty strings, empty arrays and empty objects. `0`, `false` and `"0"` are kept.
- Drops `_info` hrefs and nested objects. `_info` keeps its scalar date and user fields (`dateEntered`, `enteredBy`, `lastUpdated`, `updatedBy`), because notes are filtered on `_info/dateEntered` and ticket age is read from it.
- On read tools only, strips the Tomizone email disclaimer, the external sender banner and inline signature images from `text` and `notes` fields.
- On read tools only, caps each `text` and `notes` value at `maxTextChars` (default 2000), then appends `[display cut: N more characters stored]`. A write tool's response is never cut, because it can become the body of the next write.
- Clamps `pageSize` to 100. The cap applies on shaped profiles only.

**Envelope.** An array result becomes `{ items, returned, hasMore, nextPage, truncated }`. `truncated` is always present and is false when nothing was cut. `nextPage` comes from the ConnectWise `Link` header (`parseLinkHeader` in `src/api-client.ts`) and is absent when there is no next page. When the budget forces rows to be dropped, `truncated` is true and `omitted`, `pageTotal` and a `hint` are added. Rows are dropped from the end, the first row is always kept, and `hasMore` is forced true. Omitted rows are not on `nextPage`. ConnectWise pages by offset: page p at pageSize s holds rows (p-1)s+1 to ps, so the same page number at a smaller `pageSize` returns different rows. The hint therefore offers two routes: request the same page and `pageSize` again with fewer `fields`, or restart at page 1 with `pageSize` set to the returned count and page forward. A single object over budget after text capping is returned as is.

**Tool arguments.**
- `fields` is injected on every read tool that returns records (`cw_search_*`, `cw_list_*`, `cw_get_*`). `cw_count_*` returns only a count, so it gets none. It is comma-separated, with `/` for nesting, for example `id,summary,company/name`. It also works on raw profiles, where it projects and does nothing else.
- `maxTextChars` is injected on read tools whose name contains `note`. It applies only where output is shaped.
- `conditions` and `orderBy` carry help text describing the operator, string and date syntax.

**Write guard.** On every profile, a tool that is not a read (`cw_search_*`, `cw_list_*`, `cw_get_*`, `cw_count_*`) is refused without calling ConnectWise when any string in its arguments, however deeply nested, contains `[display cut:`. That marker only comes from a shaped read, so the write would store cut text. The `cw_replace_*` descriptions also say that the body must come from a full, unshaped read.

**Query argument repair.** On every profile, `conditions`, `childConditions`, `customFieldConditions` and `orderBy` are repaired. HTML entities for angle brackets, quotes, apostrophes and ampersands are decoded across the whole string, quoted parts included. The field aliasing below skips quoted strings. On ticket note tools, `dateCreated`, `createdDate` and `dateEntered` become `_info/dateEntered`. On `cw_search_opportunities` and `cw_count_opportunities`, `closedFlag = false` becomes `closedDate = null` and `closedFlag = true` becomes `closedDate != null`. Opportunity statuses keep `closedFlag`, because it is a real field there.

## Docker

Credentials are Docker secrets (files), not env vars:

```
secrets/CW_MANAGE_PUBLIC_KEY
secrets/CW_MANAGE_PRIVATE_KEY
secrets/CW_MANAGE_CLIENT_ID
```

```bash
docker compose up -d                                  # HTTP on 127.0.0.1:9090
docker compose -f docker-compose.caddy.yml up -d     # with TLS termination
```

## Deployment

ACA FQDN: `YOUR-ACA-APP.YOUR-ENV-ID.australiaeast.azurecontainerapps.io`
Deploys go through the pipeline: a merge to main. Break-glass only, when GitHub Actions is unavailable and no release.yml run is queued or running:

```powershell
az acr build -r acrcwmmcp -t connectwise-manage-mcp:manual-<sha7>-<yyyymmddHHMM> --build-arg COMMIT_SHA=<full sha> .
az containerapp update -n connectwise-manage-mcp -g rg-cwm-mcp --image acrcwmmcp.azurecr.io/connectwise-manage-mcp:<that tag> --set-env-vars IMAGE_VERSION=<that tag>
```

Then confirm `/health` shows that `build.sha` and `build.image`. Never deploy `:latest`. The next merge to main supersedes a break-glass deploy.

## Gotchas

- Work roles live at `/time/workRoles`, NOT `/finance/workRoles` — the latter 404s "The endpoint does not exist." CW's own `_info.workRole_href` on a time entry confirms the real route. Agreement-level rate *overrides* are a different resource and do sit under `/finance/agreements/{id}/workroles`; don't let the two blur.
- `POST /service/tickets/search` takes a `FilterValues` body — `{"conditions": "id = 104094"}`, not `{"id": 104094}`. The bare-id form fails with "Could not find member 'id' on object of type 'FilterValues'".
- A ticket's `serviceLocation` (On-Site / Remote / In-House, from `/service/locations`) is a different field from its `site` (customer address) and from `location` (the owning office, `/system/locations`). All three are settable and easily confused.
- Time entries need an explicit `member` — defaulting to the API member fails with "API-only members do not have access to this module". Editing an entry whose `member` differs from `enteredBy` needs Time & Expense → Time Entry → **Edit: All** on the API member's security role, otherwise `PATCH /time/entries/{id}` returns 403.
- Date/time params are UTC and take **no** enclosing brackets. The old `[YYYY-MM-DDTHH:MM:SSZ]` descriptions were read as literal and rejected with `UnsupportedFormat`.
- CW REST has no top-level `/finance/payments` (404 "endpoint does not exist") and no `/finance/invoices/{id}/pay` action. Payments are an invoice sub-resource: `/finance/invoices/{id}/payments` (GET/POST/PATCH per payment ID). Payment model fields: `amount` (required), `paymentDate`, `type`, `appliedBy`.
- There is no `/system/myCompany` — it isn't a CW route at all. The tenant's own organisation is an ordinary `/company/companies` record whose `identifier` equals the company ID used to authenticate, so `cw_get_my_company` resolves it with `conditions=identifier="<CW_MANAGE_COMPANY_ID>"`. For this tenant that's company **250** (`Tomizone`) — note company 24378 is a same-named *vendor* record, so match on `identifier`, never on `name`.
- `/system/myAccount` *is* documented but 404s "The endpoint does not exist." on CW cloud, because the caller is an API-only member with no account record. `cw_get_my_account` tries it and degrades to the connection context on that specific 404 only — unrelated errors (401 etc.) still throw.
- Production runs the **AU** cloud region: `CW_MANAGE_URL=https://api-aus.myconnectwise.net`, not the `api-na` default baked into `getConfig()`. CW's own `_info` hrefs confirm it. There is no sandbox instance configured anywhere in this repo — every profile and Copilot agent points at prod.
- `npm ci --ignore-scripts` in Dockerfile — prevents `prepare` (git hooks) from running before source copy
- `CW_MANAGE_REJECT_UNAUTHORIZED=false` required for self-signed certs on self-hosted instances
- `secretlint` runs pre-commit via `.githooks`; never bypass with `--no-verify`
- Two MCP server IDs registered in Claude: `mcp__connectwise-manage__*` (local) and `mcp__claude_ai_tz-cw-psa-mcp__*` (cloud)
- `az containerapp update` with an unchanged image tag may not create a new revision — always pass `--revision-suffix`
- Reports: rows come from `/system/reports/{name}`. `/system/reports/{name}/count` returns only `{"count": n}` — `cw_run_report` was wired to `/count`, so it reported 71 matching payments and never handed over a row. Both `cw_run_report` and `cw_get_report` now hit the bare path and forward `conditions`/`page`/`pageSize`/`orderBy`; without those CW returns the oldest 25 rows.
- `release.yml` has no per-ref `concurrency` group by default. Two main pushes landing together race in the deploy job and ACA keeps whichever `az containerapp update` returns last, not the newest commit. This silently reverted production to the prior image on 2026-07-30 and it ran that way for 24 days. The workflow now queues runs per ref.

## Copilot Studio Agents (copilot-agents/)

Deploy: `cd copilot-agents && .\create-agents.ps1`

Domain profiles: 18 endpoints `/mcp/{domain}` → each exposes 9–39 tools (Copilot Studio 70-tool cap).
Profile source: `src/tools/profiles.ts` `DOMAIN_PROFILES` record.

### Gotchas

- **Connection reference binding** — `pac solution import` + Dataverse API PATCH to `connectionreferences` is NOT enough. Must also go to `make.powerapps.com` → Solutions → ConnectWise Connectors → Connection References → edit each → select connection → save. The UI calls a different Power Platform management API the Dataverse API doesn't reach.
- **Power Fx parse errors** — single `{...}` in agent instructions are parsed as Power Fx at publish time; use `[fieldId]` bracket notation. Double-braces `{{...}}` are safe escaped literals.
- **APIM scope key** — `securityDefinitions` scope keys must be simple strings (`access_as_user`), not URI-format (`api://...`) — APIM rejects URI keys with `oneOf` validation error.
- **ZipArchive not Compress-Archive** — PowerShell `Compress-Archive` writes backslash entry paths on Windows; `[Content_Types].xml` PartName uses forward slashes, causing binary data files to be silently skipped on import. Script uses `System.IO.Compression.ZipArchive` directly.
- **Pre-create bots** — solution import cannot create new bots; must POST to `bots` entity in Dataverse first.
- **gpt.default data** — solution import skips binary data fields for existing bots; patch `gpt.default.data` (agent instructions) separately via Dataverse API after import.
- **pac copilot publish** — must run after import; import alone does not register connection references with the Copilot Studio backend service.
- **apiProperties.json format** — `pac connector update --api-properties-file` needs `{ "properties": { "connectionParameters": {...} } }` wrapper, not the raw format used in the Connector folder files.
