/**
 * Integration-style tests for the intent-declaration gating on the three update
 * tools: cw_update_ticket, cw_update_company, cw_update_catalog_item.
 *
 * SDK invocation strategy
 * -----------------------
 * McpServer has no public callTool method.  The registered tool entry is
 * accessible via the private `_registeredTools` map, which stores:
 *   - inputSchema: a Zod ZodObject built from the raw shape passed to server.tool()
 *   - handler:     the async callback passed as the last argument
 *
 * Validation tests call `inputSchema.parseAsync(badArgs)` directly — this is
 * exactly the schema the SDK validates against before calling the handler, so
 * the test exercises the same code path.
 *
 * Handler tests supply valid args and call `handler(validArgs, {})` directly,
 * then assert on the auditLog and client.patch mocks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../../api-client.js";
import { registerTicketTools } from "../tickets.js";
import { registerCompanyTools } from "../companies.js";
import { registerCatalogTools } from "../catalog.js";

// ---------------------------------------------------------------------------
// Mock auditLog — must be hoisted so the tool modules see the mock when they
// import from "../../audit/log.js" at the top of their own module.
// ---------------------------------------------------------------------------

vi.mock("../../audit/log.js", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

import { auditLog } from "../../audit/log.js";

// ---------------------------------------------------------------------------
// Shared mock client
// ---------------------------------------------------------------------------

const mockClient = {
  patch: vi.fn(),
} as unknown as CwManageClient;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the registered tool entry from an McpServer instance.
 * Uses the private _registeredTools map which is present in all SDK versions
 * >= 1.0 (the property is initialised in the constructor).
 */
function getTool(server: McpServer, name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tool = (server as any)._registeredTools[name];
  if (!tool) throw new Error(`Tool "${name}" not found in _registeredTools`);
  return tool as {
    inputSchema: { parseAsync(args: unknown): Promise<unknown> };
    handler: (args: unknown, extra: object) => Promise<unknown>;
  };
}

/**
 * Asserts that parsing `args` against the tool's input schema rejects.
 * Uses `parseAsync` which is the same Zod method the SDK calls internally.
 */
async function expectValidationError(server: McpServer, toolName: string, args: unknown) {
  const { inputSchema } = getTool(server, toolName);
  await expect(inputSchema.parseAsync(args)).rejects.toThrow();
}

// ---------------------------------------------------------------------------
// cw_update_ticket
// ---------------------------------------------------------------------------

describe("cw_update_ticket", () => {
  let server: McpServer;

  const VALID = {
    id: 1,
    user_intent: "Close ticket because customer has been billed",
    user_quote: "Please close this ticket, I've billed it",
    summary: "Updated summary for billing closure",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(mockClient.patch).mockResolvedValue({ id: 1, summary: "Test" });
    server = new McpServer({ name: "test", version: "0.0.0" });
    registerTicketTools(server, mockClient);
  });

  it("rejects when user_intent is missing", async () => {
    const { user_intent: _omit, ...args } = VALID;
    await expectValidationError(server, "cw_update_ticket", args);
  });

  it("rejects when user_quote is missing", async () => {
    const { user_quote: _omit, ...args } = VALID;
    await expectValidationError(server, "cw_update_ticket", args);
  });

  it("rejects when user_intent is shorter than 20 chars", async () => {
    await expectValidationError(server, "cw_update_ticket", {
      ...VALID,
      user_intent: "close it",
    });
  });

  it("accepts short user_quote (e.g. 'yes')", async () => {
    const { inputSchema } = getTool(server, "cw_update_ticket");
    await expect(inputSchema.parseAsync({ ...VALID, user_quote: "yes" })).resolves.toMatchObject({ user_quote: "yes" });
  });

  it("calls auditLog with correct shape on a valid call", async () => {
    const { handler } = getTool(server, "cw_update_ticket");
    const result = await handler(VALID, {});

    expect(auditLog).toHaveBeenCalledOnce();
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({
      tool: "cw_update_ticket",
      entityType: "ticket",
      entityId: VALID.id,
      userIntent: VALID.user_intent,
      userQuote: VALID.user_quote,
    }));
    expect(result).toMatchObject({ content: [{ type: "text" }] });
  });

  it("calls client.patch with correct endpoint and derived operations, after auditLog", async () => {
    const { handler } = getTool(server, "cw_update_ticket");
    await handler(VALID, {});

    expect(mockClient.patch).toHaveBeenCalledOnce();
    expect(mockClient.patch).toHaveBeenCalledWith(
      `/service/tickets/${VALID.id}`,
      [{ op: "replace", path: "/summary", value: VALID.summary }],
    );
    const auditOrder = vi.mocked(auditLog).mock.invocationCallOrder[0];
    const patchOrder = vi.mocked(mockClient.patch).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(patchOrder);
  });
});

// ---------------------------------------------------------------------------
// cw_update_company
// ---------------------------------------------------------------------------

describe("cw_update_company", () => {
  let server: McpServer;

  const VALID = {
    id: 10,
    user_intent: "Update phone number for Acme Corp account",
    user_quote: "Update Acme's phone number to 555-1234",
    operations: [{ op: "replace", path: "/phoneNumber", value: "555-1234" }],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(mockClient.patch).mockResolvedValue({ id: 10, name: "Acme" });
    server = new McpServer({ name: "test", version: "0.0.0" });
    registerCompanyTools(server, mockClient);
  });

  it("rejects when user_intent is missing", async () => {
    const { user_intent: _omit, ...args } = VALID;
    await expectValidationError(server, "cw_update_company", args);
  });

  it("rejects when user_quote is missing", async () => {
    const { user_quote: _omit, ...args } = VALID;
    await expectValidationError(server, "cw_update_company", args);
  });

  it("rejects when user_intent is shorter than 20 chars", async () => {
    await expectValidationError(server, "cw_update_company", {
      ...VALID,
      user_intent: "close it",
    });
  });

  it("accepts short user_quote (e.g. 'yes')", async () => {
    const { inputSchema } = getTool(server, "cw_update_company");
    await expect(inputSchema.parseAsync({ ...VALID, user_quote: "yes" })).resolves.toMatchObject({ user_quote: "yes" });
  });

  it("calls auditLog with correct shape on a valid call", async () => {
    const { handler } = getTool(server, "cw_update_company");
    const result = await handler(VALID, {});

    expect(auditLog).toHaveBeenCalledOnce();
    expect(auditLog).toHaveBeenCalledWith({
      tool: "cw_update_company",
      entityType: "company",
      entityId: VALID.id,
      userIntent: VALID.user_intent,
      userQuote: VALID.user_quote,
      operations: VALID.operations,
    });
    expect(result).toMatchObject({ content: [{ type: "text" }] });
  });

  it("calls client.patch with correct endpoint and operations, after auditLog", async () => {
    const { handler } = getTool(server, "cw_update_company");
    await handler(VALID, {});

    expect(mockClient.patch).toHaveBeenCalledOnce();
    expect(mockClient.patch).toHaveBeenCalledWith(
      `/company/companies/${VALID.id}`,
      VALID.operations,
    );
    const auditOrder = vi.mocked(auditLog).mock.invocationCallOrder[0];
    const patchOrder = vi.mocked(mockClient.patch).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(patchOrder);
  });
});

// ---------------------------------------------------------------------------
// cw_update_catalog_item
// ---------------------------------------------------------------------------

describe("cw_update_catalog_item", () => {
  let server: McpServer;

  const VALID = {
    id: 99,
    user_intent: "Update catalog item price to reflect new cost",
    user_quote: "Change the price of item 99 to 49.99",
    operations: [{ op: "replace", path: "/price", value: 49.99 }],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(mockClient.patch).mockResolvedValue({ id: 99, identifier: "SKU-99" });
    server = new McpServer({ name: "test", version: "0.0.0" });
    registerCatalogTools(server, mockClient);
  });

  it("rejects when user_intent is missing", async () => {
    const { user_intent: _omit, ...args } = VALID;
    await expectValidationError(server, "cw_update_catalog_item", args);
  });

  it("rejects when user_quote is missing", async () => {
    const { user_quote: _omit, ...args } = VALID;
    await expectValidationError(server, "cw_update_catalog_item", args);
  });

  it("rejects when user_intent is shorter than 20 chars", async () => {
    await expectValidationError(server, "cw_update_catalog_item", {
      ...VALID,
      user_intent: "close it",
    });
  });

  it("accepts short user_quote (e.g. 'yes')", async () => {
    const { inputSchema } = getTool(server, "cw_update_catalog_item");
    await expect(inputSchema.parseAsync({ ...VALID, user_quote: "yes" })).resolves.toMatchObject({ user_quote: "yes" });
  });

  it("calls auditLog with correct shape on a valid call", async () => {
    const { handler } = getTool(server, "cw_update_catalog_item");
    const result = await handler(VALID, {});

    expect(auditLog).toHaveBeenCalledOnce();
    expect(auditLog).toHaveBeenCalledWith({
      tool: "cw_update_catalog_item",
      entityType: "catalog_item",
      entityId: VALID.id,
      userIntent: VALID.user_intent,
      userQuote: VALID.user_quote,
      operations: VALID.operations,
    });
    expect(result).toMatchObject({ content: [{ type: "text" }] });
  });

  it("calls client.patch with correct endpoint and operations, after auditLog", async () => {
    const { handler } = getTool(server, "cw_update_catalog_item");
    await handler(VALID, {});

    expect(mockClient.patch).toHaveBeenCalledOnce();
    expect(mockClient.patch).toHaveBeenCalledWith(
      `/procurement/catalog/${VALID.id}`,
      VALID.operations,
    );
    const auditOrder = vi.mocked(auditLog).mock.invocationCallOrder[0];
    const patchOrder = vi.mocked(mockClient.patch).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(patchOrder);
  });
});
