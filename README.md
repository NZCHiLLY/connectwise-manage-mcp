# ConnectWise Manage MCP Server

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)

**Let your AI assistant work directly with ConnectWise Manage.** Search tickets, log time, manage companies and contacts, work opportunities, procurement, invoicing, knowledge base articles, and more — through natural conversation instead of clicking through the CWM interface.

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that gives Claude (or any MCP-compatible AI) **70+ tools** across 17 domain profiles. Works with both **cloud-hosted and self-hosted** CWM instances. Supports stdio, HTTP, and Cloudflare Workers transports, with optional Entra ID OAuth 2.1 for production deployments.

> **Fork of [WYRE Technology's connectwise-manage-mcp](https://github.com/wyre-technology/connectwise-manage-mcp)** — extended with SENTINEL write-gating, 17 URL-scoped domain profiles, Entra ID OAuth proxy, Copilot Studio multi-agent topology (18 agents), and deployment to Azure Container Apps. See [Upstream changes](#upstream-changes) for what's different.

## What's New in This Fork

| Feature | Description |
|---|---|
| **SENTINEL protocol** | Write-gating for all mutating tools — requires explicit intent + user quote confirmation before create/update/delete |
| **Domain profiles** | 17 URL-scoped endpoints (`/mcp/tickets`, `/mcp/companies`, etc.) each exposing 20–38 tools (Copilot Studio 70-tool cap) |
| **Entra ID OAuth 2.1** | Confidential client token proxy — injects `client_secret` server-side so Copilot Studio connectors never see it |
| **Multi-agent Copilot Studio** | 18 agents (1 orchestrator + 17 domain) deployable via PowerShell script, with SharePoint knowledge base integration |
| **Work IQ agent** | M365 domain agent for email, Teams, SharePoint, and calendar operations |
| **Knowledge Base agent** | CRUD for CW Manage KB articles with structured answer format and lifecycle management |
| **Structured audit trail** | All writes logged to a JSONL sentinel file with correlation IDs, user intent, and user quote |
| **NZ English conventions** | Organise, behaviour, licence (noun), centre throughout |

## One-Click Deployment

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/NZCHiLLY/connectwise-manage-mcp/tree/main)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/NZCHiLLY/connectwise-manage-mcp)

For deploying to **Azure Container Apps** with Entra ID OAuth 2.1, see [AZURE_ACA_DEPLOYMENT.md](AZURE_ACA_DEPLOYMENT.md).

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CW_MANAGE_COMPANY_ID` | Yes | Your ConnectWise company identifier |
| `CW_MANAGE_PUBLIC_KEY` | Yes | API member public key |
| `CW_MANAGE_PRIVATE_KEY` | Yes | API member private key |
| `CW_MANAGE_CLIENT_ID` | Yes | Client ID from [ConnectWise Developer Portal](https://developer.connectwise.com/) |
| `CW_MANAGE_URL` | No | API base URL (see below) |
| `CW_MANAGE_REJECT_UNAUTHORIZED` | No | Set to `false` for self-signed certs (default: `true`) |
| `MCP_TRANSPORT` | No | `stdio` (default) or `http` |
| `MCP_HTTP_PORT` | No | HTTP port (default: `8080`) |
| `AUTH_MODE` | No | `env` (default) or `gateway` for header-based auth |
| `MCP_TOOL_PROFILE` | No | `l1`, `l2`, `l3`, or `full` — sets default tool profile for `/mcp` |
| `MCP_OAUTH_ENABLED` | No | Set to `true` to enable Entra ID OAuth 2.1 |
| `AZURE_TENANT_ID` | OAuth | Entra ID tenant ID |
| `AZURE_CLIENT_ID` | OAuth | Entra ID app registration client ID |
| `AZURE_CLIENT_SECRET` | OAuth | Entra ID app registration client secret |
| `AZURE_EXTRA_AUDIENCES` | OAuth | Comma-separated additional token audiences (e.g. Teams federated connector) |

### API Base URL (`CW_MANAGE_URL`)

| Instance Type | URL |
|---------------|-----|
| Cloud (North America) | `https://api-na.myconnectwise.net` (default) |
| Cloud (Europe) | `https://api-eu.myconnectwise.net` |
| Cloud (Australia) | `https://api-au.myconnectwise.net` |
| **Self-hosted** | `https://cwm.yourcompany.com` |

For self-hosted instances, set `CW_MANAGE_URL` to your server's base URL. The server automatically appends `/v4_6_release/apis/3.0` unless the URL already contains that path.

If your self-hosted instance uses a self-signed certificate, also set `CW_MANAGE_REJECT_UNAUTHORIZED=false`.

### Getting Your API Keys

1. Log in to your ConnectWise Manage instance
2. Navigate to **System > Members > API Members**
3. Create a new API member with appropriate permissions
4. Generate API keys for the member
5. Get your Client ID from the [ConnectWise Developer Portal](https://developer.connectwise.com/)

## Auth Modes

| `AUTH_MODE` | Credentials source |
|-------------|-------------------|
| `env` | Env vars `CW_MANAGE_PUBLIC_KEY` / `CW_MANAGE_PRIVATE_KEY` |
| `gateway` | HTTP headers injected by upstream proxy |

Entra ID OAuth is opt-in: set `MCP_OAUTH_ENABLED=true` and provide `AZURE_*` vars.

## Tool Profiles

URL path takes precedence over JWT role / env var:

| Path | Profile | Tools |
|------|---------|-------|
| `/mcp/l1` | L1 helpdesk | ~65 tools |
| `/mcp/l2` | L2 management | ~70 tools |
| `/mcp/l3` | L3 finance/accounting | 71 tools |
| `/mcp/{domain}` | Domain | 20–38 tools (Copilot Studio) |
| `/mcp` | full or JWT role | all |

Domain endpoints: `tickets`, `time-entries`, `companies`, `contacts`, `configurations`, `service-boards`, `service-config`, `sales`, `opportunities`, `finance-agreements`, `finance-invoices`, `catalog`, `procurement-orders`, `procurement-inventory`, `system-members`, `system-admin`, `schedule-expenses`, `knowledge-base`.

## Available Tools

### Tickets
- `cw_search_tickets` — Search service tickets with conditions
- `cw_get_ticket` — Get a ticket by ID
- `cw_create_ticket` — Create a new service ticket
- `cw_update_ticket` — Update a ticket with named fields
- `cw_get_ticket_notes` — Get all notes on a ticket (including child ticket notes)
- `cw_add_ticket_note` — Add a note to a ticket (discussion, internal, or resolution)
- `cw_get_ticket_schedule_entries` — Get schedule entries on a ticket
- `cw_list_team_members` — List team members by role
- `cw_list_ticket_tasks` — List tasks on a ticket

### Companies
- `cw_search_companies` — Search companies
- `cw_get_company` — Get a company by ID
- `cw_create_company` — Create a new company
- `cw_update_company` — Update a company (JSON Patch)
- `cw_get_company_sites` — Get sites for a company
- `cw_get_company_teams` — Get teams for a company

### Contacts
- `cw_search_contacts` — Search contacts
- `cw_get_contact` — Get a contact by ID
- `cw_create_contact` — Create a new contact
- `cw_update_contact` — Update a contact (JSON Patch)

### Opportunities & Sales
- `cw_search_opportunities` — Search opportunities
- `cw_get_opportunity` — Get an opportunity by ID
- `cw_create_opportunity` — Create a new opportunity
- `cw_update_opportunity` — Update an opportunity (JSON Patch)
- `cw_search_sales_orders` — Search sales orders
- `cw_get_sales_order` — Get a sales order by ID

### Finance
- `cw_search_agreements` — Search agreements
- `cw_get_agreement` — Get an agreement by ID
- `cw_search_invoices` — Search invoices
- `cw_get_invoice` — Get an invoice by ID

### Procurement
- `cw_search_purchase_orders` — Search purchase orders
- `cw_get_purchase_order` — Get a purchase order by ID
- `cw_search_inventory` — Search inventory items
- `cw_get_inventory_item` — Get an inventory item by ID

### Projects
- `cw_search_projects` — Search projects
- `cw_get_project` — Get a project by ID
- `cw_create_project` — Create a new project
- `cw_search_project_tickets` — Search tickets under a project
- `cw_get_project_ticket` — Get a specific project ticket by ID
- `cw_get_project_ticket_notes` — Get all notes on a project ticket
- `cw_add_project_ticket_note` — Add a note to a project ticket

### Time Entries
- `cw_search_time_entries` — Search time entries
- `cw_get_time_entry` — Get a time entry by ID
- `cw_create_time_entry` — Create a new time entry
- `cw_list_time_sheets` — List timesheets
- `cw_get_time_sheet` — Get a timesheet by ID

### Members & System
- `cw_search_members` — Search members/technicians
- `cw_get_member` — Get a member by ID
- `cw_list_member_types` — List member types
- `cw_list_work_roles` — List work roles
- `cw_list_locations` — List locations/departments

### Configuration Items
- `cw_search_configurations` — Search configuration items (assets)
- `cw_get_configuration` — Get a configuration item by ID
- `cw_list_configuration_types` — List configuration types

### Service Reference Data
- `cw_list_boards` — List service boards
- `cw_list_priorities` — List ticket priorities
- `cw_list_statuses` — List statuses for a board
- `cw_list_service_categories` — List service categories
- `cw_list_service_subcategories` — List subcategories

### Knowledge Base
- `cw_list_kb_articles` — Search/list KB articles
- `cw_get_kb_article` — Get a single KB article
- `cw_create_kb_article` — Create a new KB article
- `cw_update_kb_article` — Update a KB article (JSON Patch)
- `cw_delete_kb_article` — Delete a Draft article (never hard-delete approved)

### Activities
- `cw_search_activities` — Search activities
- `cw_get_activity` — Get an activity by ID
- `cw_create_activity` — Create a new activity

### Catalog
- `cw_search_catalog` — Search the product catalog
- `cw_get_catalog_item` — Get a catalog item by ID

### Health
- `cw_test_connection` — Test connection (hits `/system/info`)

## SENTINEL Write-Gating

All mutating tools (create, update, delete) require two additional parameters:

| Parameter | Description |
|-----------|-------------|
| `user_intent` | Plain-English description (min 1 char) of what the user asked for |
| `user_quote` | The verbatim words the user said — do not paraphrase |

Before any write, the server logs the intent, quote, and target payload to a structured audit trail. This provides a human-readable paper trail for every mutation, independent of CW's built-in audit log.

## Usage

### With Claude Desktop

Build from source and point Claude at the local checkout:

```json
{
  "mcpServers": {
    "connectwise-manage": {
      "command": "node",
      "args": ["E:/Projects/work/connectwise-manage-mcp/dist/index.js"],
      "env": {
        "CW_MANAGE_COMPANY_ID": "your-company-id",
        "CW_MANAGE_PUBLIC_KEY": "your-public-key",
        "CW_MANAGE_PRIVATE_KEY": "your-private-key",
        "CW_MANAGE_CLIENT_ID": "your-client-id"
      }
    }
  }
}
```

For a self-hosted instance:

```json
{
  "mcpServers": {
    "connectwise-manage": {
      "command": "node",
      "args": ["E:/Projects/work/connectwise-manage-mcp/dist/index.js"],
      "env": {
        "CW_MANAGE_URL": "https://cwm.yourcompany.com",
        "CW_MANAGE_COMPANY_ID": "your-company-id",
        "CW_MANAGE_PUBLIC_KEY": "your-public-key",
        "CW_MANAGE_PRIVATE_KEY": "your-private-key",
        "CW_MANAGE_CLIENT_ID": "your-client-id",
        "CW_MANAGE_REJECT_UNAUTHORIZED": "false"
      }
    }
  }
}
```

### With Docker

```bash
docker compose up -d
```

### HTTP Transport (Gateway Mode)

Run with HTTP transport for multi-tenant gateway deployments:

```bash
MCP_TRANSPORT=http AUTH_MODE=gateway node dist/index.js
```

Pass credentials per-request via headers: `X-CW-Company-Id`, `X-CW-Public-Key`, `X-CW-Private-Key`, `X-CW-Client-Id`, and optionally `X-CW-URL`.

### With Entra ID OAuth

```bash
MCP_TRANSPORT=http MCP_OAUTH_ENABLED=true AZURE_TENANT_ID=... AZURE_CLIENT_ID=... AZURE_CLIENT_SECRET=... node dist/index.js
```

OAuth endpoints:
- `/.well-known/oauth-protected-resource` — metadata
- `/.well-known/oauth-authorization-server` — server metadata
- `/authorize` — OAuth 2.1 authorisation endpoint
- `/token` — OAuth 2.1 token endpoint (with confidential client secret injection)
- `/register` — Dynamic Client Registration (echoes requested `redirect_uris`)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev

# Type check
npm run typecheck

# Run tests
npm test

# Lint
npm run lint

# Secret scan (runs pre-commit via .githooks)
npm run secretlint
```

## Copilot Studio Agents

The `copilot-agents/` directory contains a ready-to-import Microsoft Copilot Studio solution: **18 agents** (1 orchestrator + 17 domain agents) that front-end this MCP server for use in Microsoft Teams and Microsoft 365.

### Architecture

```
CW PSA Orchestrator
├── Work IQ Agent              → /mcp/work-iq (M365: email, Teams, SharePoint, calendar)
├── CW Tickets Agent           → /mcp/tickets
├── CW Time Entries Agent      → /mcp/time-entries
├── CW Companies Agent         → /mcp/companies
├── CW Contacts Agent          → /mcp/contacts
├── CW Configurations Agent    → /mcp/configurations
├── CW Service Boards Agent    → /mcp/service-boards
├── CW Service Config Agent    → /mcp/service-config
├── CW Sales Agent             → /mcp/sales
├── CW Opportunities Agent     → /mcp/opportunities
├── CW Finance Agreements Agent → /mcp/finance-agreements
├── CW Finance Invoices Agent  → /mcp/finance-invoices
├── CW Catalog Agent           → /mcp/catalog
├── CW Procurement Orders Agent → /mcp/procurement-orders
├── CW Procurement Inventory Agent → /mcp/procurement-inventory
├── CW System Members Agent    → /mcp/system-members
├── CW System Admin Agent      → /mcp/system-admin
├── CW Schedule & Expenses Agent → /mcp/schedule-expenses
└── CW Knowledge Base Agent    → /mcp/knowledge-base
```

Each domain endpoint exposes 20–38 tools, staying within the Copilot Studio 70-tool-per-connector cap.

### Prerequisites

1. **Deploy the MCP server** to Azure Container Apps with Entra ID OAuth enabled (see `AZURE_ACA_DEPLOYMENT.md`).
2. **Register an Entra ID app** for the connector with `access_as_user` scope.
3. **Create a custom connector** in your Power Platform environment using the files in `copilot-agents/ConnectWiseConnectors/Connector/`.
4. **Create a connection** from the custom connector (authenticated with your Entra ID app).

### Configuration — replace placeholders before deploying

Before running `create-agents.ps1`, replace the following placeholders:

| Placeholder | Replace with | Files |
|---|---|---|
| `YOUR-ACA-APP.YOUR-ENV-ID.australiaeast.azurecontainerapps.io` | Your ACA FQDN | `create-agents.ps1`, `Connector/apiProperties.json`, `Connector/crc0e_..._openapidefinition.json` |
| `YOUR-CLIENT-ID` | Entra ID app registration client ID | `Connector/apiProperties.json`, `Connector/crc0e_..._connectionparameters.json` |
| `YOUR-ORG` | Dataverse org ID (e.g. `org1a2b3c4d`) | `create-agents.ps1` |
| `YOUR-CONNECTION-ID` | Connection instance GUID from Power Platform | `create-agents.ps1` |
| `YOUR-CONNECTOR-GUID` | Custom connector entity GUID from Dataverse | `create-agents.ps1`, `ConnectWiseConnectors/customizations.xml` |
| `YOUR-CW-CLIENT-ID` | ConnectWise Developer Portal client ID | `Connector/tz_*_openapidefinition.json` (legacy connectors only) |
| `YOUR-TENANT.sharepoint.com` | SharePoint tenant URL | `dvtablesearchs/*/dvtablesearch.xml` (if using SharePoint knowledge) |

### Deploy

```powershell
cd copilot-agents
.\create-agents.ps1
```

The script builds the solution ZIP, pre-creates bot entities in Dataverse, imports the solution, patches agent instructions, and publishes all agents.

### Post-deployment (manual step required)

After every fresh import, connection references must be bound via the Power Platform UI — the Dataverse API alone is insufficient:

1. Go to `make.powerapps.com` → **Solutions** → **ConnectWise Connectors**
2. Select **Connection References**
3. Edit each connection reference → select your connection → **Save**

## Upstream Changes

This fork is based on [WYRE Technology's connectwise-manage-mcp](https://github.com/wyre-technology/connectwise-manage-mcp) at v1.1.0 era. Key upstream changes since fork that are not yet merged:

| Category | Change |
|---|---|
| **Cloudflare Workers** | New `src/worker.ts` entrypoint using Web Standard transport |
| **Server refactor** | `src/mcp-server.ts` extracted from `index.ts` — reusable across transports |
| **Gateway isolation** | Per-request credential resolution, no `process.env` mutation |
| **DCR improvements** | `redirect_uris` echoed back from client request (supports VS Code, Copilot Studio, Foundry) |
| **Extra audiences** | `AZURE_EXTRA_AUDIENCES` for Teams federated connector tokens |
| **TypeScript 6** | Migration to TS6 with flat tsconfig |
| **ESLint 9** | Flat config (`eslint.config.mjs`) |
| **Vitest 4** | Test runner upgrade |
| **GitHub Packages** | Publish to npm.pkg.github.com (not public npm) |
| **Reusable CI** | Centralised release and CI workflows |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Apache-2.0

---

Originally built by [WYRE Technology](https://github.com/wyre-technology) as part of the [MSP Claude Plugins](https://github.com/wyre-technology/msp-claude-plugins) ecosystem. Forked and extended with SENTINEL write-gating, domain profiles, Copilot Studio multi-agent topology, and Azure deployment by [NZCHiLLY](https://github.com/NZCHiLLY).
