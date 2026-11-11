/**
 * Request target and Host header handling (upstream issue #102, port of #115).
 *
 * A malformed Host header such as "[" used to throw ERR_INVALID_URL inside the
 * HTTP request listener and end the process. src/index.ts runs main() on
 * import, so the listener cannot be started from a test. These tests cover the
 * exported helpers the listener and the authorise route call, and the OAuth
 * metadata, which must come from MCP_SERVER_URL and never from the request.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isValidHostHeader, parseRequestTarget } from "../request-target.js";
import {
  handleAuthorize,
  handleAuthServerMetadata,
  handleProtectedResource,
} from "../auth/routes.js";
import { getEntraConfig } from "../auth/middleware.js";
import type { EntraConfig } from "../auth/types.js";

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

function fakeRequest(url: string | undefined, host: string | undefined) {
  return { url, headers: { host } } as unknown as IncomingMessage;
}

describe("isValidHostHeader", () => {
  it.each([
    ["a name", "mcp.example.com"],
    ["a name with a port", "localhost:8080"],
    ["an IPv4 address with a port", "127.0.0.1:8080"],
    ["an IPv6 literal with a port", "[::1]:8080"],
    ["a missing header", undefined],
    ["an empty header", ""],
  ])("accepts %s", (_label, host) => {
    expect(isValidHostHeader(host)).toBe(true);
  });

  it.each([
    ["an unclosed bracket (the #102 reproduction)", "["],
    ["a space", "a b"],
    ["a path", "example.com/path"],
    ["userinfo", "user@example.com"],
    ["a query", "example.com?x=1"],
    ["a port that is not a number", "example.com:port"],
  ])("rejects %s", (_label, host) => {
    expect(isValidHostHeader(host)).toBe(false);
  });
});

describe("parseRequestTarget", () => {
  it("parses an origin-form target with its path and query", () => {
    const url = parseRequestTarget("/authorize?state=abc&nonce=1");
    expect(url?.pathname).toBe("/authorize");
    expect(url?.searchParams.get("state")).toBe("abc");
  });

  it("treats a missing target as the root path", () => {
    expect(parseRequestTarget(undefined)?.pathname).toBe("/");
    expect(parseRequestTarget("")?.pathname).toBe("/");
  });

  it.each([
    ["a network-path reference", "//evil.example/mcp"],
    ["an absolute-form target", "http://evil.example/mcp"],
    ["an asterisk-form target", "*"],
    ["an authority-form target", "evil.example:443"],
    ["a relative path", "mcp"],
    ["a backslash network-path reference", "/\\evil.example/health"],
    ["a network-path reference split by a tab", "/\t/evil.example"],
    ["a network-path reference split by a newline", "/\n/evil.example"],
    ["a network-path reference split by a carriage return", "/\r/evil.example/mcp"],
  ])("rejects %s", (_label, target) => {
    expect(parseRequestTarget(target)).toBeNull();
  });

  it("never takes its host from the target", () => {
    expect(parseRequestTarget("/mcp")?.host).toBe("localhost");
  });
});

describe("the listener's guard, as written in src/index.ts", () => {
  // Same expression as the request listener: Host is checked first, then the
  // target is parsed. null is answered with 400 invalid_request.
  const guard = (target: string | undefined, host: string | undefined) =>
    isValidHostHeader(host) ? parseRequestTarget(target) : null;

  it.each([
    ["a malformed Host", "/health", "["],
    ["a Host with a space", "/mcp", "a b"],
    ["a network-path target", "//evil.example/health", "localhost"],
    ["both malformed", "//evil.example/health", "["],
  ])("rejects %s without throwing", (_label, target, host) => {
    expect(() => guard(target, host)).not.toThrow();
    expect(guard(target, host)).toBeNull();
  });

  it("accepts a missing Host header (HTTP/1.0 clients send none)", () => {
    expect(guard("/health", undefined)?.pathname).toBe("/health");
  });
});

describe("handleAuthorize", () => {
  const config = { tenantId: "tenant-guid", clientId: "client-guid" } as EntraConfig;

  it("redirects to Azure AD with the PKCE parameters when Host is malformed", () => {
    const { res, captured } = fakeResponse();

    handleAuthorize(fakeRequest("/authorize?state=abc&code_challenge=xyz", "["), res, config);

    expect(captured.status).toBe(302);
    const location = new URL(String(captured.headers?.Location));
    expect(location.hostname).toBe("login.microsoftonline.com");
    expect(location.searchParams.get("state")).toBe("abc");
    expect(location.searchParams.get("code_challenge")).toBe("xyz");
    expect(location.searchParams.get("client_id")).toBe("client-guid");
  });

  it("answers 400 and does not redirect when the request target is not a path", () => {
    const { res, captured } = fakeResponse();

    handleAuthorize(fakeRequest("//evil.example/authorize", "localhost"), res, config);

    expect(captured.status).toBe(400);
    expect(JSON.parse(String(captured.body))).toEqual({ error: "invalid_request" });
  });
});

describe("OAuth metadata is anchored to MCP_SERVER_URL, not the request host", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds the config serverUrl from MCP_SERVER_URL", () => {
    vi.stubEnv("AZURE_TENANT_ID", "tenant-guid");
    vi.stubEnv("AZURE_CLIENT_ID", "client-guid");
    vi.stubEnv("AZURE_AUDIENCE", "api://client-guid");
    vi.stubEnv("MCP_SERVER_URL", "https://mcp.example.com/");

    expect(getEntraConfig().serverUrl).toBe("https://mcp.example.com");
  });

  const config = {
    tenantId: "tenant-guid",
    clientId: "client-guid",
    serverUrl: "https://mcp.example.com",
  } as EntraConfig;

  it("protected-resource metadata uses serverUrl and takes no request", () => {
    // The handler has no request parameter, so a spoofed Host cannot reach it.
    expect(handleProtectedResource.length).toBe(2);
    const { res, captured } = fakeResponse();

    handleProtectedResource(res, config);

    expect(captured.status).toBe(200);
    const body = JSON.parse(String(captured.body));
    expect(body.resource).toBe("https://mcp.example.com/mcp");
    expect(body.authorization_servers).toEqual(["https://mcp.example.com"]);
  });

  it("authorisation-server metadata uses serverUrl and takes no request", () => {
    expect(handleAuthServerMetadata.length).toBe(2);
    const { res, captured } = fakeResponse();

    handleAuthServerMetadata(res, config);

    const body = JSON.parse(String(captured.body));
    expect(body.issuer).toBe("https://mcp.example.com");
    expect(body.token_endpoint).toBe("https://mcp.example.com/token");
  });
});
