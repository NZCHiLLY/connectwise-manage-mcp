/**
 * Body-shape tests for cw_merge_tickets.
 *
 * ConnectWise types the merge payload's `mergeTicketIds` as a list of bare
 * integers. Sending id-references instead — [{ id: 123 }] — makes the server's
 * JSON deserialiser hit '{' where it expects a number and fail the whole request
 * with a 500:
 *
 *   Unexpected character encountered while parsing value: {
 *
 * `status` is genuinely a StatusReference, so it stays an object. These tests pin
 * both halves so the two field shapes can't be conflated again.
 *
 * Invocation strategy mirrors finance-payments.test.ts: handlers are pulled from
 * the private _registeredTools map and called directly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../../api-client.js";
import { registerTicketTools } from "../tickets.js";

vi.mock("../../audit/log.js", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockClient = {
  get: vi.fn().mockResolvedValue([]),
  post: vi.fn().mockResolvedValue({}),
  patch: vi.fn().mockResolvedValue({}),
  request: vi.fn().mockResolvedValue({}),
} as unknown as CwManageClient;

function getTool(server: McpServer, name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tool = (server as any)._registeredTools[name];
  if (!tool) throw new Error(`Tool "${name}" not found in _registeredTools`);
  return tool as {
    inputSchema: { parseAsync(args: unknown): Promise<unknown> };
    handler: (args: unknown, extra: object) => Promise<unknown>;
  };
}

const SENTINEL = {
  user_intent: "merge the duplicate tickets raised for the same outage",
  user_quote: "can you merge 201 and 202 into 200",
};

/** The body handed to client.post for the most recent merge call. */
function lastMergeBody(): Record<string, unknown> {
  const calls = (mockClient.post as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][1] as Record<string, unknown>;
}

let server: McpServer;

beforeEach(() => {
  vi.clearAllMocks();
  server = new McpServer({ name: "cw-ticket-merge-test", version: "0.0.0" });
  registerTicketTools(server, mockClient);
});

describe("cw_merge_tickets", () => {
  it("POSTs to /service/tickets/{targetTicketId}/merge", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    await handler({ targetTicketId: 200, mergeTicketIds: [201, 202], ...SENTINEL }, {});
    expect(mockClient.post).toHaveBeenCalledWith(
      "/service/tickets/200/merge",
      expect.anything(),
    );
  });

  it("sends mergeTicketIds as bare integers, not id-references", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    await handler({ targetTicketId: 200, mergeTicketIds: [201, 202], ...SENTINEL }, {});
    expect(lastMergeBody().mergeTicketIds).toStrictEqual([201, 202]);
  });

  it("puts no objects inside the mergeTicketIds array", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    await handler({ targetTicketId: 200, mergeTicketIds: [201, 202], ...SENTINEL }, {});
    const ids = lastMergeBody().mergeTicketIds as unknown[];
    // The 500 this guards against is triggered by '{' appearing where CW wants
    // a number, so assert on the serialised form the client would actually send.
    expect(JSON.stringify(ids)).toBe("[201,202]");
    for (const id of ids) expect(typeof id).toBe("number");
  });

  it("handles a single source ticket", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    await handler({ targetTicketId: 200, mergeTicketIds: [201], ...SENTINEL }, {});
    expect(lastMergeBody().mergeTicketIds).toStrictEqual([201]);
  });

  it("omits status when no statusId is given", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    await handler({ targetTicketId: 200, mergeTicketIds: [201], ...SENTINEL }, {});
    expect(lastMergeBody()).not.toHaveProperty("status");
  });

  it("sends status as a StatusReference object when statusId is given", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    await handler(
      { targetTicketId: 200, mergeTicketIds: [201], statusId: 7, ...SENTINEL },
      {},
    );
    // status is a reference type — unlike mergeTicketIds, it really is { id }.
    expect(lastMergeBody().status).toStrictEqual({ id: 7 });
  });

  it("rejects without sentinel params", async () => {
    const { inputSchema } = getTool(server, "cw_merge_tickets");
    await expect(
      inputSchema.parseAsync({ targetTicketId: 200, mergeTicketIds: [201] }),
    ).rejects.toThrow();
  });

  it("rejects id-reference objects in mergeTicketIds at the schema boundary", async () => {
    const { inputSchema } = getTool(server, "cw_merge_tickets");
    await expect(
      inputSchema.parseAsync({
        targetTicketId: 200,
        mergeTicketIds: [{ id: 201 }],
        ...SENTINEL,
      }),
    ).rejects.toThrow();
  });
});
