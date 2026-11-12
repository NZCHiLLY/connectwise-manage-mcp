/**
 * Body-shape and guard tests for cw_merge_tickets.
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
 * The merge guard (Michael Morrison, 2 Sep 2026) refuses merges that create
 * broken records: source tickets carrying time entries, a closed target, or
 * tickets on different agreements. The pre-flight reads are pinned in order.
 *
 * Invocation strategy mirrors finance-payments.test.ts: handlers are pulled from
 * the private _registeredTools map and called directly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../../api-client.js";
import { registerTicketTools } from "../tickets.js";
import { auditLog } from "../../audit/log.js";

vi.mock("../../audit/log.js", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockClient = {
  get: vi.fn().mockResolvedValue([]),
  post: vi.fn().mockResolvedValue({}),
  patch: vi.fn().mockResolvedValue({}),
  request: vi.fn().mockResolvedValue({}),
} as unknown as CwManageClient;

const mockGet = mockClient.get as unknown as ReturnType<typeof vi.fn>;
const mockPost = mockClient.post as unknown as ReturnType<typeof vi.fn>;

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

const TICKET_FIELDS = "id,closedFlag,company/id,agreement/id";

type Ticket = {
  id: number;
  closedFlag?: boolean;
  company?: { id: number };
  agreement?: { id: number } | null;
};

function ticket(id: number, overrides: Partial<Ticket> = {}): Ticket {
  return { id, closedFlag: false, company: { id: 1 }, agreement: { id: 1481 }, ...overrides };
}

/** Queue the pre-flight reads in the order the handler makes them. */
function queuePreflight(opts: { target?: Ticket; sources: Ticket[]; counts?: number[] }) {
  mockGet.mockResolvedValueOnce(opts.target ?? ticket(200));
  for (const s of opts.sources) mockGet.mockResolvedValueOnce(s);
  opts.sources.forEach((_s, i) => mockGet.mockResolvedValueOnce({ count: opts.counts?.[i] ?? 0 }));
}

function queueClean(ids: number[] = [201, 202]) {
  queuePreflight({ sources: ids.map((id) => ticket(id)) });
}

/** The body handed to client.post for the most recent merge call. */
function lastMergeBody(): Record<string, unknown> {
  const calls = (mockClient.post as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][1] as Record<string, unknown>;
}

let server: McpServer;

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockReset();
  mockPost.mockReset().mockResolvedValue({});
  server = new McpServer({ name: "cw-ticket-merge-test", version: "0.0.0" });
  registerTicketTools(server, mockClient);
});

describe("cw_merge_tickets", () => {
  it("POSTs to /service/tickets/{targetTicketId}/merge", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    queueClean();
    await handler({ targetTicketId: 200, mergeTicketIds: [201, 202], ...SENTINEL }, {});
    expect(mockClient.post).toHaveBeenCalledWith(
      "/service/tickets/200/merge",
      expect.anything(),
    );
  });

  it("sends mergeTicketIds as bare integers, not id-references", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    queueClean();
    await handler({ targetTicketId: 200, mergeTicketIds: [201, 202], ...SENTINEL }, {});
    expect(lastMergeBody().mergeTicketIds).toStrictEqual([201, 202]);
  });

  it("puts no objects inside the mergeTicketIds array", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    queueClean();
    await handler({ targetTicketId: 200, mergeTicketIds: [201, 202], ...SENTINEL }, {});
    const ids = lastMergeBody().mergeTicketIds as unknown[];
    // The 500 this guards against is triggered by '{' appearing where CW wants
    // a number, so assert on the serialised form the client would actually send.
    expect(JSON.stringify(ids)).toBe("[201,202]");
    for (const id of ids) expect(typeof id).toBe("number");
  });

  it("handles a single source ticket", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    queueClean([201]);
    await handler({ targetTicketId: 200, mergeTicketIds: [201], ...SENTINEL }, {});
    expect(lastMergeBody().mergeTicketIds).toStrictEqual([201]);
  });

  it("omits status when no statusId is given", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    queueClean([201]);
    await handler({ targetTicketId: 200, mergeTicketIds: [201], ...SENTINEL }, {});
    expect(lastMergeBody()).not.toHaveProperty("status");
  });

  it("sends status as a StatusReference object when statusId is given", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    queueClean([201]);
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

describe("cw_merge_tickets guard", () => {
  it("pins the pre-flight call order and parameters", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    queueClean();
    await handler({ targetTicketId: 200, mergeTicketIds: [201, 202], ...SENTINEL }, {});
    const calls = (mockClient.get as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls).toStrictEqual([
      ["/service/tickets/200", { fields: TICKET_FIELDS }],
      ["/service/tickets/201", { fields: TICKET_FIELDS }],
      ["/service/tickets/202", { fields: TICKET_FIELDS }],
      ["/time/entries/count", { conditions: 'chargeToType = "ServiceTicket" and chargeToId = 201' }],
      ["/time/entries/count", { conditions: 'chargeToType = "ServiceTicket" and chargeToId = 202' }],
    ]);
  });

  it("refuses when a source has time entries", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    queuePreflight({ target: ticket(105900), sources: [ticket(105952)], counts: [3] });
    await expect(
      handler({ targetTicketId: 105900, mergeTicketIds: [105952], ...SENTINEL }, {}),
    ).rejects.toThrow(/105952 has 3 time entries.*shift them to the target ticket first.*allowTimeEntries/s);
    expect(mockClient.post).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("override is audited", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    queuePreflight({ target: ticket(105900), sources: [ticket(105952)], counts: [3] });
    await handler(
      { targetTicketId: 105900, mergeTicketIds: [105952], allowTimeEntries: true, ...SENTINEL },
      {},
    );
    expect(mockClient.post).toHaveBeenCalledTimes(1);
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: expect.objectContaining({ allowTimeEntries: true, timeEntries: { 105952: 3 } }),
      }),
    );
  });

  it("refuses a closed target", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    queuePreflight({ target: ticket(200, { closedFlag: true }), sources: [ticket(201)] });
    await expect(
      handler({ targetTicketId: 200, mergeTicketIds: [201], ...SENTINEL }, {}),
    ).rejects.toThrow(/closed.*allowClosedTarget/s);
    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it("allows a closed target with allowClosedTarget", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    queuePreflight({ target: ticket(200, { closedFlag: true }), sources: [ticket(201)] });
    await handler(
      { targetTicketId: 200, mergeTicketIds: [201], allowClosedTarget: true, ...SENTINEL },
      {},
    );
    expect(mockClient.post).toHaveBeenCalledTimes(1);
  });

  it("refuses an agreement mismatch", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    queuePreflight({
      target: ticket(200, { agreement: { id: 1481 } }),
      sources: [ticket(201, { agreement: { id: 1340 } })],
    });
    await expect(
      handler({ targetTicketId: 200, mergeTicketIds: [201], ...SENTINEL }, {}),
    ).rejects.toThrow(/201.*1340.*1481.*allowAgreementMismatch/s);
    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it("treats null agreement on both tickets as a match", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    queuePreflight({
      target: ticket(200, { agreement: null }),
      sources: [ticket(201, { agreement: null })],
    });
    await handler({ targetTicketId: 200, mergeTicketIds: [201], ...SENTINEL }, {});
    expect(mockClient.post).toHaveBeenCalledTimes(1);
  });

  it("treats null agreement on one side only as a mismatch", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    queuePreflight({ target: ticket(200), sources: [ticket(201, { agreement: null })] });
    await expect(
      handler({ targetTicketId: 200, mergeTicketIds: [201], ...SENTINEL }, {}),
    ).rejects.toThrow(/allowAgreementMismatch/);
    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it("allows an agreement mismatch with allowAgreementMismatch and audits it", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    queuePreflight({ target: ticket(200), sources: [ticket(201, { agreement: { id: 1340 } })] });
    await handler(
      { targetTicketId: 200, mergeTicketIds: [201], allowAgreementMismatch: true, ...SENTINEL },
      {},
    );
    expect(mockClient.post).toHaveBeenCalledTimes(1);
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: expect.objectContaining({ allowAgreementMismatch: true }),
      }),
    );
  });

  it("unreadable source refuses", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    mockGet.mockResolvedValueOnce(ticket(200));
    mockGet.mockRejectedValueOnce(new Error("ConnectWise API error 403: Forbidden"));
    await expect(
      handler({ targetTicketId: 200, mergeTicketIds: [201], ...SENTINEL }, {}),
    ).rejects.toThrow(/ConnectWise API error 403: Forbidden/);
    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it("clean merge still posts mergeTicketIds as integers", async () => {
    const { handler } = getTool(server, "cw_merge_tickets");
    queueClean();
    await handler({ targetTicketId: 200, mergeTicketIds: [201, 202], ...SENTINEL }, {});
    expect(lastMergeBody().mergeTicketIds).toStrictEqual([201, 202]);
  });
});
