/**
 * Unit tests for the gateway URL guard (src/url-guard.ts).
 *
 * Ported from upstream #106 (17f5802bc). The client-level half of upstream's
 * file lives in ssrf.test.ts. Fork addition: the AU cloud host case.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const lookupMock = vi.hoisted(() => vi.fn());
const resolve4Mock = vi.hoisted(() => vi.fn());
const resolve6Mock = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({
  lookup: lookupMock,
  resolve4: resolve4Mock,
  resolve6: resolve6Mock,
}));

import { assertSafeGatewayUrl, isPublicIp, validateGatewayBaseUrl } from "../url-guard.js";

describe("isPublicIp", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "::1", "::", "fd00::1", "fe80::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1",
  ])("rejects %s", (ip) => {
    expect(isPublicIp(ip)).toBe(false);
  });

  it.each(["8.8.8.8", "172.32.0.1", "2606:4700::1111", "::ffff:8.8.8.8"])(
    "accepts %s",
    (ip) => {
      expect(isPublicIp(ip)).toBe(true);
    },
  );
});

describe("assertSafeGatewayUrl", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: "203.0.113.10", family: 4 }]);
  });

  it("accepts an https URL that resolves to a public address", async () => {
    await expect(assertSafeGatewayUrl("https://cw.example.com")).resolves.toBeUndefined();
  });

  it("allows the AU cloud host", async () => {
    await expect(
      assertSafeGatewayUrl("https://api-aus.myconnectwise.net"),
    ).resolves.toBeUndefined();
    expect(lookupMock).toHaveBeenCalledWith("api-aus.myconnectwise.net", { all: true, verbatim: true });
  });

  it.each([
    ["http", "http://cw.example.com"],
    ["credentials", "https://u:p@cw.example.com"],
    ["query", "https://cw.example.com/?probe=1"],
    ["fragment", "https://cw.example.com/chosen#"],
    ["garbage", "not a url"],
  ])("rejects a URL with %s before any DNS lookup", async (_, url) => {
    await expect(assertSafeGatewayUrl(url)).rejects.toThrow();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects a hostname with any non-public address", async () => {
    lookupMock.mockResolvedValue([
      { address: "203.0.113.10", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);
    await expect(assertSafeGatewayUrl("https://cw.example.com")).rejects.toThrow(/non-public/);
  });

  it("rejects a hostname that does not resolve", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(assertSafeGatewayUrl("https://nope.example.com")).rejects.toThrow(/did not resolve/);
  });

  it("checks an IP-literal host without a DNS lookup", async () => {
    await expect(assertSafeGatewayUrl("https://127.0.0.1")).rejects.toThrow(/non-public/);
    await expect(assertSafeGatewayUrl("https://[::1]")).rejects.toThrow(/non-public/);
    await expect(assertSafeGatewayUrl("https://8.8.8.8")).resolves.toBeUndefined();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  describe("when dns.lookup is not implemented (Cloudflare Workers)", () => {
    beforeEach(() => {
      lookupMock.mockRejectedValue(new Error("lookup is not implemented"));
      resolve4Mock.mockReset();
      resolve6Mock.mockReset();
    });

    it("falls back to resolve4/resolve6", async () => {
      resolve4Mock.mockResolvedValue(["203.0.113.10"]);
      resolve6Mock.mockRejectedValue(new Error("ENODATA"));
      await expect(assertSafeGatewayUrl("https://cw.example.com")).resolves.toBeUndefined();
    });

    it("still rejects a non-public address from the fallback", async () => {
      resolve4Mock.mockResolvedValue(["203.0.113.10"]);
      resolve6Mock.mockResolvedValue(["fd00::1"]);
      await expect(assertSafeGatewayUrl("https://cw.example.com")).rejects.toThrow(/non-public/);
    });

    it("keeps the original error as the cause when nothing resolves", async () => {
      resolve4Mock.mockRejectedValue(new Error("ENOTFOUND"));
      resolve6Mock.mockRejectedValue(new Error("ENOTFOUND"));
      const err = await assertSafeGatewayUrl("https://nope.example.com").catch((e) => e);
      expect(err.message).toMatch(/did not resolve/);
      expect((err.cause as Error).message).toMatch(/not implemented/);
    });
  });
});

describe("validateGatewayBaseUrl", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: "203.0.113.10", family: 4 }]);
  });

  it("allows the AU cloud host and returns its origin", async () => {
    await expect(validateGatewayBaseUrl("https://api-aus.myconnectwise.net")).resolves.toBe(
      "https://api-aus.myconnectwise.net",
    );
  });

  it("cuts a URL carrying the API path back to its origin", async () => {
    await expect(
      validateGatewayBaseUrl("https://api-aus.myconnectwise.net/v4_6_release/apis/3.0"),
    ).resolves.toBe("https://api-aus.myconnectwise.net");
  });

  it("rejects what the guard rejects", async () => {
    await expect(validateGatewayBaseUrl("http://api-aus.myconnectwise.net")).rejects.toThrow(/https/);
    await expect(validateGatewayBaseUrl("https://[::1]")).rejects.toThrow(/non-public/);
  });
});
