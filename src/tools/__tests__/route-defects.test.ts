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
import { registerSystemTools } from "../system.js";
import { registerOpportunityTools } from "../opportunities.js";
import { auditLog } from "../../audit/log.js";
import { applyPatch } from "../shared.js";
import { registerSalesTools, QUOTES_UNAVAILABLE_MESSAGE } from "../sales.js";
import { registerActivityTools } from "../activities.js";
import { registerCatalogTools } from "../catalog.js";
import { registerCompanyTools } from "../companies.js";
import { registerConfigurationTools } from "../configurations.js";
import { registerContactTools } from "../contacts.js";
import { registerExpenseTools } from "../expenses.js";
import { registerHealthTools } from "../health.js";
import { registerMarketingTools } from "../marketing.js";
import { registerProcurementTools } from "../procurement.js";
import { registerProjectTools } from "../projects.js";
import { registerScheduleTools } from "../schedule.js";

vi.mock("../../audit/log.js", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockClient = {
  get: vi.fn().mockResolvedValue({}),
  post: vi.fn().mockResolvedValue({}),
  patch: vi.fn().mockResolvedValue({}),
  put: vi.fn().mockResolvedValue({}),
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
  registerSystemTools(server, mockClient);
  registerOpportunityTools(server, mockClient);
  registerSalesTools(server, mockClient);
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
  // memberId is now optional in the schema; the never-default-to-the-API-member
  // guarantee is covered at handler level in attribution-tools.test.ts.
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

describe("pagination descriptions", () => {
  it("no tool advertises a 1000-row page", () => {
    // The claude.ai connectors cap a page at 100, so a description advertising
    // max: 1000 sends callers to a page size they cannot get.
    const all = new McpServer({ name: "cw-page-size", version: "0.0.0" });
    registerActivityTools(all, mockClient);
    registerCatalogTools(all, mockClient);
    registerCompanyTools(all, mockClient);
    registerConfigurationTools(all, mockClient);
    registerContactTools(all, mockClient);
    registerExpenseTools(all, mockClient);
    registerFinanceTools(all, mockClient);
    registerHealthTools(all, mockClient);
    registerMarketingTools(all, mockClient);
    registerOpportunityTools(all, mockClient);
    registerProcurementTools(all, mockClient);
    registerProjectTools(all, mockClient);
    registerSalesTools(all, mockClient);
    registerScheduleTools(all, mockClient);
    registerServiceTools(all, mockClient);
    registerSystemTools(all, mockClient);
    registerTicketTools(all, mockClient);
    registerTimeEntryTools(all, mockClient);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (all as any)._registeredTools as Record<string, unknown>;
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
        if (/max:\s*1000/.test(desc)) offenders.push(`${name}.${field}`);
      }
    }
    expect(Object.keys(tools).length).toBeGreaterThan(0);
    expect(offenders).toStrictEqual([]);
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

describe("report tools return rows, not a count", () => {
  // cw_run_report was wired to /system/reports/{name}/count, so every call came
  // back as {"count": 71} no matter what conditions or pageSize were passed.
  // The rows live on the bare /system/reports/{name} path.
  it("cw_run_report GETs /system/reports/{name}, not /count", async () => {
    await getTool(server, "cw_run_report").handler({ name: "PaymentsByDate" }, {});
    expect(mockClient.get).toHaveBeenCalledWith(
      "/system/reports/PaymentsByDate",
      expect.anything(),
    );
    const paths = (mockClient.get as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      (c) => String(c[0]),
    );
    expect(paths.some((p) => p.endsWith("/count"))).toBe(false);
  });

  it("cw_run_report forwards conditions, paging and orderBy", async () => {
    await getTool(server, "cw_run_report").handler(
      {
        name: "PaymentsByDate",
        conditions: 'paymentDate="2026-08-20"',
        page: 2,
        pageSize: 500,
        orderBy: "paymentDate desc",
      },
      {},
    );
    expect(mockClient.get).toHaveBeenCalledWith("/system/reports/PaymentsByDate", {
      conditions: 'paymentDate="2026-08-20"',
      page: 2,
      pageSize: 500,
      orderBy: "paymentDate desc",
    });
  });

  it("cw_get_report accepts conditions and paging so it is not first-page-only", async () => {
    const { inputSchema } = getTool(server, "cw_get_report");
    await expect(
      inputSchema.parseAsync({
        name: "PaymentsByDate",
        conditions: 'paymentDate="2026-08-20"',
        page: 3,
        pageSize: 1000,
        orderBy: "id",
      }),
    ).resolves.toBeTruthy();
  });

  it("cw_get_report forwards those filters to CW", async () => {
    await getTool(server, "cw_get_report").handler(
      { name: "PaymentsByDate", conditions: 'paymentDate="2026-08-20"', page: 3 },
      {},
    );
    expect(mockClient.get).toHaveBeenCalledWith("/system/reports/PaymentsByDate", {
      conditions: 'paymentDate="2026-08-20"',
      page: 3,
      pageSize: 25,
      orderBy: undefined,
    });
  });
});

type MockFn = { mockResolvedValueOnce(v: unknown): void; mock: { calls: unknown[][] } };
const getMock = () => mockClient.get as unknown as MockFn;

describe("opportunity products live under /procurement/products", () => {
  it("cw_list_opportunity_products filters procurement products by opportunity", async () => {
    await getTool(server, "cw_list_opportunity_products").handler({ opportunityId: 2081 }, {});
    expect(mockClient.get).toHaveBeenCalledWith("/procurement/products", {
      conditions: "opportunity/id = 2081",
      page: 1,
      pageSize: 25,
    });
  });

  it("ANDs caller conditions onto the opportunity filter", async () => {
    await getTool(server, "cw_list_opportunity_products").handler(
      { opportunityId: 2081, conditions: "cancelledFlag = false" },
      {},
    );
    expect(mockClient.get).toHaveBeenCalledWith(
      "/procurement/products",
      expect.objectContaining({
        conditions: "opportunity/id = 2081 and (cancelledFlag = false)",
      }),
    );
  });

  it("cw_get_opportunity_product GETs /procurement/products/{productId}", async () => {
    // The ownership check is the read: one GET, and its product is what the tool returns.
    getMock().mockResolvedValueOnce({ id: 95790, opportunity: { id: 2081 } });
    await getTool(server, "cw_get_opportunity_product").handler(
      { opportunityId: 2081, productId: 95790 },
      {},
    );
    expect(mockClient.get).toHaveBeenCalledTimes(1);
    expect(mockClient.get).toHaveBeenCalledWith("/procurement/products/95790");
  });

  it("cw_get_opportunity_product refuses a product on another opportunity", async () => {
    getMock().mockResolvedValueOnce({ id: 95790, opportunity: { id: 9999 } });
    await expect(
      getTool(server, "cw_get_opportunity_product").handler(
        { opportunityId: 2081, productId: 95790 },
        {},
      ),
    ).rejects.toThrow("Product 95790 is not on opportunity 2081");
  });

  it("cw_create_opportunity_product POSTs to /procurement/products with an opportunity reference", async () => {
    await getTool(server, "cw_create_opportunity_product").handler(
      { opportunityId: 2081, catalogItemId: 1516, quantity: 1, ...SENTINEL },
      {},
    );
    expect(mockClient.post).toHaveBeenCalledWith(
      "/procurement/products",
      expect.objectContaining({
        opportunity: { id: 2081 },
        catalogItem: { id: 1516 },
        quantity: 1,
      }),
    );
  });

  it("cw_update_opportunity_product verifies ownership then PATCHes /procurement/products/{id}", async () => {
    getMock().mockResolvedValueOnce({ id: 95790, opportunity: { id: 2081 } });
    const patch = [{ op: "replace", path: "/quantity", value: 2 }];
    await getTool(server, "cw_update_opportunity_product").handler(
      { opportunityId: 2081, productId: 95790, patch, ...SENTINEL },
      {},
    );
    expect(mockClient.get).toHaveBeenCalledWith("/procurement/products/95790");
    expect(mockClient.patch).toHaveBeenCalledWith("/procurement/products/95790", patch);
  });

  it("cw_update_opportunity_product does not write when the product is on another opportunity", async () => {
    getMock().mockResolvedValueOnce({ id: 95790, opportunity: { id: 9999 } });
    await expect(
      getTool(server, "cw_update_opportunity_product").handler(
        {
          opportunityId: 2081,
          productId: 95790,
          patch: [{ op: "replace", path: "/quantity", value: 2 }],
          ...SENTINEL,
        },
        {},
      ),
    ).rejects.toThrow("Product 95790 is not on opportunity 2081");
    expect(mockClient.patch).not.toHaveBeenCalled();
  });

  it("cw_delete_opportunity_product verifies ownership then DELETEs /procurement/products/{id}", async () => {
    getMock().mockResolvedValueOnce({ id: 95790, opportunity: { id: 2081 } });
    await getTool(server, "cw_delete_opportunity_product").handler(
      { opportunityId: 2081, productId: 95790, ...SENTINEL },
      {},
    );
    expect(mockClient.request).toHaveBeenCalledWith("DELETE", "/procurement/products/95790");
  });

  it("cw_delete_opportunity_product does not write when the product is on another opportunity", async () => {
    getMock().mockResolvedValueOnce({ id: 95790, opportunity: { id: 9999 } });
    await expect(
      getTool(server, "cw_delete_opportunity_product").handler(
        { opportunityId: 2081, productId: 95790, ...SENTINEL },
        {},
      ),
    ).rejects.toThrow("Product 95790 is not on opportunity 2081");
    expect(mockClient.request).not.toHaveBeenCalled();
  });
});

describe("opportunity note types live under /company/noteTypes", () => {
  it("cw_list_opportunity_note_types GETs /company/noteTypes", async () => {
    await getTool(server, "cw_list_opportunity_note_types").handler({}, {});
    expect(mockClient.get).toHaveBeenCalledWith("/company/noteTypes", expect.anything());
  });
});

describe("quote tools report that this instance has no quotes API", () => {
  const quoteCalls: Array<[string, Record<string, unknown>]> = [
    ["cw_search_quotes", {}],
    ["cw_get_quote", { id: 1 }],
    ["cw_count_quotes", {}],
    ["cw_create_quote", { ...SENTINEL }],
    ["cw_update_quote", { id: 1, patch: [], ...SENTINEL }],
    ["cw_replace_quote", { id: 1, body: {}, ...SENTINEL }],
    ["cw_delete_quote", { id: 1, ...SENTINEL }],
  ];

  it.each(quoteCalls)("%s rejects with the unavailable message and calls no client method", async (name, args) => {
    await expect(getTool(server, name).handler(args, {})).rejects.toThrow(QUOTES_UNAVAILABLE_MESSAGE);
    for (const method of ["get", "post", "patch", "request"] as const) {
      expect(mockClient[method]).not.toHaveBeenCalled();
    }
  });

  it.each(quoteCalls)("%s description starts with the unavailable marker", (name) => {
    expect(getTool(server, name).description.startsWith("Unavailable on this instance:")).toBe(true);
  });

  it("the message is the exact agreed wording", () => {
    expect(QUOTES_UNAVAILABLE_MESSAGE).toBe(
      "This ConnectWise instance (v2025.1.10778) has no quotes API: /sales/quotes returned 404 on 12 Nov 2026. Quotes are held in ConnectWise Sell, which this server does not reach.",
    );
  });
});

describe("cw_list_audit_trail takes the type and id ConnectWise requires", () => {
  it("requires type and id", async () => {
    const { inputSchema } = getTool(server, "cw_list_audit_trail");
    await expect(inputSchema.parseAsync({ conditions: "x" })).rejects.toThrow();
  });

  it("type accepts an unlisted value", async () => {
    const { inputSchema } = getTool(server, "cw_list_audit_trail");
    await expect(inputSchema.parseAsync({ type: "Agreement", id: 1 })).resolves.toBeDefined();
  });

  it("id coerces from a string", async () => {
    const { inputSchema } = getTool(server, "cw_list_audit_trail");
    const parsed = (await inputSchema.parseAsync({ type: "Ticket", id: "106507" })) as { id: number };
    expect(parsed.id).toBe(106507);
  });

  it("sends type and id as query parameters", async () => {
    await getTool(server, "cw_list_audit_trail").handler({ type: "Ticket", id: 106507 }, {});
    expect(mockClient.get).toHaveBeenCalledWith(
      "/system/audittrail",
      expect.objectContaining({ type: "Ticket", id: 106507, page: 1, pageSize: 25 }),
    );
  });
});

describe("cw_update_ticket agreement and auto-CC fields", () => {
  it("cw_update_ticket patches /agreement/id", async () => {
    await getTool(server, "cw_update_ticket").handler({ id: 106507, agreementId: 1481, ...SENTINEL }, {});
    expect(mockClient.patch).toHaveBeenCalledWith(
      "/service/tickets/106507",
      expect.arrayContaining([{ op: "replace", path: "/agreement/id", value: 1481 }]),
    );
  });

  it("cw_update_ticket patches the auto-CC fields", async () => {
    await getTool(server, "cw_update_ticket").handler(
      {
        id: 106507,
        automaticEmailCcFlag: false,
        automaticEmailCc: "",
        automaticEmailContactFlag: false,
        automaticEmailResourceFlag: true,
        ...SENTINEL,
      },
      {},
    );
    const ops = (mockClient.patch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as {
      op: string;
      path: string;
      value: unknown;
    }[];
    expect(ops).toEqual(
      expect.arrayContaining([
        { op: "replace", path: "/automaticEmailCcFlag", value: false },
        { op: "replace", path: "/automaticEmailCc", value: "" },
        { op: "replace", path: "/automaticEmailContactFlag", value: false },
        { op: "replace", path: "/automaticEmailResourceFlag", value: true },
      ]),
    );
  });
});

describe("cw_update_time_entry reads, applies and PUTs", () => {
  it("cw_update_time_entry preserves untouched fields", async () => {
    (mockClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 88658,
      notes: "a",
      agreement: { id: 1481 },
      invoiceFlag: true,
      _info: {},
    });
    await getTool(server, "cw_update_time_entry").handler(
      { id: 88658, patch: [{ op: "replace", path: "/notes", value: "b" }], ...SENTINEL },
      {},
    );
    expect(mockClient.get).toHaveBeenCalledWith("/time/entries/88658");
    expect(mockClient.put).toHaveBeenCalledWith("/time/entries/88658", {
      id: 88658,
      notes: "b",
      agreement: { id: 1481 },
      invoiceFlag: true,
    });
    expect(mockClient.patch).not.toHaveBeenCalled();
  });
});

describe("applyPatch", () => {
  it("replaces a nested value without mutating the input", () => {
    const doc = { a: { b: 1, c: 2 } };
    const out = applyPatch(doc, [{ op: "replace", path: "/a/b", value: 9 }]);
    expect(out).toEqual({ a: { b: 9, c: 2 } });
    expect(doc).toEqual({ a: { b: 1, c: 2 } });
  });

  it("add creates an intermediate object", () => {
    const out = applyPatch({}, [{ op: "add", path: "/agreement/id", value: 5 }]);
    expect(out).toEqual({ agreement: { id: 5 } });
  });

  it("remove deletes the field", () => {
    const out = applyPatch({ a: { b: 1, c: 2 }, d: 3 }, [
      { op: "remove", path: "/a/b" },
      { op: "remove", path: "/d" },
    ]);
    expect(out).toEqual({ a: { c: 2 } });
  });
});

describe("applyPatch safety", () => {
  it("applyPatch rejects a replace with no value", () => {
    expect(() => applyPatch({ a: 1 }, [{ op: "replace", path: "/a" }])).toThrow(
      "Patch op replace on /a needs a value",
    );
  });

  it("applyPatch rejects __proto__", () => {
    for (const path of ["/__proto__/x", "/a/constructor/x", "/prototype"]) {
      expect(() => applyPatch({}, [{ op: "add", path, value: 1 }])).toThrow(
        `Patch path ${path} is not allowed`,
      );
    }
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it("applyPatch walks into arrays by index", () => {
    const doc = { c: [{ v: 1 }] };
    expect(applyPatch(doc, [{ op: "replace", path: "/c/0/v", value: 2 }])).toEqual({ c: [{ v: 2 }] });
    expect(doc).toEqual({ c: [{ v: 1 }] });
  });

  it("applyPatch rejects a primitive intermediate", () => {
    expect(() =>
      applyPatch({ timeStart: "2026-11-12T00:00:00Z" }, [{ op: "replace", path: "/timeStart/x", value: 1 }]),
    ).toThrow("Patch path /timeStart/x walks into a non-object");
  });
});

describe("cw_update_time_entry audit", () => {
  it("cw_update_time_entry audits the pre-image", async () => {
    (mockClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 7,
      notes: "a",
      _info: { x: 1 },
    });
    const patch = [{ op: "replace", path: "/notes", value: "b" }];
    await getTool(server, "cw_update_time_entry").handler({ id: 7, patch, ...SENTINEL }, {});
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "cw_update_time_entry",
        operations: { patch, preImage: { id: 7, notes: "a" } },
      }),
    );
  });
});

describe("cw_create_opportunity body shape", () => {
  const base = {
    name: "Test",
    companyId: 1,
    typeId: 2,
    primarySalesRepId: 3,
    stageId: 4,
    contactId: 5,
    ...SENTINEL,
  };

  it("cw_create_opportunity never sends businessUnit", async () => {
    await getTool(server, "cw_create_opportunity").handler({ ...base, businessUnitId: 9 }, {});
    const body = (mockClient.post as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("businessUnit");
  });

  it("cw_create_opportunity sends probability as {id}", async () => {
    await getTool(server, "cw_create_opportunity").handler({ ...base, probabilityId: 5 }, {});
    expect(mockClient.post).toHaveBeenCalledWith(
      "/sales/opportunities",
      expect.objectContaining({ probability: { id: 5 }, contact: { id: 5 } }),
    );
  });

  it("cw_create_opportunity requires contactId", async () => {
    const { contactId: _omit, ...without } = base;
    void _omit;
    const { inputSchema } = getTool(server, "cw_create_opportunity");
    await expect(inputSchema.parseAsync(without)).rejects.toThrow();
  });
});

describe("cw_update_time_entry keeps the entry's own id", () => {
  it("PUTs a body whose id matches the URL even when the patch rewrites /id", async () => {
    (mockClient.get as unknown as { mockResolvedValueOnce(v: unknown): void }).mockResolvedValueOnce({
      id: 88658,
      notes: "before",
      _info: {},
    });
    await getTool(server, "cw_update_time_entry").handler(
      { id: 88658, patch: [{ op: "replace", path: "/id", value: 999 }], ...SENTINEL },
      {},
    );
    const call = (mockClient.put as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(call[0]).toBe("/time/entries/88658");
    expect((call[1] as Record<string, unknown>).id).toBe(88658);
  });
});
