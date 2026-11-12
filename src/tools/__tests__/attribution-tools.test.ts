import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../../api-client.js";
import { registerTimeEntryTools } from "../time-entries.js";
import { registerTicketTools } from "../tickets.js";
import { auditLog } from "../../audit/log.js";
import { resolveCallerMemberId } from "../../attribution.js";
import { getCallerIdentity } from "../../context.js";

vi.mock("../../audit/log.js", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../attribution.js", () => ({
  resolveCallerMemberId: vi.fn(),
}));

vi.mock("../../context.js", () => ({
  getCallerIdentity: vi.fn(),
  getCorrelationId: vi.fn().mockReturnValue("-"),
}));

const caller = getCallerIdentity as unknown as ReturnType<typeof vi.fn>;

const mockClient = {
  get: vi.fn().mockResolvedValue({}),
  post: vi.fn().mockResolvedValue({}),
} as unknown as CwManageClient;

function getHandler(server: McpServer, name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tool = (server as any)._registeredTools[name];
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool.handler as (args: unknown, extra: object) => Promise<unknown>;
}

const SENTINEL = {
  user_intent: "log the on-site time against the customer ticket",
  user_quote: "put 2 hours on 104094 for the site visit",
};

const ENTRY = {
  chargeToId: 104094,
  chargeToType: "ServiceTicket",
  timeStart: "2026-07-29T20:00:00Z",
  ...SENTINEL,
};

const resolve = resolveCallerMemberId as unknown as ReturnType<typeof vi.fn>;
const post = mockClient.post as unknown as ReturnType<typeof vi.fn>;

function postedBody(): Record<string, unknown> {
  return post.mock.calls[0][1] as Record<string, unknown>;
}

let server: McpServer;

beforeEach(() => {
  vi.clearAllMocks();
  caller.mockReturnValue(undefined);
  server = new McpServer({ name: "cw-attribution-tools", version: "0.0.0" });
  registerTimeEntryTools(server, mockClient);
  registerTicketTools(server, mockClient);
});

describe("cw_create_time_entry attribution", () => {
  it("signed-in caller without memberId gets their own member", async () => {
    resolve.mockResolvedValue(154);
    await getHandler(server, "cw_create_time_entry")(ENTRY, {});
    expect(postedBody().member).toStrictEqual({ id: 154 });
  });

  it("explicit memberId wins and both are audited", async () => {
    resolve.mockResolvedValue(154);
    await getHandler(server, "cw_create_time_entry")({ ...ENTRY, memberId: 160 }, {});
    expect(postedBody().member).toStrictEqual({ id: 160 });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "cw_create_time_entry",
        operations: expect.objectContaining({ memberId: 160, resolvedMemberId: 154 }),
      }),
    );
  });

  it("static caller without memberId fails", async () => {
    resolve.mockResolvedValue(undefined);
    await expect(getHandler(server, "cw_create_time_entry")(ENTRY, {})).rejects.toThrow(
      "memberId is required: the caller's sign-in did not resolve to exactly one active ConnectWise member",
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("explicit memberId still works when nothing resolves", async () => {
    resolve.mockResolvedValue(undefined);
    await getHandler(server, "cw_create_time_entry")({ ...ENTRY, memberId: 160 }, {});
    expect(postedBody().member).toStrictEqual({ id: 160 });
  });
});

describe("cw_add_ticket_note attribution", () => {
  const NOTE = { ticketId: 104094, text: "Visited site", ...SENTINEL };

  it("note defaults to the signed-in member", async () => {
    resolve.mockResolvedValue(154);
    await getHandler(server, "cw_add_ticket_note")(NOTE, {});
    expect(postedBody().member).toStrictEqual({ id: 154 });
  });

  it("note keeps an explicit contact", async () => {
    resolve.mockResolvedValue(154);
    await getHandler(server, "cw_add_ticket_note")({ ...NOTE, contactId: 77 }, {});
    const body = postedBody();
    expect(body.contact).toStrictEqual({ id: 77 });
    expect(body).not.toHaveProperty("member");
  });

  it("a signed-in caller who does not resolve is refused before any audit or write", async () => {
    caller.mockReturnValue({ upn: "someone@tomizone.com", oid: "abc-123" });
    resolve.mockResolvedValue(undefined);
    await expect(getHandler(server, "cw_add_ticket_note")(NOTE, {})).rejects.toThrow(
      "memberId or contactId is required: your sign-in did not resolve to exactly one active ConnectWise member",
    );
    expect(post).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("a static caller with no ids still posts, sending no member", async () => {
    caller.mockReturnValue({ upn: "static", oid: "static" });
    resolve.mockResolvedValue(undefined);
    await getHandler(server, "cw_add_ticket_note")(NOTE, {});
    expect(postedBody()).not.toHaveProperty("member");
  });

  it("no caller context at all still posts, sending no member", async () => {
    caller.mockReturnValue(undefined);
    resolve.mockResolvedValue(undefined);
    await getHandler(server, "cw_add_ticket_note")(NOTE, {});
    expect(postedBody()).not.toHaveProperty("member");
  });

  it("a signed-in caller with an explicit contact is not refused", async () => {
    caller.mockReturnValue({ upn: "someone@tomizone.com", oid: "abc-123" });
    resolve.mockResolvedValue(undefined);
    await getHandler(server, "cw_add_ticket_note")({ ...NOTE, contactId: 77 }, {});
    expect(postedBody().contact).toStrictEqual({ id: 77 });
  });
});
