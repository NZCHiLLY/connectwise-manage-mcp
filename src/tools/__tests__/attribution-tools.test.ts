import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../../api-client.js";
import { registerTimeEntryTools } from "../time-entries.js";
import { registerTicketTools } from "../tickets.js";
import { auditLog } from "../../audit/log.js";
import { resolveCallerMemberId } from "../../attribution.js";

vi.mock("../../audit/log.js", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../attribution.js", () => ({
  resolveCallerMemberId: vi.fn(),
}));

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

  it("note with no resolved member and no ids sends no member", async () => {
    resolve.mockResolvedValue(undefined);
    await getHandler(server, "cw_add_ticket_note")(NOTE, {});
    expect(postedBody()).not.toHaveProperty("member");
  });
});
