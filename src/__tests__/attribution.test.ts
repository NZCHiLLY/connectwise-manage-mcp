import { describe, it, expect, vi, beforeEach } from "vitest";
import { requestContext } from "../context.js";
import { resolveCallerMemberId, __resetAttributionCache } from "../attribution.js";
import type { CwManageClient } from "../api-client.js";

const UPN = "jayson.chilman@tomizone.com";

function fakeClient(result: unknown) {
  const get = vi.fn().mockResolvedValue(result);
  return { client: { get } as unknown as CwManageClient, get };
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
});
