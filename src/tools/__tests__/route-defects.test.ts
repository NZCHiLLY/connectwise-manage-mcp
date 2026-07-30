/**
 * Route and payload defects found during live production use.
 *
 * Each case here corresponds to a call that failed against a real ConnectWise
 * instance, so the assertions are deliberately on the exact path or body shape
 * that was wrong rather than on anything looser.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../../api-client.js";
import { registerFinanceTools } from "../finance.js";
import { registerTicketTools } from "../tickets.js";
import { registerServiceTools } from "../service.js";
import { registerTimeEntryTools } from "../time-entries.js";

vi.mock("../../audit/log.js", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockClient = {
  get: vi.fn().mockResolvedValue({}),
  post: vi.fn().mockResolvedValue({}),
  patch: vi.fn().mockResolvedValue({}),
  request: vi.fn().mockResolvedValue({}),
} as unknown as CwManageClient;

function getTool(server: McpServer, name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tool = (server as any)._registeredTools[name];
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool as {
    description: string;
    inputSchema: { parseAsync(args: unknown): Promise<unknown> };
    handler: (args: unknown, extra: object) => Promise<unknown>;
  };
}

/** Zod exposes the object shape either directly or behind _def, depending on version. */
function shapeOf(tool: { inputSchema: unknown }): Record<string, unknown> {
  const s = tool.inputSchema as {
    shape?: Record<string, unknown>;
    _def?: { shape?: () => Record<string, unknown> };
  };
  if (typeof s?._def?.shape === "function") return s._def.shape();
  return s?.shape ?? {};
}

const SENTINEL = {
  user_intent: "log the on-site time against the customer ticket",
  user_quote: "put 2 hours on 104094 for the site visit",
};

let server: McpServer;

beforeEach(() => {
  vi.clearAllMocks();
  server = new McpServer({ name: "cw-route-defects", version: "0.0.0" });
  registerFinanceTools(server, mockClient);
  registerTicketTools(server, mockClient);
  registerServiceTools(server, mockClient);
  registerTimeEntryTools(server, mockClient);
});

describe("work roles live under /time, not /finance", () => {
  // /finance/workRoles 404s with "The endpoint does not exist." The real route
  // is confirmed by CW's own workRole_href on a time entry.
  it("cw_list_work_roles GETs /time/workRoles", async () => {
    await getTool(server, "cw_list_work_roles").handler({}, {});
    expect(mockClient.get).toHaveBeenCalledWith("/time/workRoles", expect.anything());
  });

  it("cw_get_work_role GETs /time/workRoles/{id}", async () => {
    await getTool(server, "cw_get_work_role").handler({ id: 5 }, {});
    expect(mockClient.get).toHaveBeenCalledWith("/time/workRoles/5");
  });

  it("neither read tool touches /finance/workRoles", async () => {
    await getTool(server, "cw_list_work_roles").handler({}, {});
    await getTool(server, "cw_get_work_role").handler({ id: 5 }, {});
    const paths = (mockClient.get as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      (c) => String(c[0]),
    );
    expect(paths.some((p) => p.startsWith("/finance/workRoles"))).toBe(false);
  });

  it("agreement work role overrides still live under /finance", async () => {
    // These are a different resource and legitimately sit under /finance.
    await getTool(server, "cw_list_agreement_workroles").handler({ agreementId: 7 }, {});
    expect(mockClient.get).toHaveBeenCalledWith(
      "/finance/agreements/7/workroles",
      expect.anything(),
    );
  });
});

describe("cw_get_ticket_by_id_search sends a FilterValues body", () => {
  it("posts conditions, not a bare id", async () => {
    await getTool(server, "cw_get_ticket_by_id_search").handler({ id: 104094 }, {});
    expect(mockClient.post).toHaveBeenCalledWith("/service/tickets/search", {
      conditions: "id = 104094",
    });
  });

  it("never posts a bare { id } payload", async () => {
    await getTool(server, "cw_get_ticket_by_id_search").handler({ id: 104094 }, {});
    const body = (mockClient.post as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1];
    expect(body).not.toHaveProperty("id");
  });
});

describe("service location is settable on tickets", () => {
  it("cw_list_service_locations GETs /service/locations", async () => {
    await getTool(server, "cw_list_service_locations").handler({}, {});
    expect(mockClient.get).toHaveBeenCalledWith("/service/locations", expect.anything());
  });

  it("cw_update_ticket patches /serviceLocation/id", async () => {
    await getTool(server, "cw_update_ticket").handler(
      { id: 104094, serviceLocationId: 2, ...SENTINEL },
      {},
    );
    const ops = (mockClient.patch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1];
    expect(ops).toContainEqual({ op: "replace", path: "/serviceLocation/id", value: 2 });
  });

  it("cw_create_ticket maps serviceLocationId and keeps location separate", async () => {
    await getTool(server, "cw_create_ticket").handler(
      { summary: "Site visit", serviceLocationId: 2, locationId: 9, ...SENTINEL },
      {},
    );
    const body = (mockClient.post as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as Record<string, unknown>;
    // serviceLocation (On-Site/Remote) and location (owning office) are different
    // fields — conflating them is what left tickets stuck on "Remote".
    expect(body.serviceLocation).toStrictEqual({ id: 2 });
    expect(body.location).toStrictEqual({ id: 9 });
  });
});

describe("cw_create_time_entry guards the three known rejections", () => {
  it("requires memberId so it can't default to the API member", async () => {
    const { inputSchema } = getTool(server, "cw_create_time_entry");
    await expect(
      inputSchema.parseAsync({
        chargeToId: 104094,
        chargeToType: "ServiceTicket",
        timeStart: "2026-07-29T20:00:00Z",
        ...SENTINEL,
      }),
    ).rejects.toThrow();
  });

  it("falls back to the member's defaultWorkRole when workRoleId is omitted", async () => {
    (mockClient.get as unknown as { mockResolvedValueOnce(v: unknown): void }).mockResolvedValueOnce({
      id: 154,
      defaultWorkRole: { id: 5, name: "Engineer" },
    });
    await getTool(server, "cw_create_time_entry").handler(
      {
        chargeToId: 104094,
        chargeToType: "ServiceTicket",
        memberId: 154,
        timeStart: "2026-07-29T20:00:00Z",
        ...SENTINEL,
      },
      {},
    );
    const body = (mockClient.post as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as Record<string, unknown>;
    expect(body.member).toStrictEqual({ id: 154 });
    expect(body.workRole).toStrictEqual({ id: 5 });
  });

  it("does not override an explicitly supplied workRoleId", async () => {
    await getTool(server, "cw_create_time_entry").handler(
      {
        chargeToId: 104094,
        chargeToType: "ServiceTicket",
        memberId: 154,
        workRoleId: 11,
        timeStart: "2026-07-29T20:00:00Z",
        ...SENTINEL,
      },
      {},
    );
    const body = (mockClient.post as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as Record<string, unknown>;
    expect(body.workRole).toStrictEqual({ id: 11 });
  });

  it("still creates when the member lookup fails", async () => {
    (mockClient.get as unknown as { mockRejectedValueOnce(v: unknown): void }).mockRejectedValueOnce(
      new Error("boom"),
    );
    await getTool(server, "cw_create_time_entry").handler(
      {
        chargeToId: 104094,
        chargeToType: "ServiceTicket",
        memberId: 154,
        timeStart: "2026-07-29T20:00:00Z",
        ...SENTINEL,
      },
      {},
    );
    expect(mockClient.post).toHaveBeenCalledWith("/time/entries", expect.anything());
  });

  it("names the blocking ticket status when CW rejects on status", async () => {
    (mockClient.get as unknown as { mockResolvedValueOnce(v: unknown): void }).mockResolvedValueOnce({
      defaultWorkRole: { id: 5 },
    });
    (mockClient.post as unknown as { mockRejectedValueOnce(v: unknown): void }).mockRejectedValueOnce(
      new Error(
        "Please update the status of this ticket before entering time, the current status does not allow time entry.",
      ),
    );
    (mockClient.get as unknown as { mockResolvedValueOnce(v: unknown): void }).mockResolvedValueOnce({
      id: 104094,
      status: { name: "Closed" },
      board: { name: "Service" },
    });
    await expect(
      getTool(server, "cw_create_time_entry").handler(
        {
          chargeToId: 104094,
          chargeToType: "ServiceTicket",
          memberId: 154,
          timeStart: "2026-07-29T20:00:00Z",
          ...SENTINEL,
        },
        {},
      ),
    ).rejects.toThrow(/currently "Closed".*board "Service".*cw_list_board_statuses/s);
  });
});

describe("date parameter descriptions", () => {
  it("no tool documents the placeholder brackets as literal", () => {
    // Passing the documented "[YYYY-MM-DDTHH:MM:SSZ]" verbatim, brackets included,
    // fails with UnsupportedFormat — so the brackets must not appear at all.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (server as any)._registeredTools as Record<string, unknown>;
    const offenders: string[] = [];
    for (const [name, entry] of Object.entries(tools)) {
      const e = entry as {
        inputSchema?: { shape?: Record<string, unknown>; _def?: { shape(): Record<string, unknown> } };
      };
      const shape =
        typeof e.inputSchema?._def?.shape === "function"
          ? e.inputSchema._def.shape()
          : e.inputSchema?.shape;
      for (const [field, def] of Object.entries(shape ?? {})) {
        const desc = (def as { description?: string })?.description ?? "";
        if (desc.includes("[YYYY-MM-DD")) offenders.push(`${name}.${field}`);
      }
    }
    expect(offenders).toStrictEqual([]);
  });

  it("time entry start/end call out UTC", () => {
    const shape = shapeOf(getTool(server, "cw_create_time_entry"));
    expect((shape.timeStart as { description?: string }).description).toMatch(/UTC/);
    expect((shape.timeEnd as { description?: string }).description).toMatch(/UTC/);
  });
});

describe("update tools are findable by the words callers use", () => {
  it("cw_update_ticket_note mentions edit/amend vocabulary", () => {
    const desc = getTool(server, "cw_update_ticket_note").description.toLowerCase();
    for (const word of ["edit", "amend", "correct", "revise"]) {
      expect(desc, `description should contain "${word}"`).toContain(word);
    }
  });
});
