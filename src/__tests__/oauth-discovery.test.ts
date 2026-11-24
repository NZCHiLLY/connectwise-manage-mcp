/**
 * Connector re-authentication (Nov 2026). Claude.ai connectors were dropping
 * and needing a manual reconnect while Entra accepted every refresh. Two spec
 * breaches sit on the path a client takes when a token stops working:
 *
 * - MCP authorization 2025-06-18: "MCP servers MUST use the HTTP header
 *   WWW-Authenticate when returning a 401 Unauthorized." An invalid or expired
 *   token was answered 401 with no header.
 * - RFC 9728 section 3.3: the metadata "resource" value "MUST be identical to"
 *   the resource identifier the client used, and "If these values are not
 *   identical, the data contained in the response MUST NOT be used." Every
 *   connector lives on a path (/mcp/l1, /mcp/sales), the path-suffixed
 *   metadata URL 404'd, and the root document said resource=.../mcp.
 */

import { describe, expect, it } from "vitest";
import type { ServerResponse } from "node:http";
import {
  bearerChallenge,
  matchMcpPath,
  metadataPathFor,
  protectedResourceMetadataUrl,
  safeLogValue,
  summariseTokenExchange,
} from "../auth/discovery.js";
import { handleProtectedResource } from "../auth/routes.js";
import type { EntraConfig } from "../auth/types.js";

const config = {
  tenantId: "tenant-guid",
  clientId: "client-guid",
  serverUrl: "https://mcp.example.com",
} as EntraConfig;

function fakeResponse() {
  const captured: { status?: number; headers?: Record<string, unknown>; body?: string } = {};
  const res = {
    writeHead(status: number, headers?: Record<string, unknown>) {
      captured.status = status;
      captured.headers = headers;
      return res;
    },
    end(body?: string) {
      captured.body = body;
    },
  } as unknown as ServerResponse;
  return { res, captured };
}

describe("matchMcpPath", () => {
  it.each([
    ["/mcp", "/mcp", undefined],
    ["/mcp/", "/mcp", undefined],
    ["/mcp/l1", "/mcp/l1", "l1"],
    ["/mcp/sales/", "/mcp/sales", "sales"],
    ["/l2/mcp", "/l2/mcp", "l2"],
    ["/mcp/l3/mcp", "/mcp/l3/mcp", "l3"],
  ])("matches %s", (pathname, path, profile) => {
    expect(matchMcpPath(pathname)).toEqual({ path, profile });
  });

  it.each(["/", "/health", "/mcp/L1", "/mcp/a/b", "/token", "/mcp/../token"])(
    "does not match %s",
    (pathname) => {
      expect(matchMcpPath(pathname)).toBeNull();
    },
  );
});

describe("metadataPathFor", () => {
  it("returns the MCP path for a path-suffixed well-known request", () => {
    expect(metadataPathFor("/.well-known/oauth-protected-resource/mcp/l1")).toBe("/mcp/l1");
    expect(metadataPathFor("/.well-known/oauth-protected-resource/mcp/sales/")).toBe("/mcp/sales");
    expect(metadataPathFor("/.well-known/oauth-protected-resource/l2/mcp")).toBe("/l2/mcp");
  });

  it("keeps the root document on /mcp", () => {
    expect(metadataPathFor("/.well-known/oauth-protected-resource")).toBe("/mcp");
  });

  it("refuses a suffix that is not an MCP endpoint", () => {
    expect(metadataPathFor("/.well-known/oauth-protected-resource/token")).toBeNull();
    expect(metadataPathFor("/.well-known/oauth-protected-resource/mcp/a/b")).toBeNull();
    expect(metadataPathFor("/.well-known/oauth-authorization-server")).toBeNull();
  });
});

describe("protected resource metadata matches the URL the client used (RFC 9728 3.3)", () => {
  it("names the connector's own path as the resource", () => {
    const { res, captured } = fakeResponse();
    handleProtectedResource(res, config, "/mcp/l1");
    const body = JSON.parse(String(captured.body));
    expect(captured.status).toBe(200);
    expect(body.resource).toBe("https://mcp.example.com/mcp/l1");
    expect(body.authorization_servers).toEqual(["https://mcp.example.com"]);
  });

  it("still answers /mcp for the root document", () => {
    const { res, captured } = fakeResponse();
    handleProtectedResource(res, config);
    expect(JSON.parse(String(captured.body)).resource).toBe("https://mcp.example.com/mcp");
  });

  it("points the challenge at metadata whose resource is that same URL", () => {
    expect(protectedResourceMetadataUrl(config, "/mcp/sales")).toBe(
      "https://mcp.example.com/.well-known/oauth-protected-resource/mcp/sales",
    );
    expect(protectedResourceMetadataUrl(config, "/mcp")).toBe(
      "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
    );
  });
});

describe("bearerChallenge (WWW-Authenticate on every 401)", () => {
  it("carries resource_metadata for the connector's path when no token was sent", () => {
    expect(bearerChallenge(config, "/mcp/l2")).toBe(
      'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/mcp/l2"',
    );
  });

  it("adds error=invalid_token when a token was rejected", () => {
    expect(bearerChallenge(config, "/mcp/l2", "invalid_token", 'Invalid token: "exp" claim timestamp check failed')).toBe(
      'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/mcp/l2", ' +
        'error="invalid_token", error_description="Invalid token: exp claim timestamp check failed"',
    );
  });
});

describe("summariseTokenExchange never logs a token value", () => {
  const secretBody = JSON.stringify({
    token_type: "Bearer",
    expires_in: 4384,
    access_token: "eyJ.SECRET-ACCESS.sig",
    refresh_token: "0.SECRET-REFRESH",
    id_token: "eyJ.SECRET-ID.sig",
  });

  it("records grant, status and what came back", () => {
    const line = summariseTokenExchange("refresh_token", 200, secretBody, 312, "node");
    expect(line).toBe(
      "[token] grant=refresh_token status=200 refresh_token=yes expires_in=4384 refresh_token_expires_in=- ms=312 ua=node",
    );
    expect(line).not.toContain("SECRET");
  });

  it("records the Entra error code on a rejection", () => {
    const body = JSON.stringify({ error: "invalid_grant", error_description: "AADSTS700084: The refresh token was issued to a single page app" });
    expect(summariseTokenExchange("refresh_token", 400, body, 90, "Claude-User")).toBe(
      "[token] grant=refresh_token status=400 error=invalid_grant aadsts=700084 ms=90 ua=Claude-User",
    );
  });

  it("copes with a body that is not JSON", () => {
    expect(summariseTokenExchange(undefined, 502, "<html>", 5, undefined)).toBe(
      "[token] grant=- status=502 error=- aadsts=- ms=5 ua=-",
    );
  });
});

describe("safeLogValue", () => {
  it("strips control characters and quotes, and caps length", () => {
    expect(safeLogValue('a\r\nb\t"c"')).toBe("abc");
    expect(safeLogValue("x".repeat(300))).toHaveLength(120);
    expect(safeLogValue(undefined)).toBe("-");
  });
});
