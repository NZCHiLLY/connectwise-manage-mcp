import type { EntraConfig } from "./types.js";

// Copilot Studio appends /mcp to its Server URL, so three shapes reach the
// listener: /mcp[/profile], /profile/mcp and /mcp/profile/mcp.
const MCP_DIRECT = /^\/mcp(?:\/([a-z0-9-]+))?\/?$/;
const MCP_PREFIXED = /^\/([a-z0-9-]+)\/mcp\/?$/;
const MCP_NESTED = /^\/mcp\/([a-z0-9-]+)\/mcp\/?$/;

const WELL_KNOWN_PRM = "/.well-known/oauth-protected-resource";

export interface McpPathMatch {
  path: string;
  profile: string | undefined;
}

export function matchMcpPath(pathname: string): McpPathMatch | null {
  const m = MCP_DIRECT.exec(pathname) ?? MCP_PREFIXED.exec(pathname) ?? MCP_NESTED.exec(pathname);
  if (!m) return null;
  return { path: pathname.replace(/\/$/, ""), profile: m[1] };
}

// RFC 9728 3.1: a client inserts the well-known string between the host and
// the resource's path, so /mcp/l1 is described at
// /.well-known/oauth-protected-resource/mcp/l1. The bare document keeps
// describing /mcp, which is what it always said.
export function metadataPathFor(pathname: string): string | null {
  if (pathname === WELL_KNOWN_PRM || pathname === `${WELL_KNOWN_PRM}/`) return "/mcp";
  if (!pathname.startsWith(`${WELL_KNOWN_PRM}/`)) return null;
  return matchMcpPath(pathname.slice(WELL_KNOWN_PRM.length))?.path ?? null;
}

export function protectedResourceMetadataUrl(config: EntraConfig, mcpPath: string): string {
  return `${config.serverUrl}${WELL_KNOWN_PRM}${mcpPath}`;
}

export function bearerChallenge(
  config: EntraConfig,
  mcpPath: string,
  error?: "invalid_token",
  description?: string,
): string {
  let value = `Bearer resource_metadata="${protectedResourceMetadataUrl(config, mcpPath)}"`;
  if (error) {
    value += `, error="${error}"`;
    if (description) value += `, error_description="${safeLogValue(description)}"`;
  }
  return value;
}

// Header and log safe: no control characters, no quotes (both end up inside a
// quoted-string), bounded so a hostile User-Agent cannot flood the log.
export function safeLogValue(value: string | undefined): string {
  if (!value) return "-";
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f"\\]/g, "");
  return cleaned.slice(0, 120) || "-";
}

// The only record of a token exchange. Holds no token value: the body is read
// for its shape and Entra's error code, nothing else.
export function summariseTokenExchange(
  grantType: string | undefined,
  status: number,
  body: string,
  ms: number,
  userAgent: string | undefined,
): string {
  let parsed: Record<string, unknown> = {};
  try {
    const value: unknown = JSON.parse(body);
    if (value && typeof value === "object") parsed = value as Record<string, unknown>;
  } catch {
    // non-JSON body, logged as unknown below
  }
  const head = `[token] grant=${safeLogValue(grantType)} status=${status}`;
  const tail = `ms=${ms} ua=${safeLogValue(userAgent)}`;
  if (status === 200) {
    const rt = typeof parsed.refresh_token === "string" && parsed.refresh_token ? "yes" : "no";
    const exp = typeof parsed.expires_in === "number" || typeof parsed.expires_in === "string" ? String(parsed.expires_in) : "-";
    const rtExp =
      typeof parsed.refresh_token_expires_in === "number" || typeof parsed.refresh_token_expires_in === "string"
        ? String(parsed.refresh_token_expires_in)
        : "-";
    return `${head} refresh_token=${rt} expires_in=${safeLogValue(exp)} refresh_token_expires_in=${safeLogValue(rtExp)} ${tail}`;
  }
  const error = typeof parsed.error === "string" ? parsed.error : undefined;
  const description = typeof parsed.error_description === "string" ? parsed.error_description : "";
  const aadsts = /AADSTS(\d+)/.exec(description)?.[1];
  return `${head} error=${safeLogValue(error)} aadsts=${aadsts ?? "-"} ${tail}`;
}
