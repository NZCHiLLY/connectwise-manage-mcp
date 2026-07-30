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
Deploy: `.\deploy-image-update.ps1` (requires local Docker). Without Docker, build in ACR:

```powershell
az acr build --registry acrcwmmcp --image connectwise-manage-mcp:latest .
az containerapp update --name connectwise-manage-mcp --resource-group rg-cwm-mcp `
  --image acrcwmmcp.azurecr.io/connectwise-manage-mcp:latest --revision-suffix <unique>
```

CI also builds to ACR on push to main.

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

## Copilot Studio Agents (copilot-agents/)

Deploy: `cd copilot-agents && .\create-agents.ps1`

Domain profiles: 17 endpoints `/mcp/{domain}` → each exposes 9–39 tools (Copilot Studio 70-tool cap).
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
