#!/usr/bin/env node
/**
 * ConnectWise Manage MCP Server
 *
 * Provides MCP tools for interacting with the ConnectWise Manage (PSA) REST API.
 * Supports both cloud-hosted and self-hosted ConnectWise Manage instances.
 *
 * Required environment variables:
 *   CW_MANAGE_COMPANY_ID        - Your ConnectWise company identifier
 *   CW_MANAGE_PUBLIC_KEY        - API member public key
 *   CW_MANAGE_PRIVATE_KEY       - API member private key
 *   CW_MANAGE_CLIENT_ID         - Client ID from ConnectWise Developer Portal
 *
 * Optional environment variables:
 *   CW_MANAGE_URL               - API base URL (default: https://api-na.myconnectwise.net)
 *                                  Cloud: api-na.myconnectwise.net, api-eu.myconnectwise.net, api-au.myconnectwise.net
 *                                  Self-hosted: https://cwm.yourcompany.com (or with full path)
 *   CW_MANAGE_REJECT_UNAUTHORIZED - Set to "false" for self-signed certs (default: "true")
 *   MCP_TRANSPORT               - "stdio" (default) or "http"
 *   MCP_HTTP_PORT               - HTTP port (default: 8080)
 *   MCP_HTTP_HOST               - HTTP host (default: 0.0.0.0)
 *   AUTH_MODE                   - "env" (default) or "gateway" for header-based auth
 *
 * Entra ID OAuth 2.1 (optional — set MCP_OAUTH_ENABLED=true to activate):
 *   MCP_OAUTH_ENABLED           - Enable Entra ID auth middleware (default: false)
 *   MCP_SERVER_URL              - Full public URL of this server (e.g. https://mcp.yourdomain.com)
 *   AZURE_TENANT_ID             - Entra tenant GUID
 *   AZURE_CLIENT_ID             - App registration client ID
 *   AZURE_AUDIENCE              - Token audience, typically api://<AZURE_CLIENT_ID>
 *   AZURE_REQUIRED_ROLE         - App role claim required on every request (default: CWM.Access)
 *   MCP_BEARER_TOKEN            - Static bearer token for Claude Code CLI / Claude Desktop
 *
 * Tool profile selection — URL path takes precedence, JWT role is fallback:
 *   /mcp/l1  → L1 helpdesk engineer profile (65 tools)
 *   /mcp/l2  → L2 management profile (70 tools)
 *   /mcp     → full tool set (JWT role or MCP_TOOL_PROFILE env var applies)
 *   Azure AD app role "CWM.L1" / "CWM.L2" → profile fallback when hitting /mcp directly
 */

import {
  createServer,
  IncomingMessage,
  ServerResponse,
  Server as HttpServer,
} from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { getConfig, CwManageClient, CwManageConfig } from "./api-client.js";
import { getEntraConfig, createJwksClient, validateToken } from "./auth/middleware.js";
import {
  handleProtectedResource,
  handleAuthServerMetadata,
  handleRegister,
  handleAuthorize,
  handleToken,
} from "./auth/routes.js";
import { AuthError } from "./auth/types.js";
import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
const _pkg = _require("../package.json") as { version: string };
import { applyToolProfile, profileFromRoles } from "./tools/profiles.js";
import { requestContext, newCorrelationId } from "./context.js";
import { registerActivityTools }      from "./tools/activities.js";
import { registerCatalogTools }       from "./tools/catalog.js";
import { registerCompanyTools }       from "./tools/companies.js";
import { registerConfigurationTools } from "./tools/configurations.js";
import { registerContactTools }       from "./tools/contacts.js";
import { registerExpenseTools }       from "./tools/expenses.js";
import { registerFinanceTools }       from "./tools/finance.js";
import { registerHealthTools }        from "./tools/health.js";
import { registerMarketingTools }     from "./tools/marketing.js";
import { registerOpportunityTools }   from "./tools/opportunities.js";
import { registerProcurementTools }   from "./tools/procurement.js";
import { registerProjectTools }       from "./tools/projects.js";
import { registerSalesTools }         from "./tools/sales.js";
import { registerScheduleTools }      from "./tools/schedule.js";
import { registerServiceTools }       from "./tools/service.js";
import { registerSystemTools }        from "./tools/system.js";
import { registerTicketTools }        from "./tools/tickets.js";
import { registerTimeEntryTools }     from "./tools/time-entries.js";

// ---------------------------------------------------------------------------
// Security headers applied to every HTTP response
// ---------------------------------------------------------------------------

function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Content-Security-Policy", "default-src 'none'");
}

// ---------------------------------------------------------------------------
// Gateway mode: X-CW-URL validation
// Prevents SSRF by rejecting non-HTTPS URLs and private/loopback addresses.
// ---------------------------------------------------------------------------

const PRIVATE_ADDR =
  /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|0\.0\.0\.0$|::1$|fc00:|fd)/i;

function validateCwBaseUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("X-CW-URL is not a valid URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("X-CW-URL must use HTTPS");
  }
  if (PRIVATE_ADDR.test(parsed.hostname)) {
    throw new Error("X-CW-URL must not target a private or loopback address");
  }
  return parsed.origin;
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

function createMcpServer(config?: CwManageConfig, toolProfile?: string): McpServer {
  const server = new McpServer({
    name: "connectwise-manage-mcp",
    version: _pkg.version,
  });

  const resolvedConfig = config ?? getConfig();

  if (!resolvedConfig) {
    // Register a single diagnostic tool so the client gets a clear error
    server.tool(
      "cw_test_connection",
      "Test the connection to ConnectWise Manage.",
      {},
      async () => ({
        content: [
          {
            type: "text",
            text: [
              "Error: Missing ConnectWise Manage credentials.",
              "",
              "Required environment variables:",
              "  CW_MANAGE_COMPANY_ID        - Your ConnectWise company identifier",
              "  CW_MANAGE_PUBLIC_KEY        - API member public key",
              "  CW_MANAGE_PRIVATE_KEY       - API member private key",
              "  CW_MANAGE_CLIENT_ID         - Client ID from ConnectWise Developer Portal",
              "",
              "Optional:",
              "  CW_MANAGE_URL               - API base URL",
              "    Cloud:       https://api-na.myconnectwise.net (default)",
              "                 https://api-eu.myconnectwise.net",
              "                 https://api-au.myconnectwise.net",
              "    Self-hosted: https://cwm.yourcompany.com",
              "  CW_MANAGE_REJECT_UNAUTHORIZED - Set to 'false' for self-signed certs",
            ].join("\n"),
          },
        ],
        isError: true,
      }),
    );
    return server;
  }

  const client = new CwManageClient(resolvedConfig);
  const toolServer = applyToolProfile(server, toolProfile ?? process.env.MCP_TOOL_PROFILE);

  registerActivityTools(toolServer, client);
  registerCatalogTools(toolServer, client);
  registerCompanyTools(toolServer, client);
  registerConfigurationTools(toolServer, client);
  registerContactTools(toolServer, client);
  registerExpenseTools(toolServer, client);
  registerFinanceTools(toolServer, client);
  registerHealthTools(toolServer, client);
  registerMarketingTools(toolServer, client);
  registerOpportunityTools(toolServer, client);
  registerProcurementTools(toolServer, client);
  registerProjectTools(toolServer, client);
  registerSalesTools(toolServer, client);
  registerScheduleTools(toolServer, client);
  registerServiceTools(toolServer, client);
  registerSystemTools(toolServer, client);
  registerTicketTools(toolServer, client);
  registerTimeEntryTools(toolServer, client);

  return server;
}

// ---------------------------------------------------------------------------
// Transport: stdio
// ---------------------------------------------------------------------------

async function startStdioTransport(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ConnectWise Manage MCP server running on stdio");
}

// ---------------------------------------------------------------------------
// Transport: HTTP (StreamableHTTPServerTransport)
// ---------------------------------------------------------------------------

let httpServer: HttpServer | undefined;

async function startHttpTransport(): Promise<void> {
  const port = parseInt(process.env.MCP_HTTP_PORT || "8080", 10);
  const host = process.env.MCP_HTTP_HOST || "0.0.0.0";
  const authMode = process.env.AUTH_MODE || "env";
  const isGatewayMode = authMode === "gateway";

  // ---------------------------------------------------------------------------
  // Entra ID auth setup (optional)
  // ---------------------------------------------------------------------------
  const oauthEnabled = process.env.MCP_OAUTH_ENABLED === "true";
  let entraConfig: ReturnType<typeof getEntraConfig> | null = null;
  let jwksClient: ReturnType<typeof createJwksClient> | null = null;

  if (oauthEnabled) {
    entraConfig = getEntraConfig();
    jwksClient = createJwksClient(entraConfig);
    console.error(
      `[auth] Entra ID OAuth enabled — tenant: ${entraConfig.tenantId}, required role: ${entraConfig.requiredRole}`,
    );
    if (entraConfig.bearerToken) {
      console.error("[auth] Static bearer token fallback enabled (CLI/Desktop)");
    }
  }

  httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    requestContext.run({ correlationId: newCorrelationId() }, () => {
    applySecurityHeaders(res);
    const url = new URL(
      req.url || "/",
      `http://${req.headers.host || "localhost"}`,
    );

    // ------------------------------------------------------------------
    // OAuth discovery + proxy endpoints (always available when OAuth on)
    // ------------------------------------------------------------------
    if (oauthEnabled && entraConfig) {
      if (
        url.pathname === "/.well-known/oauth-protected-resource" &&
        req.method === "GET"
      ) {
        handleProtectedResource(res, entraConfig);
        return;
      }

      if (
        url.pathname === "/.well-known/oauth-authorization-server" &&
        req.method === "GET"
      ) {
        handleAuthServerMetadata(res, entraConfig);
        return;
      }

      if (url.pathname === "/register" && req.method === "POST") {
        handleRegister(req, res, entraConfig).catch((err) => {
          console.error("[auth] /register error:", err);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "internal_error" }));
          }
        });
        return;
      }

      if (url.pathname === "/authorize" && req.method === "GET") {
        handleAuthorize(req, res, entraConfig);
        return;
      }

      if (url.pathname === "/token" && req.method === "POST") {
        handleToken(req, res, entraConfig).catch((err) => {
          console.error("[auth] /token error:", err);
          if (!res.headersSent) {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "token_proxy_error" }));
          }
        });
        return;
      }
    }

    // Health endpoint
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          transport: "http",
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    // MCP endpoints — Copilot Studio appends /mcp to whatever Server URL is set.
    // Configure Server URL in Copilot Studio as: https://<domain>/<profile>
    // e.g. https://domain/l1  →  Copilot Studio hits /l1/mcp  →  L1 profile
    //      https://domain/l2  →  Copilot Studio hits /l2/mcp  →  L2 profile
    //      https://domain     →  Copilot Studio hits /mcp      →  full/role fallback
    // Direct (non-Copilot-Studio) patterns also supported: /mcp/l1, /mcp/l2, /mcp/full
    // Path segment overrides JWT role; JWT role overrides MCP_TOOL_PROFILE env var.
    const mcpDirect   = /^\/mcp(?:\/(l1|l2|full))?\/?$/.exec(url.pathname);       // /mcp /mcp/l1
    const mcpPrefixed = /^\/(l1|l2|full)\/mcp\/?$/.exec(url.pathname);            // /l1/mcp
    const mcpNested   = /^\/mcp\/(l1|l2|full)\/mcp\/?$/.exec(url.pathname);       // /mcp/l1/mcp
    const mcpPathMatch = mcpDirect ?? mcpPrefixed ?? mcpNested;
    if (mcpPathMatch) {
      const urlProfile = mcpPathMatch[1] as string | undefined; // "l1" | "l2" | "full" | undefined

      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Method not allowed" },
            id: null,
          }),
        );
        return;
      }

      // ------------------------------------------------------------------
      // Entra ID auth check
      // ------------------------------------------------------------------
      const handleMcp = async () => {
        let roleToolProfile: string | undefined;

        if (oauthEnabled && entraConfig) {
          const authHeader = req.headers.authorization;

          if (!authHeader?.startsWith("Bearer ")) {
            res.writeHead(401, {
              "Content-Type": "application/json",
              "WWW-Authenticate": `Bearer resource_metadata="${entraConfig.serverUrl}/.well-known/oauth-protected-resource"`,
            });
            res.end(
              JSON.stringify({
                error: "unauthorized",
                message: "Bearer token required",
              }),
            );
            return;
          }

          const token = authHeader.slice(7);

          let identity: { upn: string; roles: string[]; oid: string } | undefined;
          try {
            // Static bearer token check (Claude Code CLI / Claude Desktop)
            // Use timing-safe comparison to prevent token length oracle attacks
            const staticTokenMatch =
              entraConfig.bearerToken !== undefined &&
              timingSafeEqual(
                createHash("sha256").update(token).digest(),
                createHash("sha256").update(entraConfig.bearerToken).digest(),
              );
            if (staticTokenMatch) {
              identity = {
                upn: "cli-user",
                roles: [entraConfig.requiredRole],
                oid: "static",
              };
            } else {
              identity = await validateToken(token, entraConfig, jwksClient!);
            }
            console.error(
              `[audit] ${identity.oid} | ${new Date().toISOString()} | POST ${url.pathname} | cid:${requestContext.getStore()?.correlationId ?? "-"}`,
            );
          } catch (err) {
            if (err instanceof AuthError) {
              res.writeHead(err.statusCode, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "auth_failed", message: err.message }));
            } else {
              console.error("[auth] Unexpected validation error:", err);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "internal_error" }));
            }
            return;
          }

          roleToolProfile = profileFromRoles(identity!.roles);
          if (roleToolProfile) {
            console.error(`[mcp] Role-derived tool profile: "${roleToolProfile}" (roles: [${identity!.roles.join(", ")}])`);
          }
        }

        // ------------------------------------------------------------------
        // Gateway mode: extract CW credentials from headers
        // ------------------------------------------------------------------
        let gatewayConfig: CwManageConfig | undefined;
        if (isGatewayMode) {
          const headers = req.headers as Record<
            string,
            string | string[] | undefined
          >;
          const companyId = headers["x-cw-company-id"] as string | undefined;
          const publicKey = headers["x-cw-public-key"] as string | undefined;
          const privateKey = headers["x-cw-private-key"] as string | undefined;
          const clientId = headers["x-cw-client-id"] as string | undefined;
          const baseUrl = headers["x-cw-url"] as string | undefined;

          if (!companyId || !publicKey || !privateKey || !clientId) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "Missing credentials",
                message:
                  "Gateway mode requires X-CW-Company-Id, X-CW-Public-Key, X-CW-Private-Key, and X-CW-Client-Id headers",
                required: [
                  "X-CW-Company-Id",
                  "X-CW-Public-Key",
                  "X-CW-Private-Key",
                  "X-CW-Client-Id",
                ],
              }),
            );
            return;
          }

          // Build config directly — do not route through process.env (race condition)
          let validatedBaseUrl: string;
          if (baseUrl) {
            try {
              validatedBaseUrl = validateCwBaseUrl(baseUrl);
            } catch (err) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "invalid_url", message: (err as Error).message }));
              return;
            }
          } else {
            validatedBaseUrl = (process.env.CW_MANAGE_URL || "https://api-na.myconnectwise.net").replace(/\/+$/, "");
          }

          gatewayConfig = {
            companyId,
            publicKey,
            privateKey,
            clientId,
            baseUrl: validatedBaseUrl,
          };
        }

        // ------------------------------------------------------------------
        // MCP handler — URL profile takes precedence over JWT role
        // ------------------------------------------------------------------
        const effectiveProfile = urlProfile ?? roleToolProfile;
        const server = createMcpServer(gatewayConfig, effectiveProfile);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });

        res.on("close", () => {
          transport.close();
          server.close();
        });

        await server.connect(transport as unknown as Transport);
        transport.handleRequest(req, res);
      };

      handleMcp().catch((err) => {
        console.error("MCP transport error:", err);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32603, message: "Internal error" },
              id: null,
            }),
          );
        }
      });

      return;
    }

    // 404 for everything else
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Not found",
        endpoints: ["/mcp", "/mcp/l1", "/mcp/l2", "/mcp/full", "/health"],
      }),
    );
    }); // end requestContext.run
  });

  await new Promise<void>((resolve) => {
    httpServer!.listen(port, host, () => {
      console.error(`ConnectWise Manage MCP server listening on http://${host}:${port}`);
      console.error(`  Copilot Studio Server URL → profile:`);
      console.error(`    https://<domain>/l1  →  L1 helpdesk engineer (65 tools)`);
      console.error(`    https://<domain>/l2  →  L2 management (70 tools)`);
      console.error(`    https://<domain>     →  full tool set (JWT role / env fallback)`);
      console.error(`  /health — health check`);
      console.error(
        `Authentication mode: ${isGatewayMode ? "gateway (header-based)" : "env (environment variables)"}`,
      );
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function setupShutdownHandlers(): void {
  const shutdown = async () => {
    console.error("Shutting down ConnectWise Manage MCP server...");
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  setupShutdownHandlers();

  const transportType = process.env.MCP_TRANSPORT || "stdio";

  if (transportType === "http") {
    await startHttpTransport();
  } else {
    await startStdioTransport();
  }
}

main().catch(console.error);
