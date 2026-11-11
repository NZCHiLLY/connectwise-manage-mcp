/**
 * Gateway SSRF guard, as seen from the ConnectWise client.
 *
 * Ported from upstream #106 (17f5802bc, src/__tests__/gateway-url-guard.test.ts,
 * "CwManageClient with a gateway-supplied URL"). This file imports only the
 * client and the gateway config resolver, so each case fails on the
 * unguarded client for a behavioural reason rather than a missing module.
 *
 * Fork additions: the AU cloud host (production) is allowed, and a ConnectWise
 * error body still reaches the caller verbatim (the fork does not take #116).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const lookupMock = vi.hoisted(() => vi.fn());
const resolve4Mock = vi.hoisted(() => vi.fn());
const resolve6Mock = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({
  lookup: lookupMock,
  resolve4: resolve4Mock,
  resolve6: resolve6Mock,
}));

import { CwManageClient, type CwManageConfig } from "../api-client.js";
import { resolveGatewayConfig } from "../mcp-server.js";

function fakeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function gatewayConfig(url: string | undefined): CwManageConfig {
  const headers: Record<string, string | undefined> = {
    "x-cw-company-id": "acme",
    "x-cw-public-key": "pub",
    "x-cw-private-key": "priv",
    "x-cw-client-id": "client-1",
    "x-cw-url": url,
  };
  return resolveGatewayConfig((name) => headers[name]).config!;
}

const envConfig: CwManageConfig = {
  baseUrl: "https://10.0.0.5",
  companyId: "acme",
  publicKey: "pub",
  privateKey: "priv",
  clientId: "client-1",
};

describe("CwManageClient with a gateway-supplied URL", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: "203.0.113.10", family: 4 }]);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("allows the AU cloud host", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await new CwManageClient(gatewayConfig("https://api-aus.myconnectwise.net")).get("/system/info");

    expect(lookupMock).toHaveBeenCalledWith("api-aus.myconnectwise.net", expect.anything());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api-aus.myconnectwise.net/v4_6_release/apis/3.0/system/info",
    );
  });

  it("asks fetch not to follow redirects and sets a timeout on every request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await new CwManageClient(gatewayConfig("https://cw.example.com")).get("/system/info");

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.redirect).toBe("manual");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws on a redirect response without following it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({}, 302));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new CwManageClient(gatewayConfig("https://cw.example.com")).get("/system/info"),
    ).rejects.toThrow(/redirect \(HTTP 302\)/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("re-checks the hostname on every request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new CwManageClient(gatewayConfig("https://cw.example.com"));

    await client.get("/system/info");
    lookupMock.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);

    await expect(client.get("/system/info")).rejects.toThrow(/non-public/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never fetches the reporter's loopback URL", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const client = new CwManageClient(gatewayConfig("http://127.0.0.1:8080/chosen?probe=1#"));

    await expect(client.get("/system/info")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // The fork's old entry check (a hostname regex) let both of these through:
  // URL.hostname keeps the brackets on an IPv6 literal, and a public-looking
  // name that resolves to a private address never matched at all.
  it.each([
    ["an IPv6 loopback literal", "https://[::1]", undefined],
    ["a hostname resolving to a private address", "https://cw.example.com", "10.0.0.5"],
  ])("never fetches %s", async (_, url, resolvesTo) => {
    if (resolvesTo) lookupMock.mockResolvedValue([{ address: resolvesTo, family: 4 }]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(new CwManageClient(gatewayConfig(url)).get("/system/info")).rejects.toThrow(
      /non-public/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not look up the default cloud URL when no header is sent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await new CwManageClient(gatewayConfig(undefined)).get("/system/info");

    expect(lookupMock).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][0]).toMatch(/^https:\/\/api-na\.myconnectwise\.net\//);
  });

  it("does not check an env-mode URL, so LAN self-hosters keep working", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await new CwManageClient(envConfig).get("/system/info");

    expect(lookupMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    // Env mode still follows redirects (a self-hosted API may 301 to its
    // canonical HTTPS origin). Gateway mode alone uses redirect: "manual".
    expect(options.redirect).toBe("follow");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("ConnectWise error text", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: "203.0.113.10", family: 4 }]);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // The fork deliberately keeps ConnectWise's own error body in the thrown
  // message (upstream #116 replaces it with a reference id and is not taken).
  const body =
    '{"code":"InvalidObject","message":"ticket object is invalid","errors":[{"code":"NullValue","message":"The summary field is required.","resource":"ticket","field":"summary"}]}';

  it.each([
    ["env mode", () => envConfig],
    ["gateway mode", () => gatewayConfig("https://api-aus.myconnectwise.net")],
  ])("keeps a 400 response body verbatim in the thrown message (%s)", async (_, config) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(body, 400)));

    const err = await new CwManageClient(config())
      .post("/service/tickets", {})
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe(`ConnectWise API error 400: ${body}`);
  });
});
