import { describe, it, expect, vi, beforeEach } from "vitest";
import { requestContext } from "../context.js";
import { resolveCallerMemberId, __resetAttributionCache } from "../attribution.js";
import type { CwManageClient } from "../api-client.js";

const UPN = "jayson.chilman@tomizone.com";

function fakeClient(result: unknown, instance = { companyId: "tomizone", apiBase: "https://a/v4_6_release/apis/3.0" }) {
  const get = vi.fn().mockResolvedValue(result);
  return { client: { get, ...instance } as unknown as CwManageClient, get };
}

function asCaller<T>(identity: { upn: string; oid: string } | undefined, fn: () => Promise<T>): Promise<T> {
  return requestContext.run({ correlationId: "c", ...(identity && { identity }) }, fn);
}

describe("resolveCallerMemberId", () => {
  beforeEach(() => {
    __resetAttributionCache();
  });

  it("one active member resolves", async () => {
    const { client, get } = fakeClient([{ id: 154 }]);
    const id = await asCaller({ upn: UPN, oid: "o1" }, () => resolveCallerMemberId(client));
    expect(id).toBe(154);
    expect(get).toHaveBeenCalledWith("/system/members", {
      conditions: `officeEmail = "${UPN}" and inactiveFlag = false`,
      fields: "id",
      pageSize: 2,
    });
  });

  it("two members is unresolved", async () => {
    const { client } = fakeClient([{ id: 154 }, { id: 155 }]);
    const id = await asCaller({ upn: UPN, oid: "o1" }, () => resolveCallerMemberId(client));
    expect(id).toBeUndefined();
  });

  it("no member is unresolved", async () => {
    const { client } = fakeClient([]);
    const id = await asCaller({ upn: UPN, oid: "o1" }, () => resolveCallerMemberId(client));
    expect(id).toBeUndefined();
  });

  it("no identity is not looked up", async () => {
    const { client, get } = fakeClient([{ id: 154 }]);
    const id = await asCaller(undefined, () => resolveCallerMemberId(client));
    expect(id).toBeUndefined();
    expect(get).not.toHaveBeenCalled();
  });

  it("static caller is not looked up", async () => {
    const { client, get } = fakeClient([{ id: 154 }]);
    const id = await asCaller({ upn: "cli-user", oid: "static" }, () => resolveCallerMemberId(client));
    expect(id).toBeUndefined();
    expect(get).not.toHaveBeenCalled();
  });

  it("rejects a upn with a quote", async () => {
    const { client, get } = fakeClient([{ id: 154 }]);
    const id = await asCaller({ upn: 'a" or id > 0 or "b@tomizone.com', oid: "o1" }, () => resolveCallerMemberId(client));
    expect(id).toBeUndefined();
    expect(get).not.toHaveBeenCalled();
  });

  it("caches per upn", async () => {
    const { client, get } = fakeClient([{ id: 154 }]);
    const run = () => asCaller({ upn: UPN, oid: "o1" }, () => resolveCallerMemberId(client));
    expect(await run()).toBe(154);
    expect(await run()).toBe(154);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("does not cache an unresolved lookup", async () => {
    const { client, get } = fakeClient([]);
    const run = () => asCaller({ upn: UPN, oid: "o1" }, () => resolveCallerMemberId(client));
    await run();
    await run();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("same upn on a different company or base is looked up again", async () => {
    const a = fakeClient([{ id: 154 }]);
    const b = fakeClient([{ id: 7 }], { companyId: "other", apiBase: "https://a/v4_6_release/apis/3.0" });
    const c = fakeClient([{ id: 9 }], { companyId: "tomizone", apiBase: "https://b/v4_6_release/apis/3.0" });
    const run = (client: CwManageClient) => asCaller({ upn: UPN, oid: "o1" }, () => resolveCallerMemberId(client));
    expect(await run(a.client)).toBe(154);
    expect(await run(b.client)).toBe(7);
    expect(await run(c.client)).toBe(9);
    expect(a.get).toHaveBeenCalledTimes(1);
    expect(b.get).toHaveBeenCalledTimes(1);
    expect(c.get).toHaveBeenCalledTimes(1);
  });

  it("mixed-case upns share one cache entry", async () => {
    const { client, get } = fakeClient([{ id: 154 }]);
    await asCaller({ upn: UPN, oid: "o1" }, () => resolveCallerMemberId(client));
    const id = await asCaller({ upn: UPN.toUpperCase(), oid: "o1" }, () => resolveCallerMemberId(client));
    expect(id).toBe(154);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("a failed lookup is unresolved, logged without the upn, and retried", async () => {
    const get = vi.fn().mockRejectedValueOnce(new Error("403 Forbidden")).mockResolvedValue([{ id: 154 }]);
    const client = { get, companyId: "tomizone", apiBase: "https://a/v4_6_release/apis/3.0" } as unknown as CwManageClient;
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const run = () => asCaller({ upn: UPN, oid: "o1" }, () => resolveCallerMemberId(client));
    expect(await run()).toBeUndefined();
    expect(spy).toHaveBeenCalledWith("[attribution] member lookup failed: 403 Forbidden");
    expect(await run()).toBe(154);
    expect(get).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
