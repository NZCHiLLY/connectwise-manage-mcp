/**
 * Route-correctness tests for the invoice payment tools.
 *
 * ConnectWise Manage has no top-level /finance/payments collection — the API
 * returns 404 "The endpoint does not exist." Payments are a sub-resource of
 * invoices: /finance/invoices/{id}/payments. These tests pin every payment
 * tool to the real routes so a regression to the dead route fails CI.
 *
 * Invocation strategy mirrors audit-required.test.ts: handlers are pulled
 * from the private _registeredTools map and called directly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../../api-client.js";
import { registerFinanceTools } from "../finance.js";

vi.mock("../../audit/log.js", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockClient = {
  get: vi.fn().mockResolvedValue([]),
  post: vi.fn().mockResolvedValue({}),
  patch: vi.fn().mockResolvedValue({}),
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
  user_intent: "record a payment",
  user_quote: "please mark invoice 123 as paid",
};

let server: McpServer;

beforeEach(() => {
  vi.clearAllMocks();
  server = new McpServer({ name: "cw-payments-test", version: "0.0.0" });
  registerFinanceTools(server, mockClient);
});

describe("dead /finance/payments route is gone", () => {
  it("no longer registers cw_search_payments or cw_get_payment", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (server as any)._registeredTools as Record<string, unknown>;
    expect(tools["cw_search_payments"]).toBeUndefined();
    expect(tools["cw_get_payment"]).toBeUndefined();
  });
});

describe("cw_list_invoice_payments", () => {
  it("GETs /finance/invoices/{id}/payments", async () => {
    const { handler } = getTool(server, "cw_list_invoice_payments");
    await handler({ id: 123 }, {});
    expect(mockClient.get).toHaveBeenCalledWith(
      "/finance/invoices/123/payments",
      expect.objectContaining({ page: 1, pageSize: 25 }),
    );
  });
});

describe("cw_get_invoice_payment", () => {
  it("GETs /finance/invoices/{id}/payments/{paymentId}", async () => {
    const { handler } = getTool(server, "cw_get_invoice_payment");
    await handler({ id: 123, paymentId: 45 }, {});
    expect(mockClient.get).toHaveBeenCalledWith(
      "/finance/invoices/123/payments/45",
    );
  });
});

describe("cw_pay_invoice", () => {
  it("POSTs to /finance/invoices/{id}/payments (not the dead /pay route)", async () => {
    const { handler } = getTool(server, "cw_pay_invoice");
    await handler(
      { id: 123, amount: 250.5, paymentDate: "2026-07-21T00:00:00Z", ...SENTINEL },
      {},
    );
    expect(mockClient.post).toHaveBeenCalledWith(
      "/finance/invoices/123/payments",
      expect.objectContaining({ amount: 250.5, paymentDate: "2026-07-21T00:00:00Z" }),
    );
  });

  it("rejects without sentinel params", async () => {
    const { inputSchema } = getTool(server, "cw_pay_invoice");
    await expect(inputSchema.parseAsync({ id: 123, amount: 100 })).rejects.toThrow();
  });
});

describe("cw_update_invoice_payment", () => {
  it("PATCHes /finance/invoices/{id}/payments/{paymentId} with JSON Patch ops", async () => {
    const { handler } = getTool(server, "cw_update_invoice_payment");
    const operations = [{ op: "replace", path: "amount", value: 99 }];
    await handler({ id: 123, paymentId: 45, operations, ...SENTINEL }, {});
    expect(mockClient.patch).toHaveBeenCalledWith(
      "/finance/invoices/123/payments/45",
      operations,
    );
  });

  it("rejects without sentinel params", async () => {
    const { inputSchema } = getTool(server, "cw_update_invoice_payment");
    await expect(
      inputSchema.parseAsync({ id: 123, paymentId: 45, operations: [] }),
    ).rejects.toThrow();
  });
});
