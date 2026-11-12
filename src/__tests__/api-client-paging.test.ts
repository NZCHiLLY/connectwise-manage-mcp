import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CwManageClient, parseLinkHeader, type CwManageConfig } from "../api-client.js";
import { requestContext } from "../context.js";

const envConfig: CwManageConfig = {
  baseUrl: "https://10.0.0.5",
  companyId: "acme",
  publicKey: "pub",
  privateKey: "priv",
  clientId: "client-1",
};

function fakeResponse(body: unknown, status = 200, link?: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(link === undefined ? {} : { Link: link }),
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const NEXT_LINK =
  '<https://x/apis/3.0/service/tickets?page=3&pageSize=25>; rel="next", <https://x/apis/3.0/service/tickets?page=9&pageSize=25>; rel="last"';

describe("paging from the Link header", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("records the next page when a rel=next link is present", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse([], 200, NEXT_LINK)));
    await requestContext.run({ correlationId: "t" }, async () => {
      await new CwManageClient(envConfig).get("/service/tickets", { page: 2 });
      expect(requestContext.getStore()?.paging).toStrictEqual({ hasMore: true, nextPage: 3 });
    });
  });

  it("records hasMore false when there is no Link header", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse([])));
    await requestContext.run({ correlationId: "t" }, async () => {
      await new CwManageClient(envConfig).get("/service/tickets");
      expect(requestContext.getStore()?.paging).toStrictEqual({ hasMore: false });
    });
  });

  it("records hasMore false on a 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(undefined, 204, NEXT_LINK)));
    await requestContext.run({ correlationId: "t" }, async () => {
      await new CwManageClient(envConfig).request("DELETE", "/service/tickets/1");
      expect(requestContext.getStore()?.paging).toStrictEqual({ hasMore: false });
    });
  });

  it("leaves paging undefined after a failed call that follows a successful one", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse([], 200, NEXT_LINK))
      .mockResolvedValueOnce(fakeResponse("boom", 500));
    vi.stubGlobal("fetch", fetchMock);
    await requestContext.run({ correlationId: "t" }, async () => {
      const client = new CwManageClient(envConfig);
      await client.get("/service/tickets");
      expect(requestContext.getStore()?.paging).toStrictEqual({ hasMore: true, nextPage: 3 });
      await expect(client.get("/service/tickets")).rejects.toThrow(/500/);
      expect(requestContext.getStore()?.paging).toBeUndefined();
    });
  });

  it("does not throw outside a request context", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse([], 200, NEXT_LINK)));
    await expect(new CwManageClient(envConfig).get("/service/tickets")).resolves.toEqual([]);
  });
});

describe("parseLinkHeader", () => {
  it.each([
    ["null", null],
    ["empty", ""],
    ["garbage", "not a link header"],
    ["unclosed bracket", '<https://x/y?page=3; rel="next"'],
    ["next without page", '<https://x/y?pageSize=25>; rel="next"'],
    ["non-numeric page", '<https://x/y?page=abc>; rel="next"'],
    ["only last", '<https://x/y?page=9>; rel="last"'],
    ["invalid url", '<http://[bad>; rel="next"'],
  ])("returns hasMore false for %s", (_, header) => {
    expect(parseLinkHeader(header)).toStrictEqual({ hasMore: false });
  });

  it("finds rel=next whichever order the entries come in", () => {
    expect(
      parseLinkHeader('<https://x/y?page=9>; rel="last", <https://x/y?page=4>; rel="next"'),
    ).toStrictEqual({ hasMore: true, nextPage: 4 });
  });
  it("keeps a URL containing a comma intact", () => {
    expect(
      parseLinkHeader('<https://x/y?fields=id,summary&page=3>; rel="next", <https://x/y?page=9>; rel="last"'),
    ).toStrictEqual({ hasMore: true, nextPage: 3 });
  });

  it("reads the page from a relative URL", () => {
    expect(parseLinkHeader('</service/tickets?page=2>; rel="next"')).toStrictEqual({
      hasMore: true,
      nextPage: 2,
    });
  });

  it("does not treat rel=next-foo as next", () => {
    expect(parseLinkHeader('<https://x/y?page=3>; rel="next-foo"')).toStrictEqual({ hasMore: false });
  });
});
