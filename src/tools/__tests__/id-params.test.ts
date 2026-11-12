import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../../api-client.js";
import { registerFinanceTools } from "../finance.js";
import { registerTicketTools } from "../tickets.js";

vi.mock("../../audit/log.js", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

const get = vi.fn().mockResolvedValue({});
const mockClient = { get } as unknown as CwManageClient;

function getTool(server: McpServer, name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tool = (server as any)._registeredTools[name];
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool as {
    inputSchema: { parseAsync(args: unknown): Promise<Record<string, unknown>> };
    handler: (args: unknown, extra: object) => Promise<unknown>;
  };
}

let server: McpServer;

async function call(name: string, args: Record<string, unknown>) {
  const tool = getTool(server, name);
  return tool.handler(await tool.inputSchema.parseAsync(args), {});
}

beforeEach(() => {
  vi.clearAllMocks();
  server = new McpServer({ name: "cw-id-params", version: "0.0.0" });
  registerFinanceTools(server, mockClient);
  registerTicketTools(server, mockClient);
});

describe("id parameters", () => {
  it("coerces string ids", async () => {
    const parsed = await getTool(server, "cw_get_ticket").inputSchema.parseAsync({ id: "111690" });
    expect(parsed.id).toBe(111690);
    await call("cw_get_agreement_additions", { agreementId: "1481" });
    expect(get.mock.calls[0][0]).toBe("/finance/agreements/1481/additions");
  });

  it("accepts both id names", async () => {
    await call("cw_get_ticket_notes", { id: 111690 });
    expect(get.mock.calls[0][0]).toBe("/service/tickets/111690/allNotes");
    await call("cw_get_agreement_additions", { id: 1481 });
    expect(get.mock.calls[1][0]).toBe("/finance/agreements/1481/additions");
    await call("cw_get_ticket", { ticketId: 111690 });
    expect(get.mock.calls[2][0]).toBe("/service/tickets/111690");
    await call("cw_get_agreement", { agreementId: "1481" });
    expect(get.mock.calls[3][0]).toBe("/finance/agreements/1481");
  });

  it("neither name throws", async () => {
    await expect(call("cw_get_ticket", {})).rejects.toThrow(
      "cw_get_ticket: id is required (ticketId is accepted as an alias)",
    );
    await expect(call("cw_get_agreement_additions", {})).rejects.toThrow(
      "cw_get_agreement_additions: agreementId is required (id is accepted as an alias)",
    );
  });

  it("disagreeing names throw", async () => {
    await expect(call("cw_get_ticket_notes", { id: 1, ticketId: 2 })).rejects.toThrow(
      "cw_get_ticket_notes: ticketId and id disagree",
    );
    await call("cw_get_agreement", { id: 5, agreementId: 5 });
    expect(get).toHaveBeenCalledTimes(1);
  });
});
