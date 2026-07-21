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
| `/mcp/l1` | L1 helpdesk    | ~65 tools |
| `/mcp/l2` | L2 management  | ~70 tools |
| `/mcp/l3` | L3 finance/accounting | 71 tools |
| `/mcp`    | full or JWT role | all |

`MCP_TOOL_PROFILE=l1|l2|l3|full` sets the default when hitting `/mcp` directly.

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

- CW REST has no top-level `/finance/payments` (404 "endpoint does not exist") and no `/finance/invoices/{id}/pay` action. Payments are an invoice sub-resource: `/finance/invoices/{id}/payments` (GET/POST/PATCH per payment ID). Payment model fields: `amount` (required), `paymentDate`, `type`, `appliedBy`.
- `npm ci --ignore-scripts` in Dockerfile — prevents `prepare` (git hooks) from running before source copy
- `CW_MANAGE_REJECT_UNAUTHORIZED=false` required for self-signed certs on self-hosted instances
- `secretlint` runs pre-commit via `.githooks`; never bypass with `--no-verify`
- Two MCP server IDs registered in Claude: `mcp__connectwise-manage__*` (local) and `mcp__claude_ai_tz-cw-psa-mcp__*` (cloud)
- `az containerapp update` with an unchanged image tag may not create a new revision — always pass `--revision-suffix`

## Copilot Studio Agents (copilot-agents/)

Deploy: `cd copilot-agents && .\create-agents.ps1`

Domain profiles: 17 endpoints `/mcp/{domain}` → each exposes 20–38 tools (Copilot Studio 70-tool cap).
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
